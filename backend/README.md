# SkillLink V1 backend

SkillLink is a service marketplace for The Gambia. Phase 1 supplies the backend foundation and authentication. Phase 2 adds worker professional profiles, the service catalog, protected media, and audited worker verification. Phase 3 adds worker discovery, customer job requests, rule-based matching, and quotes through acceptance. Phases 4–9 now complete availability, unified bookings, private messaging and voice, simulated payments, completion, disputes, genuine reviews, notifications and audited administration. The historical phase sections below remain as implementation records; the V1 sections describe current behavior.

## Requirements and setup

- Node.js 22.12 or newer and npm (Node.js 24 is used for this implementation).
- A MongoDB replica set (local rs0 or Atlas) for the complete V1 transactional marketplace. Phase 1-only authentication can use standalone MongoDB.

From the Skill-Link workspace:

~~~powershell
cd backend
npm ci
Copy-Item .env.example .env
~~~

Edit .env and provide two different, randomly generated secrets (at least 32 characters each). Generate each independently with:

~~~powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
~~~

Never commit .env, generated secrets, credentials, or tokens. Example values contain no usable signing keys. The application intentionally refuses to start until secrets are supplied.

| Variable | Meaning |
| --- | --- |
| NODE_ENV | development, test, or production; defaults to development |
| PORT | HTTP port; defaults to 5000 |
| MONGODB_URI | Required MongoDB connection URI |
| JWT_ACCESS_SECRET | Required independent access signing secret, minimum 32 characters |
| JWT_REFRESH_SECRET | Required independent refresh signing secret, minimum 32 characters |
| JWT_ACCESS_EXPIRES_IN | Explicit unit s/m/h/d; defaults to 15m, maximum 1h |
| JWT_REFRESH_EXPIRES_IN | Defaults to 7d; greater than access lifetime and at most 30d |
| FRONTEND_ORIGIN | Required exact HTTP(S) browser origin, without trailing slash; HTTPS in production |

~~~powershell
npm run dev
npm start
npm test
npm run test:watch
~~~

Use dev for watch mode and start for normal operation. Startup validates configuration, connects to MongoDB, creates required indexes, and starts HTTP. Connection or index failures abort startup. SIGINT/SIGTERM close HTTP and MongoDB with a shutdown deadline. Health is a liveness check, not a database readiness probe.

## Architecture

The modular monolith separates routes, controllers, services, validators, and models inside feature modules. Shared middleware handles authentication, RBAC, validation, and errors. src/app.js exports createApp without starting a listener or database connection; server.js owns startup/shutdown.

The auth and users modules preserve Phase 1 behavior. Phase 2 implements workers, catalog, media, verifications, a media provider, and limited administrative audit records. Other reserved module folders remain placeholders. See docs/architecture.md for approved future decisions.

## Phase 1 data models

User: firstName, lastName, unique normalized email, unique international phoneNumber, hidden passwordHash, CUSTOMER/WORKER/ADMIN role, nullable profileImage, ACTIVE/SUSPENDED/DISABLED accountStatus, emailVerified (false initially), hidden tokenVersion, and timestamps. There is no account-update endpoint in this phase.

Session: user reference, hidden SHA-256 digest of the current refresh token, absolute expiresAt, revokedAt, and timestamps. A TTL index eventually removes expired sessions; authorization explicitly checks expiration without depending on TTL cleanup.

Passwords enter through a model virtual and are bcrypt-hashed at cost 12. Registration requires at least 8 characters, uppercase/lowercase letters and a digit, with at most 72 UTF-8 bytes to avoid bcrypt truncation. Passwords are not trimmed. No password/hash is returned. Use the password virtual for future password changes; never update passwordHash directly. Persistence code is trusted server code, not a public update interface.

## Authentication API

All routes use /api. JSON success: { success: true, data: ... }. Errors: { success: false, error: { code, message, details? } }. No stack traces or raw database errors are returned.

| Method | Endpoint | Body / requirement |
| --- | --- | --- |
| GET | /api/health | Public liveness |
| POST | /api/auth/register/customer | firstName, lastName, email, phoneNumber, password |
| POST | /api/auth/register/worker | Same fields; server sets WORKER |
| POST | /api/auth/login | email, password |
| POST | /api/auth/refresh | refreshToken |
| POST | /api/auth/logout | Bearer access token; revokes its session |
| GET | /api/auth/me | Bearer access token |

Registration returns 201 with the safe user and does not log in automatically. All other successful endpoints return 200. Login returns user, accessToken, refreshToken, tokenType, and access expiresIn in seconds. Refresh returns the new token pair. Unknown body fields, including role/status/emailVerified, are rejected. Public ADMIN registration does not exist. No default administrator or administrator seed secret is shipped.

Email is trimmed and lowercased; provider-specific dot/plus rewriting is intentionally avoided. Phone numbers use international format: + followed by 8–15 digits. Spaces, parentheses and hyphens are normalized. This checks syntax, not number ownership.

### Token lifecycle

1. Register through an explicit customer or worker endpoint.
2. Login using email/password. Invalid credentials receive the same response for unknown email and incorrect password; inactive accounts cannot log in.
3. Send Authorization: Bearer ACCESS_TOKEN on protected requests.
4. Refresh using the refresh token. JWTs verify HS256, issuer, audience, type, expiration and expected identifiers. Secrets and audiences differ by token type.
5. Refresh atomically replaces the stored digest. A refresh token can be consumed once. A verified stale token revokes the entire session, including previously issued access tokens. Clients must serialize refresh requests; simultaneous refreshes intentionally revoke the session.
6. Logout revokes the session in MongoDB. It invalidates its access and refresh tokens; other login sessions remain valid. An expired access token must be refreshed before authenticated logout.

Refresh rotation does not extend the session's original absolute lifetime. Clients must sign in again when it expires. A lost refresh response may require signing in again because the previous token cannot safely be reused.

Every protected request checks the current User and Session. Suspension/disablement therefore blocks existing tokens immediately on the next request. Increasing tokenVersion invalidates all sessions for future password-change/reset workflows. No password change/reset or administrator status-management endpoint is implemented in Phase 1. Reactivation can make an unexpired session usable again unless it was revoked or tokenVersion was increased; future administrator suspension should revoke sessions as policy requires.

Tokens are returned as JSON for API clients. Use HTTPS outside local development. A browser client should keep access tokens in memory and carefully choose refresh storage. Persistent localStorage is exposed to XSS; a later HTTP-only-cookie transport requires explicit CSRF and cookie policy. This phase does not silently introduce cookies or claim XSS-safe browser persistence.

### RBAC

Use authenticate(service) followed by authorize('CUSTOMER'), authorize('WORKER'), authorize('ADMIN'), or authorize('CUSTOMER', 'WORKER'). Authentication loads the live database role. Tests mount temporary role-restricted routes; no demonstration/admin marketplace routes ship in the application. Unauthenticated access returns 401; insufficient role or inactive status returns 403.

## Security and limitations

Helmet, an exact environment-configured CORS origin, strict Zod body validation, a 16 KB JSON limit, global rate limiting, and a tighter shared authentication limiter are enabled. Authentication responses use Cache-Control: no-store. Database filters are built from validated values; sanitizeFilter is enabled and internal range operators are explicitly trusted. Unique MongoDB indexes prevent duplicate registrations under concurrency. Startup checks index creation.

The default rate-limit store is per process and resets on restart. Before multi-instance deployment use a shared limiter store and configure a known trusted reverse proxy; trust proxy is deliberately not enabled globally. Rate limits apply by IP, which can affect users behind shared networks. CORS is a browser policy, not API authentication.

Development logging records method/path/status/timing, never bodies or headers; requests containing query strings are skipped. Do not place credentials in URLs. Unexpected errors log the error class only. There are no plaintext credential or token logs.

Email/phone ownership verification, password reset/change, MFA, administrator provisioning tools, and cleanup of old revoked sessions beyond TTL are not implemented. JWT secrets must be high entropy; length validation cannot establish entropy. Account state can change during an in-flight request; later sensitive mutations should recheck state within their transaction.

## Tests

npm test runs Vitest and Supertest against a real ephemeral MongoDB process through mongodb-memory-server. Tests do not use your application database or need .env credentials. The first run may download a MongoDB binary and needs network access. Integration coverage includes concurrent duplicate registration, password hashing, login, token expiry, rotation/reuse, session expiry/revocation, live roles/status, RBAC, validation, CORS, rate limits and error handling. Configuration tests check secret/lifetime/origin constraints.

## Manual API testing (PowerShell)

Start the backend, then:

~~~powershell
$base = 'http://localhost:5000/api'
Invoke-RestMethod "$base/health"
$registration = @{ firstName='Awa'; lastName='Jallow'; email='awa@example.test'; phoneNumber='+2207000001'; password='Example-password123' } | ConvertTo-Json
Invoke-RestMethod "$base/auth/register/customer" -Method Post -ContentType 'application/json' -Body $registration
$credentials = @{ email='awa@example.test'; password='Example-password123' } | ConvertTo-Json
$login = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body $credentials
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
Invoke-RestMethod "$base/auth/me" -Headers $headers
$refreshBody = @{ refreshToken=$login.data.refreshToken } | ConvertTo-Json
$rotated = Invoke-RestMethod "$base/auth/refresh" -Method Post -ContentType 'application/json' -Body $refreshBody
$headers = @{ Authorization = "Bearer $($rotated.data.accessToken)" }
Invoke-RestMethod "$base/auth/logout" -Method Post -Headers $headers
~~~

The same endpoints work in Postman using JSON bodies and Bearer authorization. Do not reuse a rotated refresh token unless deliberately testing session revocation. All examples use fictitious development credentials.

Import docs/openapi.json into Postman for a Phase 1 endpoint collection. Set the server URL to your local /api base and add your own development request values.

The project .npmrc uses legacy-peer-deps to avoid resolving unused optional browser-runner peers. The committed lockfile and npm ci keep installs reproducible.

Revocation deliberately costs a User lookup and Session lookup on each authenticated request. This keeps role, suspension, and logout enforcement immediate instead of waiting for access-token expiry.

The test configuration resumes interrupted MongoDB binary downloads and allows up to 10 minutes for first-run setup. Subsequent runs use the cached binary.

## Verified Phase 1 result

On 22 October 2026, npm test passed all 74 tests (61 integration, 13 configuration), across 2 test files, with 0 failures. Full-suite duration: 81.97 seconds. Runtime: Node.js 24.12.0, Vitest 3.2.7, MongoDB 7.0.24.

This environment required elevated test-runner filesystem access. Registry resets and Windows cleanup warnings delayed installation but were resolved. The complete mongod.exe was recovered from the official partial Windows archive, validated against its ZIP CRC and uncompressed size, and confirmed with --version; the test suite then ran against that cached binary. This recovery changed only the ignored dependency cache, not application code.

Windows MongoDB archives include large debug-symbol files. For normal fresh installs allow the standard download, or set the optional MONGMS_SYSTEM_BINARY environment variable to an existing compatible mongod executable before npm test. No database credentials are needed for the ephemeral integration database.

## Phase 2 — worker identity and trust

Profiles are created explicitly during professional onboarding, not registration. Worker registration and all Phase 1 authentication/session code and original tests remain unchanged. POST /api/workers/me/profile creates at most one WorkerProfile per WORKER User; CUSTOMER and ADMIN cannot onboard. PATCH updates only allowed professional fields. Profiles start DRAFT. Publication requires a profession, a bio of at least 20 characters, at least one active service and a service area. A deactivated selected service/category makes an existing public profile unavailable until the worker updates it. Suspended/disabled accounts are unavailable publicly and cannot use protected management routes.

WorkerProfile holds professionTitle, bio, integer yearsOfExperience (0–80), bounded human-readable skills, Service references, serviceAreas, optional primaryLocation, serviceRadiusKm, an owned profile-image MediaAsset reference, portfolio, service pricing, availableNow, visibility and timestamps. Rating/review/completed-job counters remain protected zero-valued foundations; there are no review or job reputation calculations. availableNow is a worker declaration, not a scheduling guarantee. Verification summaries and profileCompletion are derived at read time, never worker-assigned or independently cached fields. Completion considers profession, bio, service, area, location, portfolio, pricing and a verification submission.

### Database requirements for Phase 2

Phase 1 and single-document profile operations still work on standalone MongoDB. Catalog mutations, verification submission and review require a replica set because transactional correctness is part of their design. A standalone server returns 503 REPLICA_SET_REQUIRED for those operations. Use a MongoDB deployment supporting transactions, or initialize a local single-node replica set. For a new local development database (MongoDB and mongosh must be installed), start this in one terminal from backend:

~~~powershell
New-Item -ItemType Directory -Force .local-mongo
mongod --dbpath .local-mongo --replSet rs0 --bind_ip 127.0.0.1 --port 27017
~~~

In another terminal, run mongosh, then initialize once in its JavaScript prompt:

~~~javascript
rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })
~~~

Set MONGODB_URI=mongodb://127.0.0.1:27017/skilllink?replicaSet=rs0 in .env. Do not run a second mongod on an occupied port or point this example at an existing unrelated database. Tests create their own ephemeral replica set.

### Catalog, areas, coordinates and pricing

Category has a unique slug and normalized case-insensitive name key, description, optional icon key, active flag and sort order. Service belongs to one Category, has a globally unique slug and a normalized name unique within its Category. Slugs can be supplied or generated from names; automatic slugs require ASCII-compatible text. Services cannot be moved between categories by the update endpoint. Names can change without changing stable slugs unless a new slug is explicitly supplied. Admins deactivate catalog entries; no hard-delete API exists. Public lists only show active services under active categories; private admin catalog lists include inactive entries. Pagination defaults to page=1 and limit=20, with limit at most 100.

Service areas are objects such as { name: 'Brikama', region: 'West Coast', country: 'GM' }; region is optional. Country is GM for this Gambian V1, but town names are free text, not a hardcoded allowlist. primaryLocation is an optional GeoJSON Point with coordinates [longitude, latitude]. Longitude must be -180…180 and latitude -90…90. The 2dsphere index is created at startup. serviceRadiusKm defaults to 25 and is future discovery metadata. No nearby query or matching endpoint exists. Exact coordinates and radius are private to the worker and authorized admin inspection.

Pricing is an embedded array with one entry per selected Service: { service, type, amountBututs?, currency: 'GMD' }. Supported types: FIXED, HOURLY, STARTING_FROM, QUOTE_REQUIRED. All amounts are nonnegative safe integers in bututs (1 GMD = 100 bututs). FIXED/HOURLY/STARTING_FROM require an amount; QUOTE_REQUIRED forbids one. Removing a service also requires removing its pricing and any portfolio service references. No payment calculation or collection is implemented.

### Media storage and upload security

MediaService owns purpose, validation, ownership and database metadata. Its provider contract is upload({buffer,purpose,owner,format}), access(asset,expiresAt) and remove(asset). CloudinaryMediaProvider implements it; the automated test suite injects a test-only FakeMediaProvider. Runtime configuration supports disabled or cloudinary, never a fake storage mode. Existing Phase 1 deployments remain usable with media disabled; uploads return 503 until configured.

New environment variables:

| Variable | Meaning |
| --- | --- |
| MEDIA_PROVIDER | disabled (default) or cloudinary |
| CLOUDINARY_CLOUD_NAME | Cloudinary product environment name |
| CLOUDINARY_API_KEY | API key; required with cloudinary |
| CLOUDINARY_API_SECRET | API secret; required with cloudinary |

Supply all three credentials together. They are passed per provider call, not placed in controllers or global SDK configuration. Real uploads require a configured account and were not exercised with live credentials in automated tests. PDF delivery may need to be enabled in the Cloudinary product environment.

POST /api/media/{purpose} accepts exactly one multipart file field named file, with no extra form fields. Purposes are PROFILE_IMAGE, PORTFOLIO, IDENTITY_DOCUMENT, SKILL_CERTIFICATE and WORK_EVIDENCE. Maximum raw size is 5 MiB. JPEG/PNG are accepted for all purposes; PDF is accepted only for verification/evidence purposes. MIME headers are checked, images are decoded and re-encoded with a 20-million-pixel limit, and EXIF/GPS metadata and appended bytes are stripped. PDFs receive header/trailer checks and attachment delivery, not malware scanning or full semantic validation. SVG, executable and arbitrary other formats are rejected. Uploads have an additional per-IP limiter.

Every stored asset uses Cloudinary authenticated delivery, including portfolio assets. Original and derived files therefore are not made public merely by upload. The database keeps hidden storage locators and purpose/owner metadata, not permanent delivery URLs. Upload responses return the MediaAsset ID, purpose, MIME type, byte count and creation time. Clients cannot submit external media URLs, storage keys, owner IDs or delivery flags.

GET /api/media/{id}/access authenticates the current account and permits only the asset owner (WORKER) or ADMIN. It returns a 60-second signed download URL with no-store/no-referrer headers. The public worker DTO can mint five-minute links only for profile/portfolio images of an eligible profile. Identity/certificate/work-evidence assets never enter public worker serializers. These use Cloudinary's time-limited private_download_url API with authenticated delivery; ordinary permanent signed CDN URLs are intentionally not used. See [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media).

Temporary links are bearer capabilities: a recipient can share one while it remains valid. Hiding/suspending a profile stops new public links; already issued image links can remain valid for up to five minutes, private document links up to one minute. HTTPS, operator access controls, retention rules and Cloudinary account configuration remain important. This phase does not include antivirus scanning, automated verification, expired-document handling, revocation of approved verifications, orphan-media cleanup or permanent asset deletion APIs. If provider upload succeeds but the database write fails, best-effort compensation deletes the provider asset; failed compensation needs operator cleanup. Portfolio removal removes the association, preserving any independently retained evidence.

### Portfolio and public/private data

Portfolio entries embed a media reference, title, description, optional selected Service, and timestamps. Add/update/remove always use the authenticated worker's profile; there is no arbitrary-owner write endpoint. Media must belong to that worker and have PORTFOLIO purpose. Image references are immutable on metadata updates, and there is a maximum of 30 items. PROFILE_IMAGE requires its matching upload purpose. Private verification media cannot be repurposed as a public portfolio item. A worker can separately upload a deliberately public portfolio copy where appropriate.

Public GET /api/workers/{workerId} uses the User ID, not WorkerProfile ID. It exposes only name, professional image, profession, bio, experience, skills, active services, named areas, portfolio, pricing, verification badges, counters, worker-declared availableNow and visibility. It excludes email, phone, exact coordinates, sessions, password/security fields, identity documents, references, administrator notes and rejection reasons. Public responses are no-store to avoid caching access decisions. Own-profile and limited admin inspection use separate explicit serializers.

### Verification workflow and badges

NOT_SUBMITTED is represented by the absence of an application. An onboarded worker submits their own IDENTITY_DOCUMENT asset with optional SKILL_CERTIFICATE assets, WORK_EVIDENCE assets and private reference information. All IDs are validated for ownership and purpose. The server creates PENDING; worker-supplied statuses and review fields are rejected.

PENDING can become APPROVED or REJECTED only through an ADMIN decision. Rejection requires a reason of at least ten characters. The record stores reviewer, review time, private admin notes, rejection reason and whether submitted work evidence was explicitly reviewed. A rejected worker can create a new PENDING record; the old record and review remain intact. Pending/approved applications cannot be resubmitted. A partial unique worker index prevents multiple pending/approved applications under concurrency. Completed review records cannot be changed through the API. Administrators cannot review their own submissions.

APPROVED gives Identity Verified. Work Evidence Reviewed additionally requires submitted work evidence and the administrator's explicit workEvidenceReviewed=true decision. Verified Worker requires both checks. Uploaded certificates alone do not grant professional certification claims. WorkerProfile reads its summary from the authoritative latest Verification, avoiding stale duplicated badge state. Workers see rejection reasons and their submitted metadata, but never private admin notes. Admin detail reads expose the review fields and media IDs; opening a document requires a separate protected media-access call.

AuditEvent records actor, action, resource type/ID, changed field names and creation time. Category/service creates, updates/deactivation and verification decisions save their audit event in the same transaction. Failure to save an audit rolls back the domain change. Events contain neither document contents nor signed URLs nor copied private admin-note text. No audit-management, user-suspension or analytics API was added.

### Phase 2 endpoints and authorization

All paths below are relative to /api. Existing Phase 1 endpoints remain unchanged.

| Method | Path | Access |
| --- | --- | --- |
| GET | /categories | Public active categories |
| POST | /categories | ADMIN |
| PATCH | /categories/{id} | ADMIN |
| GET | /services | Public active services |
| POST | /services | ADMIN |
| PATCH | /services/{id} | ADMIN |
| GET | /categories/{categoryId}/services | Public |
| GET | /admin/catalog/categories | ADMIN, includes inactive |
| GET | /admin/catalog/services | ADMIN, includes inactive |
| GET | /workers/me/profile | WORKER, own |
| POST | /workers/me/profile | WORKER, own onboarding |
| PATCH | /workers/me/profile | WORKER, own |
| GET | /workers/me/portfolio | WORKER, own |
| POST | /workers/me/portfolio | WORKER, own |
| PATCH | /workers/me/portfolio/{itemId} | WORKER, own |
| DELETE | /workers/me/portfolio/{itemId} | WORKER, own |
| GET | /workers/{workerId} | Public eligible profile |
| GET | /admin/workers/{workerId} | ADMIN, limited inspection |
| POST | /media/{purpose} | WORKER |
| GET | /media/{id}/access | Owning WORKER or ADMIN |
| GET | /verifications/me | WORKER, own latest application |
| POST | /verifications | WORKER, own submission |
| GET | /admin/verifications | ADMIN, pending list |
| GET | /admin/verifications/{id} | ADMIN, private details |
| PATCH | /admin/verifications/{id} | ADMIN, pending decision |

### Manual Postman flow

1. Start MongoDB as a replica set, configure .env, set MEDIA_PROVIDER=cloudinary with your own credentials, then npm run dev. Import docs/openapi.json into Postman and set its server URL to your local /api base. Do not use fake production storage or the test fixture URLs.
2. Register and log in a worker through the unchanged auth API. Save the worker access token as workerToken and User ID as workerId. Log in a trusted ADMIN account separately as adminToken. No public administrator registration exists. For a new isolated local test database only, an operator may promote a deliberately created test account using mongosh: db.users.updateOne({email:'admin@example.test'}, {$set:{role:'ADMIN'}}), then log in with that account. Do not expose role mutation through an API or promote an untrusted account.
3. With adminToken, POST /categories with {name:'Home & Utility',slug:'home-utility'}; save its ID. POST /services with {category:'CATEGORY_ID',name:'Electrician',slug:'electrician'}; save serviceId. GET /categories and /categories/{categoryId}/services without authentication to check public catalog reads.
4. With workerToken, POST /workers/me/profile using professionTitle, bio (20+ characters), services:[serviceId], serviceAreas:[{name:'Brikama',country:'GM'}], primaryLocation:{type:'Point',coordinates:[-16.65,13.27]}, and pricing:[{service:serviceId,type:'STARTING_FROM',amountBututs:40000}]. GET the same path to inspect the draft.
5. POST /media/PORTFOLIO using Body → form-data, one file field named file, and a JPEG/PNG. Let Postman set the multipart boundary. Save data.media.id. POST /workers/me/portfolio with {media:'MEDIA_ID',title:'House wiring',service:'SERVICE_ID'}. PATCH or DELETE the returned itemId to test ownership.
6. PATCH /workers/me/profile with {profileVisibility:'PUBLIC'}, then GET /workers/{workerId} without authentication. Confirm professional data is visible and private contact/security fields and exact coordinates are absent.
7. Upload identity evidence to /media/IDENTITY_DOCUMENT. Optionally upload a separate work photo to /media/WORK_EVIDENCE and certificates to /media/SKILL_CERTIFICATE. POST /verifications with {identityDocument:'ID_MEDIA_ID',workEvidence:['EVIDENCE_MEDIA_ID']}. Save verificationId. GET /verifications/me to confirm PENDING.
8. With adminToken, GET /admin/verifications and /admin/verifications/{verificationId}. GET /media/{identityMediaId}/access to obtain a short-lived document link. Repeat as a different worker and expect 404, or without authentication and expect 401.
9. PATCH /admin/verifications/{verificationId} with {decision:'APPROVED',workEvidenceReviewed:true,adminNotes:'Reviewed identity and submitted work evidence'}. GET the public worker profile and confirm evidence-backed badges without private notes/documents. Alternatively reject a fresh pending application with {decision:'REJECTED',rejectionReason:'Please upload a clearer identity document'} and resubmit as the worker; the prior decision remains in the database.
10. Attempt catalog management as a worker and expect 403. Attempt profile updates as a customer and expect 403. Deactivate a service/category as admin and confirm public catalog/profile eligibility updates without deleting existing references.

### Phase 2 verification results

The combined suite on 22 October 2026 passed 186 tests with 0 failures across five files: all 74 original Phase 1 tests, 102 Phase 2 integration tests, seven media-configuration tests and three Cloudinary-adapter contract tests. Duration: 99.46 seconds. Phase 2 integration uses a real temporary single-node MongoDB replica set and a fake external media provider. Adapter tests verify authenticated upload options and time-limited download signatures without network calls. No live Cloudinary credential test was performed.

At Phase 2 completion, these were deferred. Phase 3 now implements nearby discovery, jobs and quotes only. Scheduling/bookings, messaging, voice notes, contact filtering, payments/ledger, completion, disputes, reviews/reputation calculations, notifications, analytics and AI remain deferred.

## Phase 2 dependencies and relevant structure

New direct dependencies: cloudinary 2.11.0 (protected media storage/signing), multer 2.5.0 (bounded multipart parsing), sharp 0.34.5 (image decoding, re-encoding and metadata removal). The lockfile records transitive versions. Existing authentication libraries and test conventions remain in place.

~~~text
src/
  modules/
    catalog/       # category/service models; routes/controller/service/validators
    workers/       # profile model; routes/controller/service/validators/serializers
    media/         # owned asset model; upload/access routes/controller/service
    verifications/ # attempt model; routes/controller/service/validators/serializers
    admin/         # transactional AuditEvent model and insert helper
    auth/          # original Phase 1 files unchanged
    users/         # original Phase 1 User model unchanged
  providers/media/
    cloudinary.provider.js
    unavailable.provider.js
  utils/
    transaction.js
    validation.js
tests/
  integration/phase2.test.js
  unit/phase2-config.test.js
  unit/cloudinary-provider.test.js
  helpers/fake-media.provider.js
~~~

Integration required only extending app.js to mount modules/CORS methods, env.js for optional media settings, and errorHandler.js for optimistic-concurrency conflicts. No authentication/session infrastructure or original tests were rewritten. Unrelated deferred module folders remain placeholders.

## Phase 3 — discovery, job requests, matching and quotes

Phase 3 stops at an accepted commercial agreement. It does not create a Booking, reserve worker time, take payment or add messaging. No new package dependencies were needed. Authentication, sessions, verification badges and existing public-profile/media protections remain in place. A replica set is required for the existing Phase 2 transactions and the new job/quote lifecycle mutations.

### Worker discovery

GET /api/workers returns concise cards, not raw profiles. Optional filters: service (Service ID), category (Category ID), area (case-insensitive exact named area), q (escaped literal substring in profession/skills/service name), verified=true|false (approved identity verification), availableNow=true|false, pricingType and minRating (0–5). Combined service/category filters must describe the same Service. Unverified but professionally complete PUBLIC profiles remain browseable unless verified=true is requested. Quotes have a stricter approved-identity rule described below.

Pagination uses page (1–10000, default 1) and limit (1–50, default 20), with total, totalPages and hasNextPage. Sorts: relevance (approved identity first with stable ID tie-break; nearest first when coordinates are supplied), distance (requires coordinates), trust (approved identity first), rating (real stored average/review count only), and price. Price sorting requires a specific service and a numeric pricingType (FIXED/HOURLY/STARTING_FROM), avoiding comparisons between unlike trades/rate types. There is no recommendation score or AI. Existing ratings remain zero until genuine review functionality is built.

For nearby searches supply longitude and latitude together. Optional integer radiusKm defaults to DISCOVERY_DEFAULT_RADIUS_KM=25 and cannot exceed DISCOVERY_MAX_RADIUS_KM=200; operators can configure a maximum up to 500 km. Defaults cannot exceed the maximum. Empty/out-of-range coordinates, partial points, invalid radii and distance sorts without coordinates are rejected. GeoJSON uses [longitude, latitude]. MongoDB $geoNear uses the existing primaryLocation 2dsphere index, metres internally, and early visibility/service filtering. Aggregations have a five-second server time budget.

Cards expose IDs, display name, temporary professional image, profession, services, general areas, verification summary, pricing, existing counters and availableNow. Distances are rounded UP to five-kilometre bands (minimum 5 km), not returned in exact metres. Stored worker coordinates, account/security fields, contacts and verification documents are excluded. These limits reduce direct disclosure but do not guarantee anonymity against repeated geographic probing; the existing IP/global rate limit remains a V1 control, not a complete anti-enumeration system.

### JobRequest and customer controls

JobRequest stores customer and Service references, title, description, named serviceArea, optional private GeoJSON location and privateAddress, preferredDate/preferredTimeNote, budget, up to five owned JOB_ATTACHMENT image references, status, lifetime quoteCount, acceptedQuote, optional accepted agreement, expiry, shared mutation revision and timestamps. GeoJSON/privateAddress are returned only to the owning CUSTOMER management view; normal opportunities omit them and customer identity/contact data. Description/title are deliberately shared free text; customers should put residential details in privateAddress instead. V1 does not detect contacts/addresses intentionally typed into visible free text or shown inside photos.

Only CUSTOMER can create/manage their jobs. Workers and ADMIN cannot impersonate customer creation. Services/categories must be active; attachments must be owned images of JOB_ATTACHMENT purpose. Jobs default to a seven-day lifetime, with an explicit future expiresAt up to 30 days. Preferred dates must be within the next year when written. Preferred/proposed dates and notes express preferences only, not availability validation or reservations.

Budgets use integer safe bututs in GMD: FIXED requires amountBututs; RANGE requires minAmountBututs <= maxAmountBututs; OPEN_TO_QUOTES forbids monetary amounts. Incompatible fields, negative/fractional/unsafe values and arbitrary client statuses/owners/counters are rejected. No money moves.

Lifecycle: OPEN → QUOTE_ACCEPTED or CANCELLED; an OPEN resource with expiresAt in the past is effectively EXPIRED. The owner can update commercial fields only while OPEN and before the first quote ever submitted. quoteCount is lifetime submitted quotes, including later withdrawn/expired/rejected ones. This intentionally freezes the brief once a worker has invested in quoting; cancel and create a new request to change it. Cancellation closes unexpired PENDING quotes as REJECTED and already expired PENDING quotes as EXPIRED. Accepted jobs cannot use this OPEN-job cancellation path.

### Job attachments

JOB_ATTACHMENT is a customer-only media purpose, accepting JPEG/PNG only under existing 5 MiB, decode/re-encode and metadata-stripping controls. Workers cannot upload it; customers still cannot upload/access worker verification media. Existing PUBLIC image-purpose filtering excludes job attachments. All files remain authenticated provider assets.

The customer can retrieve their own attachment through /api/media/{id}/access. A matching eligible worker can request a 60-second link through GET /api/job-requests/{id}/attachments/{mediaId}/access while the job remains OPEN and relevant. The image must actually belong to that job and owner. Opportunity responses include only attachment IDs, never provider storage locators or URLs. Unrelated customers/workers cannot mint links. Previously issued bearer links can remain usable until expiry. Visible content in an uploaded photo is not automatically anonymized.

### Deterministic matching and eligibility

MatchingService is shared by opportunity lists/details, quote submission/updates and quote acceptance. Minimum quoting eligibility: current active WORKER account, complete eligible PUBLIC profile, all selected services/categories active, and APPROVED identity verification. Work-evidence review remains a stronger optional badge, not a formal professional license or mandatory quoting condition. Hiding/suspending a worker or deactivating required catalog data prevents normal opportunities/new quotes; acceptance rechecks current eligibility.

A match requires the requested Service and a normalized named area/country match. Region must match if both sides supply it. Normalization uses Unicode NFKC, whitespace folding and lowercase; no hardcoded town list. If both worker and job have coordinates, distance must also lie within the smaller of the worker's serviceRadiusKm and configured discovery maximum. If either location is missing, matching falls back to the declared area. Opportunities use MongoDB $geoWithin where applicable, active-customer filtering and bounded database pagination. Rule details are OFFERS_SERVICE, SERVES_AREA, IDENTITY_APPROVED and, when checked, WITHIN_SERVICE_RADIUS. Approximate proximity uses the same five-kilometre bands. No exact customer location is returned.

### Quote model and lifecycle

Quote references one JobRequest, WORKER and CUSTOMER. It stores proposedAmountBututs (nonnegative safe integer), GMD currency, a message up to 1500 characters, optional estimatedDurationMinutes (15–43200), optional proposedSchedule {date,note}, expiry, status and timestamps. Workers cannot select a different owner/customer or set status. Quotes default to three days, capped by the job expiry; explicit expiry must be future and no later than the job expiry or 14 days. Proposed dates must be within the next year when written.

A unique (jobRequest,worker) index enforces one quote EVER per worker/job in V1. The owner may edit an unexpired PENDING quote or withdraw it, but cannot create another quote after withdrawal/expiry. This simple approach avoids an unnecessary revision/history system. Lifecycle: PENDING → ACCEPTED, REJECTED, WITHDRAWN or effective EXPIRED. Accepted/closed quotes cannot be edited. Customer comparison lists show quote terms and an eligible public worker card, never worker contact details; unavailable/hidden worker cards become null. Other workers cannot read competing quotes or another worker's private quote management endpoints.

Quote text is bounded plain text. Full contact-sharing detection belongs to the messaging phase; it is not implemented here.

### Acceptance, concurrency and expiration

POST /api/quotes/{id}/accept requires the JobRequest-owning CUSTOMER. Inside one MongoDB transaction it verifies the quote/customer relation, conditionally writes the shared OPEN/unexpired JobRequest revision, validates PENDING/unexpired quote and current matching eligibility, marks the quote ACCEPTED, closes competitors and writes QUOTE_ACCEPTED, acceptedQuote and an agreement snapshot on the job.

All pending quote edits/withdrawals, submissions, job changes/cancellations and acceptance use the same job revision write. This is essential: transactions alone with read-then-insert would not serialize related operations. Competing transactions conflict, retry with fresh state, and the loser sees the closed job. A partial unique index additionally permits at most one ACCEPTED Quote per job. No in-process lock is used; API processes coordinate through MongoDB. Tests cover two simultaneous acceptances, acceptance racing an edit/late submission, duplicate submission and rollback if agreement persistence fails.

Expiration is evaluated on reads and actions, without a background scheduler. OPEN jobs and PENDING quotes can remain physically OPEN/PENDING in MongoDB after expiry while the API reports EXPIRED. Actions use server-time expiry conditions, so stale stored statuses cannot bypass expiry. Customer status-filtered job lists use effective status. A pending quote also expires when its still-OPEN parent job expires. Once ACCEPTED/QUOTE_ACCEPTED, the original offer expiry does not dissolve the agreement. No TTL index deletes business history.

### Phase 4 handoff and direct hiring

The accepted JobRequest.agreement snapshot preserves customer, worker, Service, JobRequest, accepted Quote, agreed amount/currency, duration estimate, proposed schedule, quote message, job title/description, general area and acceptance time. The API does not allow editing accepted terms. Precise location/address remain private on the now-immutable JobRequest; they are not included in worker opportunity/quote responses.

Phase 4 will load QUOTE_ACCEPTED plus its ACCEPTED Quote/agreement, revalidate the parties/catalog and scheduling inputs, then create exactly one centralized Booking through BookingService with idempotent acceptedQuote linkage. Actual start/end times, availability, conflicts, cancellation and payment policy belong there. A proposed date is not an appointment guarantee. Direct discovery returns the same worker User ID used by existing profiles, allowing the separately approved Direct Booking Proposal → worker acceptance → same BookingService path later. No DirectProposal or Booking model was added in Phase 3.

### Important indexes and authorization

- WorkerProfile: existing primaryLocation 2dsphere plus (profileVisibility,services) for public/service candidate filtering.
- JobRequest: (customer,createdAt,_id) for owner lists; (status,service,areaKey,expiresAt) and (status,expiresAt) for relevant unexpired jobs; location 2dsphere for geographic opportunity constraints.
- Quote: unique (jobRequest,worker); unique jobRequest only when status=ACCEPTED; (worker,createdAt,_id) for private lists; (jobRequest,status,expiresAt) for received quotes and closing pending/expired competitors.

Discovery is public with safe serializers. Job management/acceptance is customer-owner only; opportunities/quoting is active eligible-worker only. Private resources use ownership filters and safe 404/403 errors. Global rate limiting remains; marketplace write routes add per-IP 60-per-15-minute limits. All private/new discovery responses are no-store. No new administrative action was introduced, so normal customer/worker activity does not populate AuditEvent. Existing audited catalog and verification behavior remains unchanged.

### Phase 3 endpoint inventory

Paths are relative to /api:

| Method | Path | Access |
| --- | --- | --- |
| GET | /workers | Public discovery |
| POST | /job-requests | CUSTOMER |
| GET | /job-requests/me | CUSTOMER, own; optional status filter |
| GET | /job-requests/opportunities | Eligible WORKER |
| GET | /job-requests/{id} | Owning CUSTOMER |
| PATCH | /job-requests/{id} | Owning CUSTOMER; OPEN, no quotes |
| POST | /job-requests/{id}/cancel | Owning CUSTOMER; OPEN |
| GET | /job-requests/{id}/opportunity | Matching eligible WORKER |
| GET | /job-requests/{id}/attachments/{mediaId}/access | Owner or matching eligible WORKER |
| POST | /job-requests/{id}/quotes | Matching eligible WORKER |
| GET | /job-requests/{id}/quotes | Owning CUSTOMER |
| GET | /quotes/me | WORKER, own |
| GET | /quotes/{id} | Owning WORKER |
| PATCH | /quotes/{id} | Owning WORKER; PENDING |
| POST | /quotes/{id}/withdraw | Owning WORKER; PENDING |
| POST | /quotes/{id}/accept | Job-owning CUSTOMER |

POST cancellation, withdrawal and acceptance take no body (or an empty JSON object). Extra fields are rejected. Other list endpoints accept page/limit (max 50). Existing media endpoints additionally support customer-owned JOB_ATTACHMENT uploads/access without widening verification-media access.

### Manual Postman Phase 3 flow

1. Follow existing setup: MongoDB replica set, .env, npm ci, npm run dev. No new dependencies are required. Log in separate CUSTOMER and WORKER accounts. Give the worker a complete PUBLIC profile, active Service/area and ADMIN-approved identity verification using Phase 2 endpoints. Use a separate ADMIN account only for the existing catalog/verification setup.
2. GET /workers?service=SERVICE_ID&area=Brikama&verified=true&page=1&limit=20. Try longitude=-16.65&latitude=13.27&radiusKm=25&sort=distance. Check cards expose no exact coordinates or contact fields.
3. As CUSTOMER, optionally POST /media/JOB_ATTACHMENT with one multipart file named file. Save data.media.id. Customers need configured Cloudinary credentials for actual uploads; tests use the existing fake provider.
4. POST /job-requests with {service:'SERVICE_ID',title:'Repair a damaged electrical socket',description:'Please inspect and repair the damaged electrical socket in my room.',serviceArea:{name:'Brikama',region:'West Coast',country:'GM'},location:{type:'Point',coordinates:[-16.651,13.271]},privateAddress:'Private residential directions',budget:{type:'RANGE',minAmountBututs:20000,maxAmountBututs:60000},attachments:['MEDIA_ID']}. Omit attachments if no upload. Save jobId. GET /job-requests/me and /job-requests/{jobId} as its owner.
5. As WORKER, GET /job-requests/opportunities and /job-requests/{jobId}/opportunity. Verify match reasons, general area and absence of private location/address/customer contacts. Access an attachment only through the job-scoped attachment endpoint.
6. POST /job-requests/{jobId}/quotes with {proposedAmountBututs:45000,message:'I can inspect and repair this fixture.',estimatedDurationMinutes:90}. Optionally add proposedSchedule:{date:'FUTURE_YYYY-MM-DD',note:'Morning preferred'}. Save quoteId. GET /quotes/me; PATCH /quotes/{quoteId} to revise the pending offer, or POST /quotes/{quoteId}/withdraw to withdraw.
7. As CUSTOMER, GET /job-requests/{jobId}/quotes to compare worker cards/prices. POST /quotes/{quoteId}/accept with no body or {}. Confirm ACCEPTED quote, QUOTE_ACCEPTED job, matching acceptedQuote and complete agreement snapshot. No Booking/payment is created. A second acceptance or OPEN-job cancellation must fail.
8. With different customer/worker accounts, attempt private job/quote management and expect 404/403. To test cancellation, create a separate OPEN job and cancel it before acceptance. To test expiry locally, use future expiresAt values and wait; pending/OPEN reads report EXPIRED after the deadline and mutations fail.

Phase 4+ remains deferred: weekly availability, booking/direct proposals/conflicts/reservations, chat/voice/contact filtering, payments/ledger, completion/disputes/reviews, notifications, analytics and AI.

### Phase 3 verified result and relevant files

On 22 October 2026 the final complete npm test run passed 296 tests with 0 failures across seven files in 185.18 seconds. Phase 1: 74 unchanged tests; Phase 2: 112 unchanged tests; Phase 3: 103 integration tests plus seven configuration/distance tests (110 total). The pre-change baseline passed all 186 tests. Real temporary MongoDB replica sets exercised geo queries, lifecycle transactions, ownership checks, rollback and concurrent acceptance. External media remains fake in automated tests; no new live provider test was performed.

No dependencies were added. New environment settings: DISCOVERY_DEFAULT_RADIUS_KM (25) and DISCOVERY_MAX_RADIUS_KM (200, configurable up to 500). Only app/config mounting, the WorkerProfile discovery index and the media extension needed changes to existing runtime files; original authentication/session, catalog, verification services/serializers and all original test files remain unchanged.

~~~text
src/modules/
  discovery/   # query validator, eligibility pipeline/service, card serializer, controller/routes
  matching/    # deterministic service/area/radius eligibility
  jobRequests/ # model, validators, owner/opportunity DTOs, lifecycle service/controller/routes
  quotes/      # model, validators, private DTO, lifecycle/acceptance service/controller/routes
tests/
  integration/phase3.test.js
  unit/phase3-config.test.js
~~~

A combined service/category filter edge case found during review was corrected and covered before the final passing run. No unresolved runtime/test warning was observed. Remaining limitations include shared IP-based in-memory rate limiting, possible geographic inference under repeated probing, unredacted user-entered text/photo contents, shareable short-lived media links and no live Cloudinary test. These are documented limitations, not implementations of future moderation, tracking or messaging features.


## Complete V1 backend — Phases 4–9

The backend is a modular monolith. New routes keep HTTP handlers thin; services enforce ownership, trust, scheduling, state and money rules; Mongoose models provide references and indexes. Authentication, refresh rotation, protected verification media and the approved Phase 3 quote-acceptance transaction remain intact. No frontend or real payment integration is included.

### Run locally

Use Node.js 22.12+ on a supported even-numbered release (Node 24 used here). MongoDB **must be a replica set** for the complete marketplace. Atlas satisfies this requirement. For local development, initialize a single-node replica set and use `mongodb://127.0.0.1:27017/skilllink?replicaSet=rs0`. Do not run production data on the test memory server.

```powershell
cd backend
npm ci
Copy-Item .env.example .env
# Edit .env: replica-set URI, two independent random JWT secrets, exact frontend origin.
npm test
npm run dev
# Production process:
npm start
```

`GET /api/health` is process liveness. `GET /api/ready` returns 200 only with a connected database; otherwise 503. Startup validates configuration, connects to MongoDB and creates required indexes before listening. SIGTERM/SIGINT close Socket.IO/HTTP and the database with a shutdown deadline. Existing duplicate data that violates a unique index must be repaired before rollout; startup fails instead of silently omitting invariants.

### New environment settings

| Variable | Default | Meaning |
| --- | --- | --- |
| BOOKING_RESERVATION_MINUTES | 15 | Unpaid slot hold, integer 1–60 minutes |
| PAYMENT_PROVIDER | mock | Only the simulated provider is allowed |
| COMMISSION_BASIS_POINTS | 1000 | Integer 0–10000; 1000 = 10% |
| EMAIL_PROVIDER | disabled | No outbound email by default; injectable optional provider |
| TRUST_PROXY_HOPS | 0 | Verified reverse-proxy hop count, 0–5; never blindly trust forwarded IPs |

Existing settings remain: NODE_ENV, PORT, MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, FRONTEND_ORIGIN, MEDIA_PROVIDER, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, DISCOVERY_DEFAULT_RADIUS_KM and DISCOVERY_MAX_RADIUS_KM. `.env.example` lists every setting without real secrets. Production requires HTTPS frontend origin. Use an HTTPS reverse proxy and a restrictive network boundary; configure only the actual proxy hop count.

### Availability and the booking engine

Workers replace their recurring weekly intervals through `/availability/me`, using **Africa/Banjul** civil times and day numbers 0 (Sunday) through 6 (Saturday). Multiple non-overlapping intervals per day, blocked calendar dates and UTC time-off ranges are supported. V1 intervals do not cross midnight; split work across days instead. Booking timestamps are UTC, minute aligned, future, at most 24 hours and within one year. `availableNow` is only a profile indicator and cannot bypass any scheduling rule.

Both routes converge on BookingService:

```text
JobRequest → accepted Quote → POST /bookings/from-quote ─┐
                                                       ├→ BookingService → AWAITING_PAYMENT
Discovery → DirectProposal → WORKER accepts ────────────┘
```

An accepted quote authorizes work at its agreed amount; the customer selects an interval within the worker's published hours. Direct proposals include an exact proposed interval and require worker consent. Proposal states are PENDING → ACCEPTED / REJECTED / CANCELLED / EXPIRED. Acceptance creates the booking in the same transaction, so a scheduling conflict leaves the proposal pending.

The engine checks active accounts, approved identity/public profile, active service/category, area/radius relevance, recurring availability, blocked dates/time off and overlapping bookings. Every booking path, availability replacement and financial/lifecycle operation writes the same `WorkerScheduleLock` revision inside its transaction. The lock row is initialized safely before the transaction. This prevents two processes from reserving the same worker/time interval based on independent snapshots.

Overlap is `newStart < existingEnd && newEnd > existingStart`. Adjacent intervals are allowed. CONFIRMED, IN_PROGRESS, WORKER_MARKED_COMPLETED and DISPUTED block their occupied intervals. AWAITING_PAYMENT blocks only while its reservation is unexpired. Completed/cancelled records do not block future work.

An unpaid reservation expires lazily; reads present it as CANCELLED and conflict/payment checks enforce its deadline without waiting for a scheduler. It cannot subsequently be paid. Accepted-source booking creation is idempotent through unique quote/proposal indexes; an expired or cancelled source booking is not silently recreated. Use a new commercial agreement for a new booking. Participants can cancel unpaid reservations; paid active bookings use dispute/refund handling.

### Private messaging, images and voice

Conversations explicitly store their customer and worker. They reference a Quote (and thus JobRequest), DirectProposal or Booking. Only participants can create/access the context conversation, history, read state and message media. All messages persist before acknowledgement. `clientMessageId` is unique per sender/conversation; retries return the existing message and changed payloads conflict.

REST supplies paginated history and send/read operations. Socket.IO uses the same services and `handshake.auth.token` access JWT. Authentication checks the live session/account at connection and every action. Room joins require participant authorization; recipients are reauthenticated before delivery. REST remains usable without sockets. On reconnect, retrieve persisted history; no exactly-once network-delivery claim is made.

Socket events:

| Event | Payload | Result |
| --- | --- | --- |
| conversation:join | `{conversation: id}` | Authorized room membership |
| message:send | `{conversation: id, message: {type, text/media, clientMessageId}}` | Persisted message acknowledgement |
| conversation:read | `{conversation: id}` | Marks persisted messages read |
| message | Server event `{message: ...}` | Delivered only to authorized joined participants |

Client message types are TEXT, IMAGE and VOICE. SYSTEM is reserved for server messages. TEXT is bounded to 2000 characters. CHAT_IMAGE accepts decoded/re-encoded JPEG/PNG. VOICE_NOTE accepts bounded PCM WAV or Opus Ogg/WebM with container/header checks, maximum 5 MiB. The recording is uploaded by the client and played through a short-lived authorized media link. There is **no speech recognition or transcription**.

Contact protection normalizes text and rejects obvious +220/local numbers, emails and known contact/social URLs before a related booking is payment-confirmed. Labelled prices and measurements are exempted to reduce false positives. This is a conservative text deterrent, not foolproof moderation; images/audio and deliberately obfuscated text can disclose contacts. Quote/job free text is still bounded; the detector governs in-app text messages.

### Simulated payments and ledger

PaymentService depends on a provider contract; V1 injects MockPaymentProvider. **No real money, bank account, mobile wallet or escrow exists.** The provider simulates SUCCESS, FAILURE and PENDING with generated references.

A customer checks out only their unexpired AWAITING_PAYMENT booking. SUCCESS stores Payment as HELD, creates ledger events and confirms Booking atomically. FAILED/PENDING do not confirm or extend the reservation. A later attempt with a new idempotency key can resolve a pending/failed payment. Reusing a key with the same booking/outcome replays without another financial movement; changed requests conflict. One Payment per Booking and unique attempt/customer keys prevent duplicate payments.

All monetary inputs and stored movements are non-negative safe integer bututs. Commission uses `BigInt(amount) * BigInt(basisPoints) / 10000n`, rounded down to a butut. Worker amount is the remainder. For 100000 bututs at 1000 basis points: fee 10000, worker 90000. No floating-point currency arithmetic is used.

Payment states: PENDING/FAILED → HELD → RELEASED or DISPUTED → RELEASED/REFUNDED. A successful collection moves directly to HELD without persisting a separate transient SUCCESSFUL state. Refund is the full simulated amount; partial refunds are outside V1.

FinancialLedgerEntry is an immutable-through-API **event ledger**, not a double-entry banking ledger. CUSTOMER_PAYMENT, provisional PLATFORM_FEE and WORKER_PENDING_EARNING are recorded at hold; WORKER_RELEASE or full REFUND is recorded at settlement. Unique payment/type indexes prevent duplicate movements. Provisional fee entries are not recognized platform revenue after a refund. Admin revenue derives from RELEASED payments; balances derive from authoritative payment states. Aggregate butut values are returned as decimal strings to avoid overflow. Clients have no balance/ledger mutation endpoint.

### Completion, disputes and reputation

A WORKER starts a CONFIRMED booking only at/after its start. IN_PROGRESS → WORKER_MARKED_COMPLETED stores notes and optional owned COMPLETION_EVIDENCE images. The customer confirms completion: Booking becomes COMPLETED, Payment becomes RELEASED, the worker release event is inserted and completed count is recalculated in one transaction.

A customer may instead report a problem on a paid active booking. Booking/Payment become DISPUTED and a single Dispute is created atomically. ADMIN resolves an OPEN dispute with RELEASE_TO_WORKER or REFUND_CUSTOMER and a reason. Release completes the booking; refund cancels it. The decision, reviewer, time and AuditEvent commit with financial changes. Duplicate/illegal settlement is rejected.

Only the owning customer of a COMPLETED Booking may create its one Review. Rating is an integer 1–5; customers cannot create arbitrary directory reviews. ADMIN can hide/restore content but cannot change rating values. Worker rating/review/completed-job counters are recalculated from authoritative records under the worker lock, avoiding concurrent increment drift. Hidden reviews do not contribute to public ratings.

### Notifications and administration

In-app notifications cover quote/proposal changes, booking/payment transitions, messages, completion, disputes, verification decisions and reviews. Safe fixed text and resource IDs exclude contact details, locations, signed URLs and private document contents. Recipient/event-key uniqueness deduplicates retries. Users list/paginate, mark one/all read and count unread notifications.

Notifications are post-commit, best-effort effects; core marketplace actions remain successful if notification or optional email delivery fails. The default email provider is disabled; an injected provider can supplement selected important events. A durable delivery worker/outbox, opportunity fan-out and scheduled reminders are future operational improvements. No SMTP delivery is claimed.

ADMIN endpoints inspect users, bookings, payments, ledger, disputes and reviews, with actual database-derived marketplace metrics. Suspension/reactivation is audited, revokes sessions and increments token version; reactivation requires fresh login. Administrator accounts are protected from this marketplace suspension endpoint. Provision the initial administrator through a trusted operator/database process; public admin registration remains unavailable.

Metrics distinguish gross simulated collection volume, full refunds and recognized platform fees from RELEASED payments. Expired unpaid reservations count as cancelled. No real-money revenue is implied.

### Endpoint groups and API contract

Import `docs/openapi.json` into Postman. It documents all REST operations, body/response schemas, roles, errors and pagination; `x-socket-io` records realtime events. API base is `/api`.

| Group | Main paths |
| --- | --- |
| Availability | GET/PATCH `/availability/me`; PATCH `/availability/available-now` |
| Direct hiring | POST `/direct-proposals`; GET `/direct-proposals/me`, `/{id}`; POST `/{id}/accept`, `/reject`, `/cancel` |
| Booking | POST `/bookings/from-quote`; GET `/bookings/me`, `/{id}`; POST `/{id}/cancel` |
| Execution | POST `/bookings/{id}/start`, `/complete`, `/confirm-completion`, `/dispute`, `/reviews`; GET `/{id}/evidence/{mediaId}/access` |
| Messaging | POST `/conversations`; GET `/conversations/me`, `/{id}`, `/{id}/messages`; POST `/{id}/messages`, `/{id}/read`; GET `/{id}/media/{mediaId}/access` |
| Mock payments | POST `/payments/bookings/{id}/checkout`; GET `/payments/bookings/{id}`, `/payments/{id}`, `/payments/{id}/ledger`; GET `/finances/me` |
| Disputes/reviews | GET `/disputes/{id}`, `/workers/{id}/reviews` |
| Notifications | GET `/notifications/me`, `/notifications/unread-count`; POST `/notifications/read-all`, `/{id}/read` |
| Admin | GET `/admin/metrics`, `/health`, `/users`, `/bookings`, `/payments`, `/ledger`, `/disputes`, `/reviews`; PATCH `/admin/users/{id}/status`; GET `/admin/bookings/{id}`, `/payments/{id}`, `/disputes/{id}`; POST `/admin/disputes/{id}/resolve`; PATCH `/admin/reviews/{id}/moderation` |

Earlier authentication, catalog, profiles, verification, discovery, JobRequest, Quote and media endpoints remain documented and available.

### Complete manual Postman demo

Use `baseUrl`, `customerToken`, `workerToken`, `adminToken`, `serviceId`, `jobId`, `quoteId`, `proposalId`, `bookingId`, `conversationId` and media IDs as environment variables. Do not export real tokens/secrets with a shared collection.

1. Register CUSTOMER and WORKER through `/auth/register/customer` and `/worker`, then `/auth/login` for each. Obtain ADMIN login through trusted provisioning. ADMIN creates Category and Service; save service ID.
2. WORKER POST `/workers/me/profile` with profession, 20+ character bio, services, Brikama service area, `[longitude,latitude]` location and PUBLIC visibility. Upload ID using multipart `file` to `/media/IDENTITY_DOCUMENT`. POST `/verifications` with `identityDocument`; ADMIN PATCH `/admin/verifications/{id}` with `{"decision":"APPROVED"}`.
3. WORKER PATCH `/availability/me`: `{"weekly":[{"day":1,"start":"08:00","end":"20:00"}],"blockedDates":[],"timeOff":[]}`. Include the actual days needed for the demo. Toggle `/availability/available-now` if desired. Public GET `/workers?service={serviceId}&verified=true`.
4. CUSTOMER POST `/job-requests`: active service ID, title, description of at least 20 characters, `serviceArea:{"name":"Brikama","country":"GM"}`, optional private GeoJSON location and `budget:{"type":"OPEN_TO_QUOTES"}`. Upload optional JPEG/PNG JOB_ATTACHMENT first. WORKER GET `/job-requests/opportunities`.
5. WORKER POST `/job-requests/{jobId}/quotes`: `{"proposedAmountBututs":45000,"message":"I can inspect and repair the fixture.","estimatedDurationMinutes":60}`. CUSTOMER GET quotes and POST `/quotes/{quoteId}/accept` with `{}`.
6. CUSTOMER POST `/bookings/from-quote`: `{"quote":"<quoteId>","scheduledStart":"<future minute-aligned ISO UTC>","scheduledEnd":"<later ISO UTC>"}`. Choose a configured working day/time. Save booking ID. Attempt an overlapping direct-proposal acceptance to demonstrate 409 conflict; adjacent intervals are allowed.
7. Alternative direct route: CUSTOMER POST `/direct-proposals` with worker/service IDs, description, general area, optional private location, schedule and `agreedAmountBututs:45000`. WORKER POST `/{proposalId}/accept` with `{}`. AWAITING_PAYMENT booking is created without customer-forced acceptance.
8. Either participant POST `/conversations` with `{"contextType":"BOOKING","contextId":"<bookingId>"}`. POST `/{conversationId}/messages`: `{"type":"TEXT","text":"Please bring the testing tools.","clientMessageId":"demo-text-1"}`. Before confirmation, test an obvious phone/email message and expect CONTACT_SHARING_BLOCKED.
9. Upload CHAT_IMAGE or VOICE_NOTE using multipart `file`. Send `{"type":"VOICE","media":"<mediaId>","clientMessageId":"demo-voice-1"}`. Use participant `/conversations/{id}/media/{mediaId}/access` to play. Read REST history and POST `/read`. Socket clients connect with `auth:{token:workerToken}`, join the conversation and observe persisted message events.
10. CUSTOMER POST `/payments/bookings/{bookingId}/checkout`: `{"idempotencyKey":"demo-checkout-001","outcome":"SUCCESS"}`. Observe HELD and CONFIRMED. Repeat the same request: no extra ledger entries. FAILURE/PENDING can be demonstrated on separate unpaid reservations; new keys allow a later successful attempt before expiry.
11. At/after scheduled start, WORKER POST `/bookings/{id}/start` with `{}`. Upload optional COMPLETION_EVIDENCE, then POST `/complete` with `{"notes":"Work completed and tested.","evidence":["<mediaId>"]}`. CUSTOMER POST `/confirm-completion` with `{}`. Inspect RELEASED payment, ledger and `/finances/me` simulated earnings.
12. CUSTOMER POST `/bookings/{id}/reviews`: `{"rating":5,"comment":"Reliable and careful work."}`. Check public profile rating and `/workers/{workerId}/reviews`. Duplicate review fails.
13. On another paid booking, CUSTOMER POST `/bookings/{id}/dispute`: `{"reason":"Work quality","description":"The repaired fixture still fails to operate correctly.","evidence":[]}`. ADMIN inspect and POST `/admin/disputes/{id}/resolve`: `{"decision":"REFUND_CUSTOMER","reason":"Evidence supports the reported issue."}`. Alternatively use RELEASE_TO_WORKER. Inspect financial outcomes through admin APIs; AuditEvent records remain available for trusted operator/database inspection.
14. Read notifications, unread count, and mark all read. Inspect `/admin/metrics`. ADMIN suspend a marketplace user using `/admin/users/{id}/status`, verify access is revoked, reactivate and log in again.
15. For expiry, create an unpaid reservation and let its configured hold lapse. Payment and slot checks reject the expired hold. For cancellation, POST `/bookings/{id}/cancel` with a reason before payment.

Automated integration tests advance only their test clock for scheduled execution; production has no time-bypass endpoint.

### Security and deployment limits

Use `npm ci --omit=dev` for a production image, Node 22.12+/24, replica-set MongoDB and Cloudinary credentials for actual uploads. Keep storage authenticated; public images and authorized documents use short-lived links. No local filesystem persistence is required. Initial admin access, TLS, database backups, monitoring, secret rotation, storage retention and infrastructure access controls require operator setup.

The deployment target is a single API instance for V1. Rate-limit stores and Socket.IO delivery are in memory; multiple instances require a shared limiter/Socket.IO adapter and sticky polling transport or WebSocket-only deployment. Database worker locks and unique indexes still coordinate writes across processes. Socket.IO sockets close during graceful shutdown. Readiness does not prove external Cloudinary/email availability.

Signed links are shareable until expiry. Audio uses bounded container/header validation, not malware scanning/transcoding or speech analysis. Images/recordings and work descriptions may reveal information supplied by users; the platform cannot anonymize their contents. Disputes require human decisions. Reservation/offer expiry is lazy; no scheduled reminders, automatic completion or automatic release is implied. Notifications/email have best-effort delivery. This is an FYP simulated marketplace, not a production security certification or regulated financial system.

Strict future work remains real Wave/APS/Stripe/PayPal, real escrow, BNPL/lending, live GPS tracking, frontend/native mobile work, AI recommendations and Wolof/Mandinka/Fula speech recognition. Voice recordings are supported; recognition is not.

### Container preparation

A non-root Node 24 Debian container definition is supplied in `Dockerfile`; `.dockerignore` excludes local credentials, tests and installed dependencies. It installs production dependencies from the lockfile and uses `/api/ready` for its healthcheck. Supply runtime environment variables through the hosting platform's secret store. The Docker image has not been built or deployed in this environment; local Node/MongoDB integration tests provide the verified runtime results.

```powershell
docker build -t skilllink-backend:v1 .
docker run --rm --env-file .env -p 5000:5000 skilllink-backend:v1
```

Use a replica-set MongoDB address reachable from the container; `127.0.0.1` inside a container is not the host database. Do not copy `.env` into an image.


## Final V1 verification

Final complete command: `npm test` using Vitest 5.0.5 on Node 24 with a MongoDB test replica set.

| Phase | Passed | Failed |
| --- | ---: | ---: |
| Phase 1 | 74 | 0 |
| Phase 2 | 112 | 0 |
| Phase 3 | 110 | 0 |
| Phase 4 | 23 | 0 |
| Phase 5 | 18 | 0 |
| Phase 6 | 14 | 0 |
| Phase 7 | 17 | 0 |
| Phase 8 | 19 | 0 |
| Phase 9 integration + hardening | 37 | 0 |
| **Total** | **424** | **0** |

**14 test files passed. Duration: 385.77 seconds.** The original 296-test baseline remains passing; Phases 4–9 add 128 tests. Phase 9 comprises 7 integration tests and 30 unit hardening tests. The final advisory check reports 0 vulnerabilities. OpenAPI validation finds 0 unresolved references; all 22 models load and `.env.example` lists all 19 validated configuration settings.

Full delivery details, all models, dependencies, settings, architecture, limitations and deployment status: [Final backend report](docs/final-backend-report.md). No frontend or future-work features were started. No deployment was performed.
