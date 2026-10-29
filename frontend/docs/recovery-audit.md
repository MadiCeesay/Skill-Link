# SkillLink recovery audit — 25 October 2026

This is an inspection of the existing application, not a new implementation phase. The workspace contains separate `backend/` and `frontend/` applications, installed dependencies, documentation, tests and ignored local integration artifacts. No Git repository metadata is present at the workspace root. No existing application or database was reset. No backend source, tests, configuration, credentials or documentation were changed in this recovery.

## What already existed

The Express/Mongoose modular backend, OpenAPI (88 paths / 100 operations), architecture and final backend report are present. Backend routes, validators, serializers and services remain authoritative. The React frontend already implements the customer, worker and supported administrator workflows in the established orange, cream and black design.

| Area | Existing implementation and real API integration |
| --- | --- |
| Public | Home, categories/services, filtered discovery, professional profiles, reviews and portfolio use catalog/discovery APIs. Information pages and campaign imagery are intentionally static. Marketplace ratings, profiles and money are not fabricated. |
| Customer | Jobs and attachments, quote comparison/acceptance, separate quote scheduling, direct proposals, bookings, simulated checkout/ledger, completion confirmation, review, disputes and notifications use their existing backend routes. |
| Worker | Profile/onboarding, pricing, service areas, portfolio, verification, availability, opportunities, quote management, proposals, booking execution/completion, earnings and reviews use real APIs. |
| Admin | Metrics, users/status management, worker inspection, verification decisions, catalog management, bookings, payments, ledger, disputes and review moderation use supported admin APIs. |
| Auth | Separate customer/worker registration, real login, memory-only JWTs, serialized refresh rotation, logout, role guards and private-cache clearing exist. Reload requires login. No public ADMIN registration or invented OTP. |
| Messaging | REST persists context-authorized text/image/voice messages; authenticated Socket.IO joins the selected conversation; history polling supplements delivery. Recording supports preview/discard and file fallback. |
| Media | Purpose-specific multipart upload and authorized short-lived access URLs preserve the backend Cloudinary abstraction. No direct browser Cloudinary credential usage. Verification, conversation and evidence access stay private. |
| Money and time | Exact integer-butut conversion/display and explicit Africa/Banjul scheduling exist. Mock payments are intentional backend functionality, not substituted frontend data. |

The previous audit's default QUOTE_REQUIRED pricing, attachment removal, quote-success navigation, payment-notification resolver, localhost redirect and server-derived review eligibility are already implemented. They were preserved. Backend booking detail already returns `reviewEligibility`; this recovery did not add it.

## Genuine limits and unfinished validation

Password reset/change, OTP/email verification, authentication identity editing, public availability slots, administrator-wide job management and audit-event listing have no supported backend endpoints. Existing explanatory screens correctly describe these gaps. Completing those features would require separately scoped backend work; they are not missing connections to existing endpoints.

Earlier documentation records successful isolated regressions but does not establish a complete live Atlas/Cloudinary demo. The saved local `live-results.json` records an incomplete payment-stage run. An old recorded schedule may no longer be resumable; an expired booking must be replaced through the normal job/quote/booking workflow, never edited directly in MongoDB.

Current read-only preflight could not connect to the configured database, local API or Cloudinary. It returned no provider HTTP status, so the older audit's `api_secret mismatch` is historical and cannot be asserted as the current cause. Real provider credentials and connectivity still need verification in a reachable local environment.

## Recovery changes

- Payment details now expose loading, expected missing-payment, and retryable request-error states. Existing unpaid checkout remains available; backend payment authorization remains unchanged.
- The live runner appends evidence instead of overwriting earlier results, rejects `--continue` when no scheduled agreement exists, checks resumable booking states and verifies HELD through the real payment API.
- Frontend dev/build/preview/test commands and the isolated browser server use Vite's runner config loader. This avoids the default loader's denied ancestor-directory read in the current restricted Windows environment. No package versions or application architecture changed.
- Added payment regression tests for the expected pre-checkout 404 and visible/retryable authorization errors.

## Current verification

- Backend: **425 tests passed, 14 files**, 299.32 seconds, using `node node_modules/vitest/vitest.mjs run --configLoader runner` in `backend/`. The old 424 count predates an existing review-eligibility regression.
- Frontend: **49 tests passed, 5 files**, no unhandled errors; `npm.cmd test`.
- ESLint: passed.
- Production build: passed, 1,682 modules, 7.63 seconds.
- Browser suite: 12 passed in the main run; the public-profile scenario failed before page execution because Chrome exited at launch with a Windows encryption error. The targeted public-profile rerun then passed (3.9 seconds). Thus all 13 scenarios passed across the main run and retry, rather than one clean full-suite run. Coverage includes both hiring paths, payment/completion/review, worker management, admin role/catalog and verification, realtime text/image/voice, disputes/refunds and four responsive widths. Disposable server cleanup required stopping this session's own test-server processes after assertions completed.
- Configured-secret scan: zero exposures in the checked frontend source, public assets and build. Values were not printed.

## Realistic demo preparation

Existing generated role credentials are in ignored `backend/.local-integration/accounts.json`; do not publish this file. Its presence does not prove that each account currently exists in a reachable database. The existing development bootstrap creates only the dedicated admin through the validated User model. Customer and worker registration and all marketplace records are created through actual UI/API workflows.

1. Start the existing backend and frontend; open `http://localhost:5173`. Use `npm.cmd` if PowerShell blocks `npm.ps1`.
2. Run `node scripts/check-integration.mjs` from `backend/`. Require database transaction support, API readiness and authenticated Cloudinary success before attempting a live media journey.
3. If needed run the existing `node scripts/setup-local-integration.mjs` in development mode. It preserves existing accounts and stores generated credentials locally.
4. Run `node scripts/live-integration.mjs --setup-only` from `frontend/` to register/sign in the customer and worker, initialize catalog through the admin UI and save the professional profile.
5. Run `node scripts/live-integration.mjs` for labelled demo uploads, identity review, both hiring paths, participant messaging/voice, simulated payment, actual-time completion/review and administrator dispute resolution. This intentionally creates retained demo records and Cloudinary assets. Use synthetic evidence only for explicitly labelled demo profiles.
6. Use separate browser profiles for manual customer, worker and admin testing. Preserve normal availability, rate limits, payment holds and permissions. See [integration testing](integration-testing.md) for the complete manual walkthrough.

Full live integration is not verified until those checks pass against the configured providers. Isolated browser tests use their own temporary replica set and test media provider; they do not prove Cloudinary delivery.
