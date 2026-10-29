# Local frontend/backend integration

Use the existing backend and frontend in separate terminals. Keep Atlas and Cloudinary credentials in `backend/.env`; the only local frontend variable is `VITE_API_URL=http://localhost:5000/api`.

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Open **http://localhost:5173**. The development server redirects its alternate `127.0.0.1:5173` URL to localhost. Backend `FRONTEND_ORIGIN` remains exactly `http://localhost:5173`; no wildcard CORS or extra trusted origins were added. Socket.IO uses the origin of the same centralized API URL. Restart the backend after saving environment changes. For production, configure the actual HTTPS API/origin before building; this development redirect does not run in production.

## Safe checks and regression tests

Run from `backend`:

```powershell
node scripts/check-integration.mjs
npm test
node scripts/check-frontend-secrets.mjs
```

The preflight connects read-only to the configured database, checks transaction support and API readiness, and authenticates to Cloudinary. It prints booleans/status codes, never credentials, connection strings or signed links. The secret scan compares current backend credential values against frontend source, public assets and the production build without printing those values. It supplements code review; it is not a complete secret scanner.

Run from `frontend`:

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

Unit/backend integration/browser regression tests use disposable databases. Browser regressions use ports 5001/5174 and a test media provider. Their clock-control fixture exists only in the isolated test server and is never mounted in the production application. Passing these tests does not by itself prove Atlas or Cloudinary integration.

## Live demo accounts

From `backend`, run `node scripts/setup-local-integration.mjs` once. This development-only trusted operator setup creates a dedicated administrator with the existing User validation and bcrypt hashing. It does not promote existing users or create marketplace records. Generated demo credentials are stored in **backend/.local-integration/accounts.json**, outside frontend assets and ignored by version-control rules. Treat that local file as credentials; do not publish it. Windows access permissions follow the workspace account's ACL.

Customer/worker registration, catalog creation and all commercial records use the actual UI/API. To repeat the live checks from `frontend`:

```powershell
node scripts/live-integration.mjs --setup-only
node scripts/live-integration.mjs
```

The full run writes new explicitly labelled demo job/quote/booking records. It uploads real Cloudinary assets, uses two isolated Chrome contexts with Socket.IO, and waits for the actual scheduled start. Synthetic microphone input exercises recording; it is not speech recognition. Demo evidence and reviews are explicitly labelled and do not certify a real identity, license or physical service. This runner never writes Booking/Quote/Payment/Ledger/Review directly to MongoDB and never advances live booking timestamps.

Progress/results and resource IDs are saved to ignored `backend/.local-integration/live-results.json` and `live-context.json`. No tokens are saved and live browser tracing is disabled. The `--continue` option resumes an existing recorded agreement when it is still valid; it cannot reopen expired/cancelled resources. Observe normal lifecycle rules when an abandoned reservation expires.

Repeated multi-user automation shares one IP and can exhaust the unchanged global 300-request/15-minute limiter. Respect HTTP 429 and Retry-After; do not increase production limits to make a demo pass. A development server restart clears its in-memory limiter, but does not alter marketplace data.

## Manual UI / Postman walkthrough

Use separate browser profiles for CUSTOMER, WORKER and ADMIN. In Postman set `api=http://localhost:5000/api` and keep each role's bearer token separate. Responses are `{success,data}`; save IDs from returned DTOs rather than inventing references. API definitions and exact request schemas remain in `backend/docs/openapi.json`.

1. ADMIN: sign in using the local operator account. Create an active category and service in Catalog, or POST `/categories` then `/services` with its category ID. Confirm the service appears publicly at GET `/services`.
2. Register CUSTOMER and WORKER in the actual registration pages (or POST `/auth/register/customer` and `/auth/register/worker`). Required: firstName, lastName, email, phoneNumber, password. No public administrator registration exists.
3. WORKER: complete professional headline, bio, experience, selected services, skills and service areas. Select Public only after required fields exist. POST `/workers/me/profile`, then PATCH for later changes. Check that an unchanged Quote Required pricing selector is saved. Monetary pricing uses integer bututs; 450 GMD is 45000 bututs.
4. Upload a profile photo and portfolio photo, then add portfolio metadata. Uploads use multipart POST `/media` with the documented purpose and file field. The UI performs upload/reference submission separately. Allowed MIME, purpose, size, role and ownership remain server-validated; images are decoded/reencoded to strip metadata.
5. WORKER: upload identity evidence and submit verification through the Verification page. ADMIN: inspect the pending record, request its protected document access, and approve or reject with a reason. Resubmission follows the existing state machine. An unrelated customer must not retrieve verification documents through `/media/:id/access`.
6. WORKER: configure weekly hours, blocked dates/time off and save Availability (PATCH `/availability/me`). `availableNow` is an indicator, not a scheduling guarantee.
7. Public/CUSTOMER: discover the worker using service/category/area and optional proximity filters. Cards and profiles must omit contact/security data, exact coordinates and private documents. Public coordinates are never returned; input coordinate order remains longitude, latitude.
8. CUSTOMER: post a job with service, title, description, general area, budget and optional owned uploaded photos. Open jobs without quotes may edit allowed terms and remove existing photos; after quotes, respect server immutability. Fixed/range budget amounts are integer bututs. Cancel only through the lifecycle action.
9. WORKER: open Opportunities. Verify the job is relevant to the worker's approved, active, public profile/services/area. No precise customer address/coordinates appear. Submit one quote; the UI opens the submitted quote details. Edit/withdraw only while permitted.
10. CUSTOMER: compare received quotes and accept one. Verify the job is QUOTE_ACCEPTED, its acceptedQuote is correct and competitors close. Select a valid future minute-aligned interval in Africa/Banjul, within worker availability, then create the centralized booking. Quote acceptance alone does not create it.
11. Open Message from the agreement/booking in both browsers. Confirm Connected, send text in each direction, upload an image, record → preview → send a voice note and play it in the other browser. Phone/contact sharing is rejected by the existing server policy. Unauthorized users cannot join the conversation or fetch its media.
12. CUSTOMER: open the booking Payment page and run the clearly labelled mock simulation. POST `/payments/bookings/:id/checkout` requires the documented outcome and a stable idempotencyKey for retries. Verify held payment and ledger data. No card, bank or real wallet information is collected.
13. Wait until the actual scheduled start. WORKER: Start work, then submit completion notes/evidence. CUSTOMER: Confirm completion. Verify COMPLETED and released simulated payment. Submit one genuine/demo-labelled review; revisit the booking and confirm the review button stays absent. Server POST review validation remains authoritative even if a client calls it manually.
14. Test the direct-hire path separately: discover worker → proposal with service, description, general area, proposed integer amount and future interval → worker accepts → same centralized Booking engine. Pay the mock booking; report a problem with private evidence; ADMIN reviews and provides a reasoned refund/release decision. Inspect the resulting payment/ledger and audit trail.
15. Check Notifications, unread count and Mark all read. Payment updates link to the protected payment/booking view; unrelated participants receive authorization errors. ADMIN can inspect supported account, worker, booking, payment, verification, dispute and review screens; unavailable administrative APIs are not fabricated.
16. Test logout and protected navigation. Tokens remain memory-only as approved; a full reload requires sign-in. Access-token refresh during an active session, revoked-session handling and inactive-account checks remain server-enforced. No localStorage/cookie persistence or invented OTP flow was added.

No real payment gateway, AI, speech recognition, continuous GPS, new booking architecture, password reset/email delivery or unsupported admin CRUD was introduced by this integration work.
