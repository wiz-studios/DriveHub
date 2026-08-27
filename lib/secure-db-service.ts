import {
  ref,
  set,
  get,
  update,
  remove,
} from 'firebase/database';
import { database } from './firebase';
import {
  validateBooking,
  validatePayment,
  validateGPSLocation,
  validateReview,
  validateUserProfile,
} from './validation';
import {
  User,
  Vehicle,
  Booking,
  Review,
  Payment,
} from './db-service';

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  constructor(public errors: Array<{ field: string; message: string }>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

/**
 * Secure Booking Operations
 * Enforces: User can only book for themselves, validates dates and vehicle
 */
export async function secureCreateBooking(
  userId: string,
  currentUserId: string,
  bookingData: Omit<Booking, 'id' | 'createdAt'>
): Promise<string> {
  // Authorization check
  if (userId !== currentUserId) {
    throw new AuthorizationError('Users can only create bookings for themselves');
  }

  // Validation
  const validation = validateBooking({
    ...bookingData,
    userId,
  });
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Verify vehicle exists and is available
  const vehicleRef = ref(database, `vehicles/${bookingData.vehicleId}`);
  const vehicleSnapshot = await get(vehicleRef);
  if (!vehicleSnapshot.exists()) {
    throw new ValidationError([{ field: 'vehicleId', message: 'Vehicle not found' }]);
  }

  const vehicle = vehicleSnapshot.val() as Vehicle;
  if (vehicle.status !== 'available') {
    throw new ValidationError([
      { field: 'vehicleId', message: 'Vehicle is not available for booking' },
    ]);
  }

  // Check for overlapping bookings
  const bookingsRef = ref(database, 'bookings');
  const bookingsSnapshot = await get(bookingsRef);
  if (bookingsSnapshot.exists()) {
    const bookings = Object.values(bookingsSnapshot.val()) as Booking[];
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    const hasConflict = bookings.some((b) => {
      if (b.vehicleId !== bookingData.vehicleId || b.status === 'cancelled') {
        return false;
      }
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      return startDate < bEnd && endDate > bStart;
    });

    if (hasConflict) {
      throw new ValidationError([
        { field: 'dates', message: 'Vehicle is already booked for these dates' },
      ]);
    }
  }

  // Create booking
  const bookingId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const bookingRef = ref(database, `bookings/${bookingId}`);
  await set(bookingRef, {
    ...bookingData,
    userId,
    id: bookingId,
    createdAt: Date.now(),
    status: 'pending',
    paymentStatus: 'unpaid',
  });

  return bookingId;
}

/**
 * Secure Booking Update
 * Enforces: Users can only update their own bookings, admins can update any
 * Prevents: Status changes that violate business logic
 */
export async function secureUpdateBooking(
  bookingId: string,
  currentUserId: string,
  isAdmin: boolean,
  updates: Partial<Booking>
): Promise<void> {
  const bookingRef = ref(database, `bookings/${bookingId}`);
  const bookingSnapshot = await get(bookingRef);

  if (!bookingSnapshot.exists()) {
    throw new ValidationError([{ field: 'bookingId', message: 'Booking not found' }]);
  }

  const booking = bookingSnapshot.val() as Booking;

  // Authorization check
  if (!isAdmin && booking.userId !== currentUserId) {
    throw new AuthorizationError('Users can only update their own bookings');
  }

  // Prevent unauthorized status changes
  if (updates.status && !isAdmin) {
    throw new AuthorizationError('Users cannot change booking status');
  }

  // Prevent status transitions that violate business logic
  if (updates.status) {
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[booking.status]?.includes(updates.status)) {
      throw new ValidationError([
        {
          field: 'status',
          message: `Cannot transition from ${booking.status} to ${updates.status}`,
        },
      ]);
    }
  }

  // Prevent role change for non-admins
  if (updates.paymentStatus && !isAdmin) {
    throw new AuthorizationError('Users cannot change payment status');
  }

  await update(bookingRef, updates);
}

/**
 * Secure Payment Creation
 * Enforces: Users can only create payments for their own bookings, validates amounts
 */
export async function secureCreatePayment(
  userId: string,
  currentUserId: string,
  paymentData: Omit<Payment, 'id' | 'createdAt'>
): Promise<string> {
  // Authorization check
  if (userId !== currentUserId) {
    throw new AuthorizationError('Users can only create payments for themselves');
  }

  // Validation
  const validation = validatePayment({
    ...paymentData,
    userId,
  });
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Verify booking exists and belongs to user
  const bookingRef = ref(database, `bookings/${paymentData.bookingId}`);
  const bookingSnapshot = await get(bookingRef);
  if (!bookingSnapshot.exists()) {
    throw new ValidationError([{ field: 'bookingId', message: 'Booking not found' }]);
  }

  const booking = bookingSnapshot.val() as Booking;
  if (booking.userId !== userId) {
    throw new AuthorizationError('Payment user must match booking user');
  }

  // Verify amount matches booking price (with 1% tolerance for fees)
  const maxAllowed = booking.totalPrice * 1.05;
  const minAllowed = booking.totalPrice * 0.95;
  if (paymentData.amount < minAllowed || paymentData.amount > maxAllowed) {
    throw new ValidationError([
      {
        field: 'amount',
        message: `Amount must be between ${minAllowed} and ${maxAllowed}`,
      },
    ]);
  }

  // Create payment
  const paymentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const paymentRef = ref(database, `payments/${paymentId}`);
  await set(paymentRef, {
    ...paymentData,
    userId,
    id: paymentId,
    createdAt: Date.now(),
    status: 'pending',
  });

  return paymentId;
}

/**
 * Secure GPS Update
 * Enforces: Only admins can update GPS locations, validates coordinate ranges
 */
export async function secureUpdateGPSLocation(
  isAdmin: boolean,
  vehicleId: string,
  location: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
  }
): Promise<void> {
  if (!isAdmin) {
    throw new AuthorizationError('Only admins can update GPS locations');
  }

  // Validation
  const validation = validateGPSLocation(location);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Verify vehicle exists
  const vehicleRef = ref(database, `vehicles/${vehicleId}`);
  const vehicleSnapshot = await get(vehicleRef);
  if (!vehicleSnapshot.exists()) {
    throw new ValidationError([{ field: 'vehicleId', message: 'Vehicle not found' }]);
  }

  // Update GPS location
  const locationRef = ref(database, `gpsTracking/${vehicleId}`);
  await set(locationRef, {
    ...location,
    vehicleId,
    updatedAt: Date.now(),
  });
}

/**
 * Secure Review Creation
 * Enforces: Users can only review vehicles they've rented
 */
export async function secureCreateReview(
  userId: string,
  currentUserId: string,
  reviewData: Omit<Review, 'id' | 'createdAt'>
): Promise<string> {
  // Authorization check
  if (userId !== currentUserId) {
    throw new AuthorizationError('Users can only create reviews for themselves');
  }

  // Validation
  const validation = validateReview(reviewData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Verify user has rented this vehicle
  const bookingsRef = ref(database, 'bookings');
  const bookingsSnapshot = await get(bookingsRef);
  if (!bookingsSnapshot.exists()) {
    throw new ValidationError([
      { field: 'vehicleId', message: 'User has not rented this vehicle' },
    ]);
  }

  const bookings = Object.values(bookingsSnapshot.val()) as Booking[];
  const hasRented = bookings.some(
    (b) =>
      b.userId === userId &&
      b.vehicleId === reviewData.vehicleId &&
      (b.status === 'completed' || b.status === 'active')
  );

  if (!hasRented) {
    throw new ValidationError([
      { field: 'vehicleId', message: 'User has not rented this vehicle' },
    ]);
  }

  // Check for duplicate reviews
  const reviewsRef = ref(database, 'reviews');
  const reviewsSnapshot = await get(reviewsRef);
  if (reviewsSnapshot.exists()) {
    const reviews = Object.values(reviewsSnapshot.val()) as Review[];
    const hasReviewed = reviews.some(
      (r) => r.userId === userId && r.vehicleId === reviewData.vehicleId
    );

    if (hasReviewed) {
      throw new ValidationError([
        { field: 'vehicleId', message: 'User has already reviewed this vehicle' },
      ]);
    }
  }

  // Create review
  const reviewId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const reviewRef = ref(database, `reviews/${reviewId}`);
  await set(reviewRef, {
    ...reviewData,
    userId,
    id: reviewId,
    createdAt: Date.now(),
  });

  return reviewId;
}
