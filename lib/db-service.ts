import { 
  ref, 
  set, 
  get, 
  update, 
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
  Unsubscribe
} from 'firebase/database';
import { database } from './firebase';

// Type definitions
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  address: string;
  role: 'user' | 'admin';
  createdAt: number;
  profileImage?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  licensePlate: string;
  type: 'sedan' | 'suv' | 'truck' | 'van';
  pricePerDay: number;
  image: string;
  status: 'available' | 'rented' | 'maintenance';
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  features: string[];
  mileage: number;
  createdAt: number;
}

export interface Booking {
  id: string;
  userId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  createdAt: number;
  notes?: string;
}

export interface Review {
  id: string;
  bookingId: string;
  userId: string;
  vehicleId: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  stripePaymentIntentId?: string;
  createdAt: number;
}

// User operations
export async function createUser(userId: string, userData: Omit<User, 'id' | 'createdAt'>) {
  const userRef = ref(database, `users/${userId}`);
  await set(userRef, {
    ...userData,
    id: userId,
    createdAt: Date.now(),
  });
}

export async function getUser(userId: string): Promise<User | null> {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);
  return snapshot.val() || null;
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const userRef = ref(database, `users/${userId}`);
  await update(userRef, updates);
}

// Vehicle operations
export async function createVehicle(vehicleData: Omit<Vehicle, 'id' | 'createdAt'>) {
  const vehiclesRef = ref(database, 'vehicles');
  const newVehicleRef = ref(database, `vehicles/${Date.now()}`);
  await set(newVehicleRef, {
    ...vehicleData,
    id: `${Date.now()}`,
    createdAt: Date.now(),
  });
  return `${Date.now()}`;
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  const vehicleRef = ref(database, `vehicles/${vehicleId}`);
  const snapshot = await get(vehicleRef);
  return snapshot.val() || null;
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  const vehiclesRef = ref(database, 'vehicles');
  const snapshot = await get(vehiclesRef);
  if (!snapshot.exists()) return [];
  
  const vehicles = snapshot.val();
  return Object.values(vehicles) as Vehicle[];
}

export async function getAvailableVehicles(): Promise<Vehicle[]> {
  const vehicles = await getAllVehicles();
  return vehicles.filter(v => v.status === 'available');
}

export async function updateVehicle(vehicleId: string, updates: Partial<Vehicle>) {
  const vehicleRef = ref(database, `vehicles/${vehicleId}`);
  await update(vehicleRef, updates);
}

export function subscribeToVehicle(vehicleId: string, callback: (vehicle: Vehicle | null) => void): Unsubscribe {
  const vehicleRef = ref(database, `vehicles/${vehicleId}`);
  return onValue(vehicleRef, (snapshot) => {
    callback(snapshot.val() || null);
  });
}

// Booking operations
export async function createBooking(bookingData: Omit<Booking, 'id' | 'createdAt'>) {
  const bookingId = `${Date.now()}-${Math.random()}`;
  const bookingRef = ref(database, `bookings/${bookingId}`);
  await set(bookingRef, {
    ...bookingData,
    id: bookingId,
    createdAt: Date.now(),
  });
  return bookingId;
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const bookingRef = ref(database, `bookings/${bookingId}`);
  const snapshot = await get(bookingRef);
  return snapshot.val() || null;
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  const bookingsRef = ref(database, 'bookings');
  const snapshot = await get(bookingsRef);
  if (!snapshot.exists()) return [];
  
  const bookings = snapshot.val();
  return Object.values(bookings).filter((b: any) => b.userId === userId) as Booking[];
}

export async function getAllBookings(): Promise<Booking[]> {
  const bookingsRef = ref(database, 'bookings');
  const snapshot = await get(bookingsRef);
  if (!snapshot.exists()) return [];
  
  return Object.values(snapshot.val()) as Booking[];
}

export async function updateBooking(bookingId: string, updates: Partial<Booking>) {
  const bookingRef = ref(database, `bookings/${bookingId}`);
  await update(bookingRef, updates);
}

// Review operations
export async function createReview(reviewData: Omit<Review, 'id' | 'createdAt'>) {
  const reviewId = `${Date.now()}-${Math.random()}`;
  const reviewRef = ref(database, `reviews/${reviewId}`);
  await set(reviewRef, {
    ...reviewData,
    id: reviewId,
    createdAt: Date.now(),
  });
  return reviewId;
}

export async function getVehicleReviews(vehicleId: string): Promise<Review[]> {
  const reviewsRef = ref(database, 'reviews');
  const snapshot = await get(reviewsRef);
  if (!snapshot.exists()) return [];
  
  const reviews = snapshot.val();
  return Object.values(reviews).filter((r: any) => r.vehicleId === vehicleId) as Review[];
}

// Payment operations
export async function createPayment(paymentData: Omit<Payment, 'id' | 'createdAt'>) {
  const paymentId = `${Date.now()}-${Math.random()}`;
  const paymentRef = ref(database, `payments/${paymentId}`);
  await set(paymentRef, {
    ...paymentData,
    id: paymentId,
    createdAt: Date.now(),
  });
  return paymentId;
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  const paymentRef = ref(database, `payments/${paymentId}`);
  const snapshot = await get(paymentRef);
  return snapshot.val() || null;
}

export async function getBookingPayments(bookingId: string): Promise<Payment[]> {
  const paymentsRef = ref(database, 'payments');
  const snapshot = await get(paymentsRef);
  if (!snapshot.exists()) return [];
  
  const payments = snapshot.val();
  return Object.values(payments).filter((p: any) => p.bookingId === bookingId) as Payment[];
}

export async function updatePayment(paymentId: string, updates: Partial<Payment>) {
  const paymentRef = ref(database, `payments/${paymentId}`);
  await update(paymentRef, updates);
}

// Real-time GPS tracking
export function subscribeToGPSLocation(vehicleId: string, callback: (location: any) => void): Unsubscribe {
  const locationRef = ref(database, `gpsTracking/${vehicleId}`);
  return onValue(locationRef, (snapshot) => {
    callback(snapshot.val());
  });
}

export async function updateGPSLocation(vehicleId: string, location: { lat: number; lng: number; timestamp: number }) {
  const locationRef = ref(database, `gpsTracking/${vehicleId}`);
  await set(locationRef, location);
}
