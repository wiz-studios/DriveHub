# PR #1 deployment investigation

Investigated on October 12, 2026, starting from PR head
`0f118174faff979d169f0f77a618bd2373343a83`.

## Confirmed repository build failures

With the root `pnpm-lock.yaml` dependency versions installed, `npm run build`
(Next.js 16.2.6, Node 24.19.0) compiled the application but failed during static
page generation:

```text
useSearchParams() should be wrapped in a suspense boundary at page "/booking/new".
Error occurred prerendering page "/booking/new".
```

After adding a boundary to that route, the next build exposed the same error at
`/auth/login`. Both routes, the root dependency manifest/lockfile, and
`next.config.mjs` were unchanged from the PR's base commit
`2dd97eb2cc70da0f54c80ebf2382cb71d62472ce`. These are existing application
build blockers, not errors introduced by the Firestore rules patch.

Each page now wraps its query-reading form component in React Suspense with a
loading indicator. The existing `vehicleId` and `redirect` query handling stays
inside that component. This allows static generation to complete while the query
parameters resolve on the client.

Reference: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout

## Vercel evidence and remaining access dependency

GitHub reports a failed Vercel status for the original head, linked to
`dpl_GoHXL5zcViCgUwzmVskyh1yyvnsg`. The Vercel bot comment reports Error but
contains no build diagnostics.

The requested command was attempted:

```sh
npx vercel inspect dpl_GoHXL5zcViCgUwzmVskyh1yyvnsg --logs
```

Vercel CLI 63.1.2 reported no existing credentials and started an authentication
flow. No deployment logs were returned; the authentication wait was cancelled.
The deployment dashboard was also inaccessible through public retrieval.

An authenticated Vercel account or token authorized to inspect the `drivehub`
project in team `wiz-devs-projects` is required to retrieve the original logs
and establish its exact failure. A passing local build does not establish
successful Vercel deployment or verify that the original failure had this cause.
If the new preview still fails, inspect its logs and effective project Root
Directory, Install Command, Build Command, Node version, and Preview environment
variables before changing configuration.

## Validation limits

The final `npm run build` passed, compiling successfully and generating all 13
static pages, including `/auth/login` and `/booking/new`. This production build
is the regression check for these prerender failures. `git diff --check` passed.
An HTTP smoke check could not be completed: the local production server reported
ready, but subsequent loopback requests from this environment were refused.
Next.js configuration already sets `typescript.ignoreBuildErrors: true`; a
successful build is not a clean TypeScript check. No application configuration,
dependencies, Firebase environment variables, rules, or rule tests are changed
by this follow-up. It does not deploy Firebase resources or validate live login,
booking, payment, or GPS workflows.
