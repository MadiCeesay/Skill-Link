# Private quote requests and flexible pricing

This change extends the existing private DirectProposal flow. It does not replace public JobRequest/Quote records, existing proposals, BookingService, messaging, verification, payment, ledger or media storage.

## Architecture found and cause

WorkerProfile already publishes FIXED, HOURLY, STARTING_FROM and QUOTE_REQUIRED pricing. Public job requests already have optional budgets, owned JOB_ATTACHMENT photos and professional quotes. Private proposals previously required agreedAmountBututs in the form, validator and model; worker acceptance immediately created a booking. That forced customers to propose a total even for uncertain repair work. Public Quote records require a public job relationship, so this change keeps private quotes in their existing DirectProposal context.

## Customer and professional experience

- New private proposals default to Request a quote with no invented amount. A positive min/max budget is optional and clearly labelled as a guide.
- A genuine positive FIXED service additionally offers Use listed price. The browser sends the displayed listing amount and the server checks it against the current worker configuration, then stores its own snapshot. A changed listing requires a refresh. Worker acceptance still creates the booking.
- STARTING_FROM shows that the final price depends on scope. HOURLY displays the rate and explains that hours are not tracked/billed automatically. Both require an agreed formal total before booking.
- Customers can upload, preview and remove up to five job images using the existing protected upload infrastructure, with progress/errors and submission disabled during upload. Replacement requests retain selected previous photos.
- Workers see the brief, general area, preferred schedule, optional budget/photos, messaging and Send quote. Notes explain labour/materials/transport inclusions. Precise location/address stay hidden until the existing authorized paid-booking stage.
- Workers can revise an unaccepted quote. Previous versions remain visible as superseded. Customers see the current formal quote, its expiry, Accept quote and Decline quote.
- Acceptance leads straight to the booking screen. The existing mock checkout, start/completion, customer confirmation, settlement, disputes and review lifecycle follows unchanged.
- Dashboards surface requests/quotes; existing notification links lead to proposals. Existing proposal conversations and Socket.IO/voice continue unchanged. No chat text sets prices or constitutes acceptance.

## Domain/API additions

DirectProposal adds pricingMode, optional budget, attachment IDs, a fixed listing snapshot, quoteRevision, and bounded quote history. Existing records without pricingMode retain their legacy worker-acceptance behavior. No data migration or deletion is needed.

New routes:

| Method | Route | Actor |
| --- | --- | --- |
| POST | /api/direct-proposals/:id/quote | Assigned worker; amountBututs, expected current revision, optional note/expiry |
| POST | /api/direct-proposals/:id/accept-quote | Owning customer; exact current quote revision |
| POST | /api/direct-proposals/:id/decline-quote | Owning customer; closes the request |
| GET | /api/direct-proposals/:id/attachments/:mediaId/access | Owning customer or assigned worker; linked images only |

All new monetary inputs are positive safe integer bututs (100 = GMD 1). The budget is never copied into a booking. Until formal customer acceptance, quote requests have no agreedAmountBututs. Booking/payment amounts come from the stored current professional quote.

Quote sends, revisions, acceptance and cancellation serialize through the existing database worker lock. Acceptance checks current version/expiry and uses the same transactional booking factory, eligibility, availability, conflict checks and unique source index. Retries of the same accepted quote return the same booking. A stale quote cannot accept a revision or create a duplicate booking. Booking creation and acceptance roll back together on conflicts. Neither requests nor quotes reserve a slot.

The request deadline remains the earlier of three days and preferred start. Quote expiry defaults to that deadline and may be shortened. A quote can be revised while the request is still open, including when the previous quote expired. At most 100 revisions are allowed. Accepted amounts/history are immutable through these actions.

Photo access verifies the persisted participant relationship and linked owned JOB_ATTACHMENT reference. Generic/public access is not expanded. Existing image decoding, size/type validation, metadata removal and Cloudinary authenticated delivery remain unchanged. Notifications use the existing post-commit best-effort system, with quote revision deduplication keys and no private descriptions or addresses in messages.

## Verification and limits

Backend coverage adds price-free requests, budget validation, actual fixed-price validation, quote revision history, stale/expired acceptance, participant/verification checks, conflict rollback, concurrent idempotent booking creation, private attachments and exact payment amounts. Browser coverage runs real HTTP/UI requests against an isolated MongoDB replica set for all pricing paths, photo delivery, revised quotes, payment, completion and review. The isolated browser fixture uses a protected in-memory media provider; it does not provision workers or mutate the user's Atlas database. Existing Cloudinary adapter tests remain part of the backend suite.

This version agrees one fixed total before payment. It does not implement timesheets, variable post-booking invoices, separately paid inspections or automatic material cost calculations. Inspection needs can be discussed before sending a formal quote. Existing public job-posting quotes still have their original separate acceptance/scheduling workflow.

## Final results — 27 October 2026

| Check | Result |
| --- | --- |
| Complete backend suite | 446 passed, 16 files |
| Complete frontend suite, final standalone run | 81 passed, 11 files |
| Complete browser suite | 25 passed, exit code 0 |
| ESLint | Passed |
| Production build | Passed, 1,690 modules |
| Configured-secret scan | 59 frontend source/build/documentation files, zero exposures |

The backend suite includes 11 added private-quote integration cases. The browser suite adds three full pricing journeys and updates existing fixed-price and location regressions to exercise their appropriate formal agreement steps. The quote-required journey includes professional start/completion, customer confirmation, settlement and a genuine review. An intermediate frontend run overlapping backend/browser/build work hit two five-second timeouts in existing tests; the complete standalone rerun passed all 81 without changing their timeout settings or assertions.

The existing user's Atlas records, Musa's account and service areas, and previously disabled generated workers were not changed. Browser accounts exist only in the disposable test database. No real payment or deployment was performed.
