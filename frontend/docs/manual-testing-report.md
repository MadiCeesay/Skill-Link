# Final manual-testing repair pass — 27 October 2026

Later maintenance: the user requested removal of the two generated workers. They are now disabled and absent from public discovery; Musa and marketplace history are preserved. See [marketplace reliability and cleanup](marketplace-reliability.md). The demo credentials below describe the historical test pass and must not be used to repopulate the worker list.

This pass continues the existing SkillLink application. Authentication, MongoDB, Cloudinary, booking/payment state machines, contact protection, verification and the approved homepage were preserved. No existing users, Musa, workers, bookings or other marketplace history were deleted or reset.

## Problems, causes and repairs

| Problem | Root cause | Resulting behavior |
| --- | --- | --- |
| Technical proposal form | Generic contract fields were rendered directly, including coordinates and timezone names. | Four sections cover the service, job location, schedule and proposed GMD budget, with clear validation and helper text. |
| Precise location entry | Coordinate support existed without a usable capture control. | Explicit current-location button; no permission request on load; change/remove controls; denial/unavailability leaves town/address submission available. The same control supports private worker bases and nearby discovery. |
| Location privacy | The backend already distinguished general areas from precise fulfillment data. The UI lacked a useful authorized location action. | Pending proposals and unpaid worker bookings omit precise coordinates/address. Confirmed, backend-authorized booking details offer View job location. No raw coordinates are presented as ordinary form fields or chat context. |
| Electrician-only selector | The live database had one active category/service. Proposal choices correctly came from the selected professional's services. | Added missing services through authenticated admin APIs using an additive operator script. Existing/inactive records remain unchanged. Worker-specific proposal filtering is preserved and explained. |
| Multiple service areas | Add/remove already existed; duplicate towns were not clearly rejected before submission. | Multiple named areas are displayed publicly, with normalized duplicate-town validation and private base coordinates. |
| Chat negotiation stalled | Messages cannot alter structured price/state; the API has no proposal edit or counter-offer operation. | V1 formal revision: prepare revised terms, explicitly cancel the pending invitation, send the new proposal, and require professional acceptance. A failed replacement can be retried; cancellation is not rolled back or hidden. |
| Proposal actions were hard to find | Proposal navigation was absent from both sidebars and overview proposals were only counts. | Dedicated sidebar links, incoming/recent proposal panels, service/participant summaries, prices, statuses, messages, revise/cancel and accept/decline actions. |
| Unclear acceptance handoff | Acceptance created a booking, but left the professional on the proposal list. | Successful acceptance opens the returned booking. Customer cards link to it; unpaid bookings show Payment required and the checkout action. Backend conflict/uniqueness rules are unchanged. |
| Voice intermittently rejected | The WebM validator searched all compressed bytes for `V_`, rather than checking declared video tracks. Such bytes can occur in valid Opus payload. Client output handling also needed explicit format/container checks. | Parse EBML track metadata; require a single Opus audio track and reject video, incompatible codecs and truncated containers. Recorder uses supported MIME selection, complete-container output, actual chunk/recorder MIME, matching filename and signature checks. Backend validation remains authoritative. |
| Sparse chat context | Conversations displayed context type/reference with little structured information. | Authorized service, price, status, schedule and formal-terms/booking links. Chat never changes financial state. Sender styles, history pagination, image/audio media and contact protection remain. |
| Dashboard priorities | The existing compact overview already had real metrics/charts, but invitations and worker identity were not prominent enough. | Preserve its compact sidebar/header/KPIs, finance and real-data charts; add identity/photo/verification, incoming invitations and prominent messages, notifications and availability access. No decorative metrics were invented. |
| Live test account rejected | The previously saved customer is inactive. The API correctly enforces this. | Leave it inactive. Separate labelled manual-pass customer/worker credentials are generated in an ignored local file; the existing operator remains the administrator. |

The optional map-pin picker was not added. A customer away from the job site can supply the town and private address/directions; current-location capture explicitly warns that it should be used at the job site. There is no proprietary map subscription or new location backend. Opening a job location in an external map is a deliberate action available only when the authorized DTO includes it.

Other genuine limits remain: no structured professional counter-offer endpoint (the tested V1 replacement workflow is used), memory-only sign-in, and no supported account reset/OTP, public free-slot calendar or admin-wide job/audit listing APIs. Recording/playback was tested in Chrome; other browser engines and physical-device microphones still need device QA. Unsupported recording formats retain the existing audio-file fallback. Payments remain simulated.

## Verification and security

Worker evidence remains private and requires an administrator decision. The browser checks exercise a profile photo, identity document, certificate, work evidence, review and eligibility. The work-evidence approval option is available only when evidence was submitted. Synthetic live-demo evidence and review notes are labelled; this is not a claim of a real person's identity or qualifications.

All monetary mutations still go through formal server operations with integer bututs. Tokens remain memory-only; after reload, sign in again. JWT rotation, RBAC, ownership, payment idempotency, ledger transactions, disputes, unique reviews and availability checks remain in force. Private coordinates are omitted from discovery/proposal/chat summaries and logs. The external maps link does not bypass booking authorization.

## Validation record

- Backend: **434 passed, 15 files**, full regression run; no failures.
- Frontend: **67 passed, 10 files** in the latest complete unit/component run.
- Browser: **20 passed** in the final complete marketplace run (6.6 minutes), including proposal/location controls at **375, 768, 1024 and 1440px**. Both-direction recorded audio and playback after reload/re-login passed against the isolated real API. Screenshots of mobile proposals, desktop professional overview and mobile admin overview were visually inspected.
- Final lint passed; refreshed production build passed (1,687 modules, 7.73 seconds).
- Configured-secret scan found **0 exposures** in frontend source, public assets and build.
- Read-only live preflight: Atlas connected, transaction support present, API ready, Cloudinary authenticated.
- Live run: fresh customer/worker registration; professional profile with multiple areas; profile-image rendering; portfolio; protected identity/certificate/work evidence; administrator approval; public discovery/matching; job, quote, booking and held mock payment; actual-time start/completion/customer confirmation; released funds and unique review; opt-in proposal location; formal GMD 500 → 650 revision; acceptance/booking/payment; protected location after confirmation; pre-confirmation phone/email/WhatsApp blocking; private dispute evidence, resolved administrator UI and persisted simulated refund all verified against Atlas/Cloudinary. This evidence was collected through staged runs/resumption, not one uninterrupted run.
- A standalone Chrome probe generated `audio/webm;codecs=opus` (15,665 bytes) and the backend accepted its actual WebM container. The historical manual-test recording is unavailable, so the exact bytes that triggered its error cannot be retrospectively inspected; the defective raw-byte video test has a regression case.
- Live automation encountered both authentication and global request limits. Their Retry-After windows were respected; limits and account restrictions were not relaxed. The original saved customer remains inactive.
- **Final live voice check passed at 00:51 UTC on 27 October 2026:** professional → customer and customer → professional recorded WebM notes uploaded to the real Cloudinary provider, persisted as messages, played in the recipient browser, and played again after both browsers reloaded and signed back in. Returned media metadata was `audio/webm`, 12,852 and 12,737 bytes respectively. No audio contents, credentials or signed URLs were printed or copied into local diagnostic evidence files.

Isolated tests use disposable MongoDB and a test media provider. Live checks use Atlas/Cloudinary and retained labelled demo records. Synthetic microphone input exercises the real browser recorder. These are distinct kinds of evidence.

### Final role outcomes

- Customer: registration, discovery, proposal/location capture, formal price replacement, payment, messaging/voice, confirmation/review and problem reporting verified.
- Professional: profile/photo, multiple areas, verification, matching/quotes, proposal acceptance, authorized location access, work completion, simulated earnings/reputation and messaging/voice verified.
- Administrator: live catalog, evidence review/approval, private dispute evidence and a persisted refund with a visibly resolved screen verified. Broad role/catalog/record/responsive regressions also passed in the isolated suite.

The application checks are complete for this repair scope. All live stages passed through staged runs and safe resumption; it would be inaccurate to describe them as one uninterrupted run. No production deployment or cross-browser certification is claimed.

## Changed files

- Backend: `src/modules/media/audio.validator.js`, `src/modules/bookings/booking.service.js`, `docs/openapi.json`, `tests/unit/audio-webm.test.js`, `scripts/seed-demo-catalog.mjs`, `scripts/check-demo-accounts.mjs`.
- Frontend flows: `src/features/proposals.jsx`, `bookings.jsx`, `jobs.jsx`, `worker.jsx`, `public.jsx`, `messaging.jsx`, `dashboard-overview.jsx`.
- Shared frontend: `src/components/JobLocation.jsx`, `src/utils/voice.js`, `src/utils/format.js`, `src/api/realtime.jsx`, `src/main.jsx`, `src/layouts/Layouts.jsx`, `src/styles/app.css`.
- Test/demo support: `tests/location.test.jsx`, `tests/browser/manual-polish.spec.js`, `tests/browser/marketplace.spec.js`, `scripts/live-integration.mjs`, `scripts/live-journey.mjs`, `scripts/check-browser-audio.mjs`, `scripts/finish-live-dispute.mjs`, `scripts/verify-live-voice.mjs`, and this report.

The proposal response adds only participant-visible customer first/last names; the OpenAPI schema documents that additive field. It does not add contact information or a new endpoint.

## Exact FYP demonstration sequence

Use separate browser profiles for customer, professional and admin. For this pass, dedicated local credentials are in ignored **`backend/.local-integration/manual-pass-accounts.json`**. Do not publish that file or show it while screen-sharing. Previous account credentials and account states are preserved.

1. Start the existing API and frontend; use `http://localhost:5173`. Run `node scripts/check-integration.mjs` from `backend/`. Require all preflight checks to pass.
2. Admin: open Catalog. Show real active categories/services. For a new development database, inspect with `node scripts/seed-demo-catalog.mjs`; `--apply` adds only missing demo entries through authenticated APIs.
3. Professional: create/edit the profile, add a photo, selected services and Brikama/Farato/Yundum/Faraba. Demonstrate duplicate-town validation. Set working hours and submit private identity/certificate/work evidence.
4. Admin: inspect each submitted document, approve/reject with an appropriate note, and set Work evidence reviewed only when supported. Do not imply synthetic evidence verifies a real identity.
5. Customer: discover the verified professional, inspect the photo/services/general areas, then send a proposal with a town, description, schedule and GMD 500. Optionally press Use my current location while at the job site; demonstrate permission denial or Remove location without blocking town-only submission.
6. Professional: open Incoming proposals. Show service, customer, area, schedule and price. Discuss GMD 650 by text/voice; explain that chat leaves GMD 500 unchanged.
7. Customer: choose Revise proposal, enter GMD 650, then explicitly Cancel old & send revised proposal. Professional formally accepts the new invitation and is taken to the created booking.
8. Customer: open that booking and run the mock payment. Professional: see confirmation and View job location. No precise job coordinates/address are disclosed before the authorized stage.
9. At the real scheduled start, professional starts work and submits completion notes/evidence. Customer confirms completion. Show released simulated funds, earnings/payment activity and one genuine or explicitly demo-labelled review. Revisit to confirm duplicate review is unavailable.
10. Open the conversation in both profiles. Send text, image and recorded voice in each direction. Reload, sign back in and play the persisted voice messages. Test pre-confirmation contact blocking on a separate unpaid agreement.
11. On a separate paid demo booking, customer reports a problem with private evidence. Admin reviews and records a reasoned simulated refund/release. Inspect the resulting payment/booking state and notifications.
12. Revisit customer, professional and admin overviews at mobile and desktop widths. Counts, balances, ratings and pending actions must reflect real records; payments remain explicitly simulated.

Do not edit database booking dates/statuses to accelerate the demonstration. Use a near-future valid slot and wait for its actual start. Respect HTTP 429/Retry-After when repeatedly automating multiple roles from one IP.

The full labelled live runner is `node scripts/live-integration.mjs --manual-pass` from `frontend/`; it intentionally creates demo marketplace records. For an existing recorded run, `--manual-pass --continue` resumes the recorded agreement. The scoped `finish-live-dispute.mjs` checks/resolves the existing demo dispute without reopening it, and `verify-live-voice.mjs` sends synthetic notes and checks persisted playback for the current recorded booking. Credentials and resource evidence remain in the ignored backend local-integration folder, outside frontend assets and builds. Standalone assertions use the same bounded 20-second wait as the browser suite; a UI assertion timeout does not undo an already-committed transaction, so persisted state is checked before retrying a consequential action.
