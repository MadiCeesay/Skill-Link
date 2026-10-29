# Homepage/admin reliability and demo-worker cleanup — 27 October 2026

Both reported screens returned the backend's global HTTP 429 response. This was shared request exhaustion, not missing catalog or ledger data. The global 300-request/15-minute rule, authentication limits, RBAC and media authorization were preserved.

Repairs:

- Expose Retry-After and rate-limit response headers to the exact allowed browser origin. The previous frontend could not read the cooldown header through CORS.
- Coordinate a client-side cooldown across API calls after a global 429. Polling waits until the deadline, retry buttons show a countdown, and no financial or other mutation is retried automatically. Authentication-specific limits do not block public browsing.
- Retain previously loaded data during temporary network/server/rate-limit failures, with an explicit notice. Authorization failures still hide restricted data.
- Replace broad active-query refetches after unrelated actions with relevant resource refreshes; other cached resources become stale for their next visit.
- Stop renewing every mounted protected image/avatar link every 45 seconds. Loaded images and buffered audio stay usable; new access is requested on mount or when needed. Real-time chat uses socket events and retains slower offline history polling.
- Keep immediate freshness when opening a booking, so payment and location-authorization changes appear promptly.
- Cache the public catalog longer, while admin catalog changes still invalidate it. Correct the homepage error layout to span the service strip rather than occupy one narrow card.
- Replace index-based service icons with semantic mappings. Carpentry, electrical, plumbing, painting, masonry, cleaning, tailoring and appliance repair now retain matching tools/icons after sorting or searching. Unknown future services get a neutral tool icon; no fake catalog records are introduced.

The two exact generated worker identities were resolved from the ignored original/manual-pass credential artifacts. Both were named Integration Professional, with worker IDs `6add872c1c357b3bb8d632d6` and `6adfef18aa0ddab68ab1d289`. The existing audited account-status API disabled those two accounts and revoked their sessions. Their public profiles return 404 and they no longer appear in discovery. Historical bookings, payments, reviews, verification and audit records remain intact. Musa and unrelated users were not changed.

The user will add their own professionals. Do not run old live-demo setup tools to repopulate these generated workers. The earlier manual-testing report describes historical test accounts and results; those demo worker credentials are intentionally no longer active.

Live verification confirmed homepage services and the admin ledger loaded successfully, the generated workers were absent, Musa remained public, and all eight live catalog services used matching icon families.

Validation: 435 backend tests passed (16 files), 81 frontend tests passed (11 files), lint passed and the final production build passed (1,690 modules). Twenty browser scenarios passed in the broad run; the cooldown recovery and booking-freshness cases initially exposed issues and then both passed after their corrections. Thus all 22 scenarios were verified across the broad run and targeted reruns, not one uninterrupted clean run. The configured-secret scan found zero exposures. Disposable browser-test servers were stopped after assertions completed; the user's live API/frontend were left running.
