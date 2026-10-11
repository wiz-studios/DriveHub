import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env;
const booking = { userId: 'alice', vehicleId: 'car', startDate: '2026-10-12',
  endDate: '2026-10-14', totalPrice: 100, status: 'pending', paymentStatus: 'unpaid' };
const rental = { userId: 'alice', vehicleId: 'car', bookingId: 'booking',
  status: 'active', pickupOdometer: 1000, pickupPhotos: [], returnPhotos: [] };
const payment = { userId: 'alice', bookingId: 'booking', amount: 100, status: 'pending' };
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-drivehub-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [path, data] of Object.entries({
      'users/alice': { role: 'user', name: 'Alice' },
      'users/bob': { role: 'user' }, 'users/admin': { role: 'admin' },
      'vehicles/car': { status: 'available' }, 'bookings/booking': booking,
      'rentals/rental': rental, 'payments/payment': payment,
      'reviews/review': { userId: 'alice', vehicleId: 'car', rating: 4, comment: 'Good' },
      'gpsTracking/car': { rentalId: 'rental', lat: 0, lng: 0 }
    })) await setDoc(doc(db, path), data);
  });
});
const dbFor = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const ref = (uid, path) => doc(dbFor(uid), path);
const seed = (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));

for (const path of ['bookings/booking', 'rentals/rental', 'payments/payment']) {
  for (const uid of ['alice', 'admin']) test(uid + ' reads ' + path, () => assertSucceeds(getDoc(ref(uid, path))));
  for (const uid of ['bob', null]) test(String(uid) + ' cannot read ' + path, () => assertFails(getDoc(ref(uid, path))));
}
for (const name of ['bookings', 'rentals', 'payments']) {
  test('owner query on ' + name, () => assertSucceeds(getDocs(query(collection(dbFor('alice'), name), where('userId', '==', 'alice')))));
  test('unfiltered owner query denied on ' + name, () => assertFails(getDocs(collection(dbFor('alice'), name))));
  test('admin lists ' + name, () => assertSucceeds(getDocs(collection(dbFor('admin'), name))));
}
test('profile edit succeeds', () => assertSucceeds(updateDoc(ref('alice', 'users/alice'), { name: 'New name' })));
test('profile role promotion denied', () => assertFails(updateDoc(ref('alice', 'users/alice'), { role: 'admin' })));
test('role removal denied', () => assertFails(setDoc(ref('alice', 'users/alice'), { name: 'No role' })));
test('signup allows own user profile', () => assertSucceeds(setDoc(ref('new', 'users/new'), { role: 'user' })));
test('signup cannot create admin', () => assertFails(setDoc(ref('new', 'users/new'), { role: 'admin' })));
test('missing profile cannot gain admin access', () => assertFails(setDoc(ref('new', 'vehicles/new'), { status: 'available' })));
test('anonymous vehicle access denied', () => assertFails(getDoc(ref(null, 'vehicles/car'))));
test('authenticated vehicle access preserved', () => assertSucceeds(getDoc(ref('alice', 'vehicles/car'))));
test('admin vehicle write', () => assertSucceeds(updateDoc(ref('admin', 'vehicles/car'), { status: 'maintenance' })));
test('user vehicle write denied', () => assertFails(updateDoc(ref('alice', 'vehicles/car'), { status: 'available' })));
test('own pending booking creation', () => assertSucceeds(setDoc(ref('alice', 'bookings/new'), booking)));
for (const changes of [{ userId: 'bob' }, { status: 'confirmed' }, { paymentStatus: 'paid' },
  { confirmedAt: 1 }, { endDate: '2026-10-01' }]) {
  test('invalid booking create ' + JSON.stringify(changes), () => assertFails(setDoc(ref('alice', 'bookings/new'), { ...booking, ...changes })));
}
test('owner cancellation', () => assertSucceeds(updateDoc(ref('alice', 'bookings/booking'), { status: 'cancelled' })));
test('confirmed cancellation preserved', async () => {
  await seed('bookings/booking', { ...booking, status: 'confirmed' });
  await assertSucceeds(updateDoc(ref('alice', 'bookings/booking'), { status: 'cancelled' }));
});
test('active cancellation denied', async () => {
  await seed('bookings/booking', { ...booking, status: 'active' });
  await assertFails(updateDoc(ref('alice', 'bookings/booking'), { status: 'cancelled' }));
});
for (const changes of [{ userId: 'bob' }, { vehicleId: 'other' }, { totalPrice: 1 }, { paymentStatus: 'paid' }, { status: 'confirmed' }]) {
  test('owner cannot alter booking ' + JSON.stringify(changes), () => assertFails(updateDoc(ref('alice', 'bookings/booking'), changes)));
}
test('cancelled own booking deletion', async () => {
  await seed('bookings/booking', { ...booking, status: 'cancelled' });
  await assertSucceeds(deleteDoc(ref('alice', 'bookings/booking')));
});
test('pending booking deletion denied', () => assertFails(deleteDoc(ref('alice', 'bookings/booking'))));
test('admin confirms booking', () => assertSucceeds(updateDoc(ref('admin', 'bookings/booking'), { status: 'confirmed' })));
test('own payment creation', () => assertSucceeds(setDoc(ref('alice', 'payments/new'), payment)));
for (const changes of [{ userId: 'bob' }, { bookingId: 'missing' }, { amount: 1 }, { amount: 0 }, { status: 'succeeded' }, { processedAt: 1 }]) {
  test('invalid payment ' + JSON.stringify(changes), () => assertFails(setDoc(ref('alice', 'payments/new'), { ...payment, ...changes })));
}
test('cannot pay another users booking', async () => {
  await seed('bookings/booking', { ...booking, userId: 'bob' });
  await assertFails(setDoc(ref('alice', 'payments/new'), payment));
});
test('user cannot mark payment succeeded', () => assertFails(updateDoc(ref('alice', 'payments/payment'), { status: 'succeeded' })));
test('admin payment succeeded matches application status', () => assertSucceeds(updateDoc(ref('admin', 'payments/payment'), { status: 'succeeded' })));
test('payments cannot be deleted', () => assertFails(deleteDoc(ref('admin', 'payments/payment'))));
test('admin creates rental with actual client schema', () => assertSucceeds(setDoc(ref('admin', 'rentals/new'), { ...rental, status: 'initiated' })));
test('user cannot create rental', () => assertFails(setDoc(ref('alice', 'rentals/new'), rental)));
test('owner pickup', async () => {
  await seed('rentals/rental', { ...rental, status: 'initiated' });
  await assertSucceeds(updateDoc(ref('alice', 'rentals/rental'), { status: 'active', startedAt: 1, pickupPhotos: ['photo'], updatedAt: 1 }));
});
test('owner GPS distance update', () => assertSucceeds(updateDoc(ref('alice', 'rentals/rental'), { gpsDistance: 10 })));
const returned = { status: 'returned', returnedAt: 1, returnOdometer: 1010,
  returnPhotos: ['photo'], calculatedDistance: 10, gpsDistance: 10, updatedAt: 1 };
test('owner return submission', () => assertSucceeds(updateDoc(ref('alice', 'rentals/rental'), returned)));
test('return odometer rollback denied', () => assertFails(updateDoc(ref('alice', 'rentals/rental'), { ...returned, returnOdometer: 999, calculatedDistance: -1 })));
test('forged calculated distance denied', () => assertFails(updateDoc(ref('alice', 'rentals/rental'), { ...returned, calculatedDistance: 0 })));
test('another user cannot return', () => assertFails(updateDoc(ref('bob', 'rentals/rental'), returned)));
for (const changes of [{ userId: 'bob' }, { status: 'closed' }, { damageCharge: 0 }, { pickupOdometer: 0 }, { returnApprovedBy: 'alice' }]) {
  test('protected rental fields ' + JSON.stringify(changes), () => assertFails(updateDoc(ref('alice', 'rentals/rental'), changes)));
}
test('owner dispute after inspection', async () => {
  await seed('rentals/rental', { ...rental, status: 'closed' });
  await assertSucceeds(updateDoc(ref('alice', 'rentals/rental'), { status: 'disputed', updatedAt: 1 }));
});
test('admin approves rental', () => assertSucceeds(updateDoc(ref('admin', 'rentals/rental'), { status: 'closed', damageCharge: 5 })));
test('rentals cannot be deleted', () => assertFails(deleteDoc(ref('admin', 'rentals/rental'))));
test('owner edits review', () => assertSucceeds(updateDoc(ref('alice', 'reviews/review'), { rating: 5, comment: 'Great' })));
test('owner deletes review', () => assertSucceeds(deleteDoc(ref('alice', 'reviews/review'))));
test('review ownership transfer denied', () => assertFails(updateDoc(ref('alice', 'reviews/review'), { userId: 'bob' })));
test('invalid review rating denied', () => assertFails(updateDoc(ref('alice', 'reviews/review'), { rating: 6 })));
test('other user review edit denied', () => assertFails(updateDoc(ref('bob', 'reviews/review'), { rating: 2 })));
test('active owner GPS read', () => assertSucceeds(getDoc(ref('alice', 'gpsTracking/car'))));
test('admin GPS read', () => assertSucceeds(getDoc(ref('admin', 'gpsTracking/car'))));
for (const uid of ['bob', null]) test(String(uid) + ' GPS read denied', () => assertFails(getDoc(ref(uid, 'gpsTracking/car'))));
test('missing GPS rental link fails closed', async () => {
  await seed('gpsTracking/car', { lat: 0 });
  await assertFails(getDoc(ref('alice', 'gpsTracking/car')));
});
test('missing linked rental fails closed', async () => {
  await seed('gpsTracking/car', { rentalId: 'missing' });
  await assertFails(getDoc(ref('alice', 'gpsTracking/car')));
});
test('wrong vehicle link fails closed', async () => {
  await seed('rentals/rental', { ...rental, vehicleId: 'other' });
  await assertFails(getDoc(ref('alice', 'gpsTracking/car')));
});
test('former renter cannot track reused vehicle', async () => {
  await seed('rentals/rental', { ...rental, status: 'closed' });
  await seed('rentals/new-rental', { ...rental, userId: 'bob' });
  await seed('gpsTracking/car', { rentalId: 'new-rental' });
  await assertFails(getDoc(ref('alice', 'gpsTracking/car')));
  await assertSucceeds(getDoc(ref('bob', 'gpsTracking/car')));
});
test('returned renter GPS read denied', async () => {
  await seed('rentals/rental', { ...rental, status: 'returned' });
  await assertFails(getDoc(ref('alice', 'gpsTracking/car')));
});
test('admin GPS write with link', () => assertSucceeds(updateDoc(ref('admin', 'gpsTracking/car'), { lat: 1 })));
test('admin GPS write wrong link denied', () => assertFails(updateDoc(ref('admin', 'gpsTracking/car'), { rentalId: 'missing' })));
test('user GPS write denied', () => assertFails(updateDoc(ref('alice', 'gpsTracking/car'), { lat: 1 })));
test('default deny unknown collection', () => assertFails(setDoc(ref('admin', 'unknown/new'), { value: 1 })));
test('claim alone does not replace trusted Firestore admin role', () =>
  assertFails(setDoc(doc(env.authenticatedContext('alice', { role: 'admin' }).firestore(), 'vehicles/new'), { status: 'available' })));
test('cannot create another users profile', () => assertFails(setDoc(ref('alice', 'users/other'), { role: 'user' })));
test('admin creates linked GPS document', async () => {
  await seed('rentals/other-rental', { ...rental, vehicleId: 'other' });
  await assertSucceeds(setDoc(ref('admin', 'gpsTracking/other'), { rentalId: 'other-rental', lat: 1 }));
});
test('GPS document without link cannot be created', () =>
  assertFails(setDoc(ref('admin', 'gpsTracking/other'), { lat: 1 })));
test('anonymous review creation denied', () =>
  assertFails(setDoc(ref(null, 'reviews/new'), { userId: 'alice', vehicleId: 'car', rating: 4 })));
test('owner review creation preserved', () =>
  assertSucceeds(setDoc(ref('alice', 'reviews/new'), { userId: 'alice', vehicleId: 'car', rating: 4 })));
test('nonowner cancelled booking deletion denied', async () => {
  await seed('bookings/booking', { ...booking, status: 'cancelled' });
  await assertFails(deleteDoc(ref('bob', 'bookings/booking')));
});
