# Firestore permission regression tests

From this directory:

```sh
npm ci
npm test
```

Node 20 or 22 and Java 21 are recommended (Java 17 works with the pinned Firebase CLI).
The suite uses only the local Firestore emulator and the demo project
`demo-drivehub-rules`; it does not deploy rules or access production data.
The Firebase CLI downloads the emulator on the first run.

The tests compile the actual root rules and exercise authenticated/anonymous reads,
owner-constrained queries, booking cancellation, payment creation, protected role
and financial fields, rental transitions, reviews, GPS rental links, and default deny.
Admin fixtures use trusted setup to provision Firestore user roles. Tests do not
verify Cloud Functions or Realtime Database permissions.
