import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

// Atomic transaction: Payment success → Booking confirmation → Rental initiation
export const onPaymentSuccess = functions.https.onCall(async (data, context) => {
  const { bookingId, paymentId, amount } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }

  const userId = context.auth.uid;

  const batch = db.batch();

  try {
    // 1. Verify payment exists and belongs to this booking
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      throw new Error('Payment not found');
    }

    const payment = paymentSnap.data();
    if (payment.bookingId !== bookingId) {
      throw new Error('Payment does not match booking');
    }

    // 2. Get booking
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      throw new Error('Booking not found');
    }

    const booking = bookingSnap.data();
    if (booking.userId !== userId) {
      throw new Error('Booking does not belong to user');
    }

    if (Math.abs(booking.totalPrice - amount) > 100) {
      // Amount tolerance: 100 cents (1 unit of currency)
      throw new Error('Payment amount does not match booking total');
    }

    // 3. Update payment status
    batch.update(paymentRef, {
      status: 'succeeded',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Update booking status
    batch.update(bookingRef, {
      paymentStatus: 'paid',
      status: 'confirmed',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Create rental document
    const vehicleRef = db.collection('vehicles').doc(booking.vehicleId);
    const vehicleSnap = await vehicleRef.get();

    if (!vehicleSnap.exists) {
      throw new Error('Vehicle not found');
    }

    const rentalRef = db.collection('rentals').doc();
    const rental = {
      id: rentalRef.id,
      bookingId,
      vehicleId: booking.vehicleId,
      userId,
      status: 'initiated',
      pickupOdometer: vehicleSnap.data().currentMileage || 0,
      pickupPhotos: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(rentalRef, rental);

    // 6. Reserve vehicle (set status to booked in date range)
    batch.update(vehicleRef, {
      status: 'booked',
      currentBookingId: bookingId,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Commit all changes atomically
    await batch.commit();

    return {
      success: true,
      rentalId: rentalRef.id,
      message: 'Payment processed and rental initiated',
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Atomic transaction: Return submission → Inspection initiation
export const onReturnSubmission = functions.https.onCall(async (data, context) => {
  const { rentalId, returnOdometer, returnPhotos, gpsDistance } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }

  const userId = context.auth.uid;

  const batch = db.batch();

  try {
    // 1. Get and verify rental
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalSnap = await rentalRef.get();

    if (!rentalSnap.exists) {
      throw new Error('Rental not found');
    }

    const rental = rentalSnap.data();
    if (rental.userId !== userId) {
      throw new Error('Rental does not belong to user');
    }

    if (rental.status !== 'active') {
      throw new Error('Rental is not active');
    }

    // 2. Validate odometer reading
    if (returnOdometer < rental.pickupOdometer) {
      throw new Error('Return mileage cannot be less than pickup mileage');
    }

    // 3. Calculate distance
    const calculatedDistance = returnOdometer - rental.pickupOdometer;
    const distanceMismatch = Math.abs(calculatedDistance - gpsDistance);

    if (distanceMismatch > 10) {
      // Flag if difference > 10 km (potential GPS error or tampering)
      console.warn(`Distance mismatch for rental ${rentalId}: calculated=${calculatedDistance}, gps=${gpsDistance}`);
    }

    // 4. Update rental status
    batch.update(rentalRef, {
      status: 'returned',
      returnedAt: admin.firestore.FieldValue.serverTimestamp(),
      returnOdometer,
      returnPhotos,
      calculatedDistance,
      gpsDistance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Get booking to calculate late fees
    const bookingRef = db.collection('bookings').doc(rental.bookingId);
    const bookingSnap = await bookingRef.get();

    const booking = bookingSnap.data();
    const expectedReturnTime = new Date(booking.endDate).getTime();
    const actualReturnTime = Date.now();
    let lateFeeCost = 0;

    if (actualReturnTime > expectedReturnTime) {
      const lateHours = Math.ceil(
        (actualReturnTime - expectedReturnTime) / (1000 * 60 * 60)
      );
      // Assuming 5000 per hour late fee (configurable)
      lateFeeCost = lateHours * 5000;
    }

    if (lateFeeCost > 0) {
      batch.update(rentalRef, {
        lateFeeCharge: lateFeeCost,
      });
    }

    // 6. Update vehicle status back to available
    const vehicleRef = db.collection('vehicles').doc(rental.vehicleId);
    batch.update(vehicleRef, {
      status: 'available',
      currentMileage: returnOdometer,
      currentBookingId: null,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      calculatedDistance,
      lateFeeCost,
      message: 'Return submitted for inspection',
    };
  } catch (error) {
    console.error('Return submission error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Admin function: Approve rental with damage assessment
export const approveRentalReturn = functions.https.onCall(async (data, context) => {
  const { rentalId, damageCharge = 0 } = data;

  // Check admin role
  const customClaims = context.auth?.token as any;
  if (customClaims?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Must be admin');
  }

  const batch = db.batch();

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalSnap = await rentalRef.get();

    if (!rentalSnap.exists) {
      throw new Error('Rental not found');
    }

    const rental = rentalSnap.data();

    // Calculate total charges
    const lateFeeCost = rental.lateFeeCharge || 0;
    const totalCharge = damageCharge + lateFeeCost;

    // Update rental
    batch.update(rentalRef, {
      status: 'closed',
      returnApprovedBy: context.auth.uid,
      returnApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
      damageCharge,
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update booking payment status
    const bookingRef = db.collection('bookings').doc(rental.bookingId);
    batch.update(bookingRef, {
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create refund/charge record
    const chargeRef = db.collection('charges').doc();
    batch.set(chargeRef, {
      rentalId,
      bookingId: rental.bookingId,
      userId: rental.userId,
      damageCharge,
      lateFeeCost,
      totalCharge,
      status: totalCharge > 0 ? 'pending_charge' : 'pending_refund',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      totalCharge,
      message: 'Rental approved and charges calculated',
    };
  } catch (error) {
    console.error('Rental approval error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// GPS tracking: Record location update
export const recordGPSLocation = functions.https.onCall(async (data, context) => {
  const { rentalId, lat, lng, speed, accuracy, timestamp } = data;

  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }

  try {
    // Verify rental belongs to user
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalSnap = await rentalRef.get();

    if (!rentalSnap.exists) {
      throw new Error('Rental not found');
    }

    const rental = rentalSnap.data();
    if (rental.userId !== context.auth.uid) {
      throw new Error('Rental does not belong to user');
    }

    // Record location in Realtime Database
    const rtdb = admin.database();
    const locationPath = `rentals/${rentalId}/locations`;

    await rtdb.ref(locationPath).push({
      lat,
      lng,
      speed,
      accuracy,
      timestamp,
    });

    return {
      success: true,
      message: 'Location recorded',
    };
  } catch (error) {
    console.error('GPS recording error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Scheduled: Update vehicle availability daily
export const updateVehicleAvailability = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    try {
      const now = Date.now();
      const bookingsRef = db.collection('bookings');

      // Find all bookings that should start today
      const startingBookings = await bookingsRef
        .where('status', '==', 'confirmed')
        .where('startDate', '<=', new Date(now).toISOString())
        .get();

      const batch = db.batch();

      startingBookings.forEach((bookingDoc) => {
        const booking = bookingDoc.data();
        const vehicleRef = db.collection('vehicles').doc(booking.vehicleId);

        batch.update(vehicleRef, {
          status: 'rented',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Find all bookings that should end today
      const endingBookings = await bookingsRef
        .where('status', '==', 'active')
        .where('endDate', '<=', new Date(now).toISOString())
        .get();

      endingBookings.forEach((bookingDoc) => {
        const booking = bookingDoc.data();
        const vehicleRef = db.collection('vehicles').doc(booking.vehicleId);

        batch.update(vehicleRef, {
          status: 'available',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      console.log('Vehicle availability updated successfully');
    } catch (error) {
      console.error('Error updating vehicle availability:', error);
    }
  });
