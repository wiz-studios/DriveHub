import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
  CollectionReference,
  DocumentData,
} from 'firebase/firestore';

// Rental interfaces with complete state machine
export interface Rental {
  id: string;
  bookingId: string;
  vehicleId: string;
  userId: string;
  status: 'initiated' | 'active' | 'returned' | 'inspecting' | 'closed' | 'disputed';
  startedAt?: number;
  returnedAt?: number;
  inspectionStartedAt?: number;
  closedAt?: number;
  
  // Tracking
  pickupOdometer: number;
  returnOdometer?: number;
  calculatedDistance?: number;
  gpsDistance?: number;
  
  // GPS tracking reference
  gpsTrackingId?: string;
  
  // Damages
  pickupPhotos: string[];
  returnPhotos: string[];
  damageReport?: {
    description: string;
    estimatedCost: number;
    photosUrl: string[];
    approvedBy?: string;
    approvedAt?: number;
  };
  
  // Return details
  returnApprovedBy?: string;
  returnApprovedAt?: number;
  finalMileage?: number;
  
  // Final charges
  damageCharge?: number;
  lateFeeCharge?: number;
  refund?: number;
  
  createdAt: number;
  updatedAt: number;
}

export interface DamagePhoto {
  rentalId: string;
  photoUrl: string;
  timestamp: number;
  location: 'pickup' | 'return' | 'inspection';
  notes?: string;
}

// Rental status constants
export const RENTAL_STATUS = {
  INITIATED: 'initiated' as const,
  ACTIVE: 'active' as const,
  RETURNED: 'returned' as const,
  INSPECTING: 'inspecting' as const,
  CLOSED: 'closed' as const,
  DISPUTED: 'disputed' as const,
};

// Rental service functions
export async function createRental(
  bookingId: string,
  vehicleId: string,
  userId: string,
  pickupOdometer: number,
  gpsTrackingId: string
): Promise<string> {
  try {
    const rentalRef = doc(collection(db, 'rentals'));
    const rental: Rental = {
      id: rentalRef.id,
      bookingId,
      vehicleId,
      userId,
      status: RENTAL_STATUS.INITIATED,
      pickupOdometer,
      gpsTrackingId,
      pickupPhotos: [],
      returnPhotos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setDoc(rentalRef, rental);
    return rentalRef.id;
  } catch (error) {
    console.error('[v0] Error creating rental:', error);
    throw error;
  }
}

export async function initiateRental(
  rentalId: string,
  pickupPhotos: string[]
): Promise<void> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);
    
    await updateDoc(rentalRef, {
      status: RENTAL_STATUS.ACTIVE,
      startedAt: Date.now(),
      pickupPhotos,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error initiating rental:', error);
    throw error;
  }
}

export async function submitReturnRequest(
  rentalId: string,
  returnOdometer: number,
  returnPhotos: string[],
  gpsDistance: number
): Promise<void> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);
    const existingRental = await getRental(rentalId);
    const calculatedDistance = returnOdometer - (existingRental?.pickupOdometer || 0);

    await updateDoc(rentalRef, {
      status: RENTAL_STATUS.RETURNED,
      returnedAt: Date.now(),
      returnOdometer,
      returnPhotos,
      calculatedDistance,
      gpsDistance,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error submitting return request:', error);
    throw error;
  }
}

export async function submitDamageReport(
  rentalId: string,
  damageReport: Rental['damageReport']
): Promise<void> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);

    await updateDoc(rentalRef, {
      damageReport,
      status: RENTAL_STATUS.INSPECTING,
      inspectionStartedAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error submitting damage report:', error);
    throw error;
  }
}

export async function approveRental(
  rentalId: string,
  approvedBy: string,
  damageCharge: number = 0,
  lateFeeCharge: number = 0
): Promise<void> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);

    await updateDoc(rentalRef, {
      status: RENTAL_STATUS.CLOSED,
      returnApprovedBy: approvedBy,
      returnApprovedAt: Date.now(),
      damageCharge,
      lateFeeCharge,
      closedAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error approving rental:', error);
    throw error;
  }
}

export async function disputeRental(
  rentalId: string,
  reason: string
): Promise<void> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);

    await updateDoc(rentalRef, {
      status: RENTAL_STATUS.DISPUTED,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error disputing rental:', error);
    throw error;
  }
}

export async function getRental(rentalId: string): Promise<Rental | null> {
  try {
    const rentalRef = doc(db, 'rentals', rentalId);
    const rentalSnap = await getDoc(rentalRef);

    if (!rentalSnap.exists()) {
      return null;
    }

    return rentalSnap.data() as Rental;
  } catch (error) {
    console.error('[v0] Error getting rental:', error);
    throw error;
  }
}

export async function getUserRentals(userId: string): Promise<Rental[]> {
  try {
    const q = query(
      collection(db, 'rentals'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Rental);
  } catch (error) {
    console.error('[v0] Error getting user rentals:', error);
    throw error;
  }
}

export async function getVehicleRentals(vehicleId: string): Promise<Rental[]> {
  try {
    const q = query(
      collection(db, 'rentals'),
      where('vehicleId', '==', vehicleId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Rental);
  } catch (error) {
    console.error('[v0] Error getting vehicle rentals:', error);
    throw error;
  }
}

export async function getActiveRentals(): Promise<Rental[]> {
  try {
    const q = query(
      collection(db, 'rentals'),
      where('status', '==', RENTAL_STATUS.ACTIVE)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Rental);
  } catch (error) {
    console.error('[v0] Error getting active rentals:', error);
    throw error;
  }
}

export async function getPendingInspections(): Promise<Rental[]> {
  try {
    const q = query(
      collection(db, 'rentals'),
      where('status', '==', RENTAL_STATUS.INSPECTING)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as Rental);
  } catch (error) {
    console.error('[v0] Error getting pending inspections:', error);
    throw error;
  }
}

export async function calculateLateFee(
  rentalId: string,
  hourlyRate: number
): Promise<number> {
  try {
    const rental = await getRental(rentalId);
    if (!rental || !rental.returnedAt) return 0;

    const bookingRef = doc(db, 'bookings', rental.bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) return 0;

    const booking = bookingSnap.data() as any;
    const expectedReturnTime = new Date(booking.endDate).getTime();
    const actualReturnTime = rental.returnedAt;

    if (actualReturnTime <= expectedReturnTime) return 0;

    const lateHours = Math.ceil((actualReturnTime - expectedReturnTime) / (1000 * 60 * 60));
    return lateHours * hourlyRate;
  } catch (error) {
    console.error('[v0] Error calculating late fee:', error);
    throw error;
  }
}
