# Firestore security review

Reviewed against main commit 2dd97eb2cc70da0f54c80ebf2382cb71d62472ce.

## Changes

- Replace invalid `document.data` references with `resource.data`, including reviews.
- Keep owner and admin reads, authenticated vehicle/review reads, and default deny.
- Make profile roles immutable to client updates, including removal and re-addition.
- Restrict booking owner changes to notes, timestamps, and cancellation of pending
  or confirmed bookings. Confirmation, payment state, dates, price, and ownership
  are privileged changes. Cancelled booking deletion remains available.
- Require pending/unpaid client booking creation and reject injected server fields.
- Require pending payment creation for the caller's existing pending booking with
  the matching amount. Clients cannot mark payments successful.
- Accept the application's `succeeded` payment status for admin updates while
  retaining `completed` for existing records.
- Align admin rental creation with the actual initiated rental schema, which does
  not contain `startDate`. Preserve owner pickup, validated return submission,
  active GPS distance updates, and post-return disputes. Owner changes cannot
  alter rental identity, pickup mileage, charges, or approval.
- Keep review ownership and vehicle binding immutable on edits; validate rating.
- Replace the unbound GPS path placeholder with a rental ID stored in the
  trusted location document. A user must own the linked active rental, and the
  rental must reference the requested vehicle. Admin writers must provide a valid
  vehicle/rental link. Former renters cannot read a new renter's vehicle location.

## GPS data contract and rollout

Firestore `gpsTracking/{vehicleId}` documents must include `rentalId`, pointing to
an existing `rentals/{rentalId}` document for that vehicle. A trusted backend or
admin must set or replace this link as rental ownership changes. Existing location
records without this link remain admin-readable and deny user access. Backfill
them from verified active rental records before relying on user location reads.
Do not infer a rental ID from a vehicle ID or a client-provided user ID.

The repository's GPS writers currently use Realtime Database paths
`gps_tracking/{rentalId}`, `gpsTracking/{vehicleId}`, and
`rentals/{rentalId}/locations`; none creates these Firestore location documents.
This patch secures the existing Firestore collection contract, not those separate
Realtime Database paths. Changing the match path to a rental-keyed collection
would silently break the existing vehicle-keyed contract.

## Authentication and workflow boundaries

Firestore admin authorization continues to use a trusted Firestore
`users/{uid}.role` record. The browser RBAC/profile helpers instead read
Realtime Database users, and `approveRentalReturn` uses an Auth custom claim.
Provisioning must keep these representations consistent using trusted server
code; this patch does not trust arbitrary client claims or Realtime Database
profile data as Firestore admin authority.

Most booking/payment/profile browser helpers use Realtime Database, whereas
rentals use Firestore. Firestore rules do not enforce permissions for Realtime
Database operations. The existing Realtime Database rules have broad parent reads
and owner writes on users that cannot be narrowed by child rules; they need a
separate permissions review. Missing collection rules there also affect legitimate
booking/payment/GPS access. Do not widen Firestore access to compensate.

Admin SDK writes bypass Firestore Security Rules. In particular:

- `onPaymentSuccess` trusts a caller-supplied amount, lacks provider confirmation,
  does not check payment ownership or succeeded state, and is not replay-safe.
  A verified provider event and an idempotent transaction are required before
  this function is safe for real payments. A client-created matching payment
  record is not proof of payment.
- Prices and overlapping reservations need authoritative server validation.
  A client may still choose a low price on a new booking; the matching payment
  amount check is relational integrity, not authoritative pricing.
- Client return/GPS metrics remain user-supplied evidence. Financial charges and
  provider results must be computed/verified by trusted code. Direct return
  submission updates the rental only; the callable also updates vehicle/late-fee
  records. Consolidate those workflows on trusted code for production.
- `recordGPSLocation` checks ownership but not active status. Its Realtime Database
  Admin SDK writes are outside this rules patch.

No production deployment is performed by this change. Passing Firestore emulator
tests does not establish end-to-end security or successful Cloud Functions deployment.

## Validation

On October 11, 2026, `npm test --prefix tests/rules` compiled the corrected rules
with Firestore emulator v1.19.8 and passed all 100 tests (0 failed, 0 skipped).
The run used Firebase CLI 14.22.0, Firebase SDK 12.14.0, rules-unit-testing 5.0.0,
Node 24.19.0, and Java 17. The pinned test tooling is isolated from application
dependencies. The lockfile records the tested dependency graph.

## Documentation

- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/security/rules-fields
- https://firebase.google.com/docs/rules/unit-tests
- https://firebase.google.com/docs/database/security/core-syntax
