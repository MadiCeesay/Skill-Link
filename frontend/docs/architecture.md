# Frontend architecture and API integration

Current maintenance: the [27 October manual-testing report](manual-testing-report.md) records the proposal/location/voice repairs and latest validation. Preservation statements and counts below describe their original delivery phase; the maintenance pass adds a strict WebM track parser and a documented participant-only proposal name summary without replacing the architecture.

## Inspection and preservation

The backend README, OpenAPI, architecture/final report, routes, validators, serializers, authentication, media providers, Socket.IO, payments and marketplace state machines were inspected before implementation. The original backend suite established a **424-pass, zero-failure** baseline. Backend source, tests and documentation were hashed before frontend work. No backend implementation or security policy was changed to accommodate the browser.

## Structure

```text
frontend/
  public/
    favicon.svg
    fonts/                 # locally served Manrope and OFL license
    images/                # illustrative licensed project photography
  src/
    main.jsx               # providers, lazy routes and role guards
    api/
      client.js            # envelope/error handling, memory session, refresh, uploads
      hooks.js             # cancellable cached reads and invalidating mutations
      auth.jsx             # account context, sign-in/out and role guards
      realtime.jsx         # authenticated active-conversation socket
    components/ui.jsx      # shared accessible forms, dialogs, media, tables and cards
    layouts/Layouts.jsx    # public layout and responsive role workspaces
    features/
      public.jsx           # home, catalog, discovery, public professional and information
      auth.jsx             # customer/worker registration, login, unsupported account flows
      dashboard.jsx        # actual role summaries and account view
      jobs.jsx             # customer requests, opportunities, quote comparison/management
      bookings.jsx         # proposals, booking lifecycle, mock payment, disputes and reviews
      worker.jsx           # onboarding/profile, portfolio, verification, availability, earnings
      messaging.jsx        # conversations, text/image/audio, recorder and read receipts
      notifications.jsx    # safe update list and read operations
      admin.jsx            # metrics, people, verification, catalog and marketplace operations
    styles/app.css
    utils/format.js        # exact money and explicit Banjul time formatting
    utils/policy.js        # presentation permissions; backend remains authoritative
  tests/
    browser/marketplace.spec.js
    live-server.mjs        # disposable real API, replica set and private media fixture
    preview-server.mjs
    client.test.js
    components.test.jsx
    format-policy.test.js
  docs/
  .env.example
  playwright.config.js
  vite.config.js
  eslint.config.js
```

The app uses JavaScript modules and feature-level lazy chunks. TanStack Query owns remote state; component state owns drafts and dialogs. Reads use abort signals, bounded pagination and explicit empty/loading/error states. Mutations invalidate API cache entries so related booking/payment/profile summaries stay consistent. Mutations are never retried automatically. The financial checkout retains its idempotency key for retries and exposes a separate new-attempt operation after failure/pending outcomes.

## Design and responsive behavior

The references inform the generous hero, professional cutout over a peach circle, orange category strip with circular icons, wide professional cards, connected four-step explanation, portrait recruitment section, black footer and orange dashboard sidebar. Following the user's visual correction, SkillLink uses orange accents, warm cream backgrounds, white surfaces and black pill buttons. Small orange text uses a darker shade for legibility, while semantic success/error colors remain distinct. Manrope, spacing, borders and controls are shared across roles. There are no invented social-proof counters or analytics charts. The generated hero is illustrative campaign artwork, never a real worker profile.

Desktop layouts use a fixed labeled sidebar and flexible content grids. At tablet widths grids collapse; at mobile widths a menu replaces the sidebar and customers/professionals get a compact bottom navigation. Messaging becomes a conversation-first view with a back link. Wide administrative tables scroll within their panels. Forms use visible labels, keyboard controls, native modal focus management, focus outlines, alerts, semantic buttons, minimum tap areas and reduced-motion styles. Automated viewport checks supplement screenshot inspection; this is not a formal WCAG certification.

## Routes and screens

| Audience | Browser routes |
|---|---|
| Public | `/`, `/services`, `/professionals`, `/professionals/:id`, `/how-it-works`, `/help`, `/privacy`, `/terms` |
| Account access | `/login`, `/register/customer`, `/register/worker`; informational recovery/reset/verification routes |
| Customer | `/app`, `/app/jobs`, `/app/jobs/new`, `/app/jobs/:id`, `/app/jobs/:id/edit`, `/app/proposals`, `/app/proposals/new?worker=…`, `/app/profile` |
| Professional | `/work`, `/work/opportunities`, `/work/opportunities/:id`, `/work/quotes`, `/work/quotes/:id`, `/work/proposals`, `/work/profile`, `/work/profile/portfolio`, `/work/profile/verification`, `/work/profile/reviews`, `/work/profile/account`, `/work/availability`, `/work/earnings` |
| Shared marketplace | Under `/app` and `/work`: `/bookings`, `/bookings/:id`, `/bookings/:id/payment`, `/messages`, `/messages/:id`, `/notifications`, `/disputes/:id`; customer `/app/bookings/:id/problem` |
| Administrator | `/admin`, `/admin/users`, `/admin/workers/:id`, `/admin/verifications`, `/admin/verifications/:id`, `/admin/catalog`, `/admin/bookings`, `/admin/bookings/:id`, `/admin/payments`, `/admin/payments/:id`, `/admin/ledger`, `/admin/disputes`, `/admin/disputes/:id`, `/admin/reviews`, `/admin/notifications`, `/admin/profile`; supported-limit pages `/admin/jobs`, `/admin/audit` |

## Endpoint map

All paths below are relative to `VITE_API_URL`, normally `/api`. DTO and validation behavior remain defined by `backend/docs/openapi.json` and backend services.

| Browser action | Existing backend contract |
|---|---|
| Register/sign in/session | `POST /auth/register/customer`, `/auth/register/worker`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Catalog browsing | `GET /categories`, `/services`, `/categories/:id/services` (discovery also filters by category) |
| Worker search/profile/reviews | `GET /workers`, `/workers/:id`, `/workers/:id/reviews` |
| Own professional profile | `GET, POST, PATCH /workers/me/profile` |
| Portfolio | `POST /workers/me/portfolio`; `PATCH, DELETE /workers/me/portfolio/:id` |
| Private verification | `GET /verifications/me`; `POST /verifications` |
| Upload/access | `POST /media/:purpose` multipart `file`; `GET /media/:id/access` |
| Requests | `POST /job-requests`; `GET /job-requests/me`; `GET, PATCH /job-requests/:id`; `POST /job-requests/:id/cancel` |
| Authorized project attachments | `GET /job-requests/:id/attachments/:mediaId/access` |
| Matched opportunities | `GET /opportunities`, `/job-requests/:id/opportunity` |
| Quotes | `POST, GET /job-requests/:id/quotes`; `GET /quotes/me`; `GET, PATCH /quotes/:id`; `POST /quotes/:id/withdraw`, `/quotes/:id/accept` |
| Direct hiring | `POST /direct-proposals`; `GET /direct-proposals/me`, `/direct-proposals/:id`; `POST /direct-proposals/:id/accept`, `/reject`, `/cancel` |
| Booking creation/lifecycle | `POST /bookings/from-quote`; `GET /bookings/me`, `/bookings/:id`; `POST /bookings/:id/cancel`, `/start`, `/complete`, `/confirm-completion` |
| Availability | `GET, PATCH /availability/me`; `PATCH /availability/available-now` |
| Payment/finance | `POST /payments/bookings/:id/checkout`; `GET /payments/bookings/:id`, `/payments/:id`, `/payments/:id/ledger`, `/finances/me` |
| Conversation/history/read | `POST /conversations`; `GET /conversations/me`, `/conversations/:id`; `GET, POST /conversations/:id/messages`; `POST /conversations/:id/read` |
| Shared conversation media | `GET /conversations/:id/media/:mediaId/access` |
| Completion issues/reviews | `POST /bookings/:id/dispute`, `/bookings/:id/reviews`; `GET /disputes/:id` |
| Authorized completion/dispute evidence | `GET /bookings/:id/evidence/:mediaId/access` |
| Notifications | `GET /notifications/me`, `/notifications/unread-count`; `POST /notifications/:id/read`, `/notifications/read-all` |
| Admin observability | `GET /admin/metrics`, `/admin/health` |
| Admin people | `GET /admin/users`, `/admin/workers/:id`; `PATCH /admin/users/:id/status` |
| Admin trust/catalog | `GET /admin/verifications`, `/admin/verifications/:id`; `PATCH /admin/verifications/:id`; `GET /admin/catalog/categories`, `/admin/catalog/services`; `POST /categories`, `/services`; `PATCH /categories/:id`, `/services/:id` (all management requires ADMIN) |
| Admin records | `GET /admin/bookings`, `/admin/bookings/:id`, `/admin/payments`, `/admin/payments/:id`, `/admin/ledger`, `/admin/disputes`, `/admin/disputes/:id`, `/admin/reviews` |
| Admin decisions | `POST /admin/disputes/:id/resolve`; `PATCH /admin/reviews/:id/moderation` |

The implementation uses only needed operations; this table describes the backend family, not a claim that every family member is called on every screen. Do not add unsupported endpoints for frontend convenience.

## Security, privacy and lifecycle handling

Auth tokens are memory-only and rotated through a single-flight refresh, with session epochs preventing late responses from restoring a signed-out account. Failed revocation/network logout still clears local credentials. Role guards improve UX; the server enforces ownership, role and active-account restrictions. Query caches clear on account changes. React renders untrusted text without HTML injection. Public cards consume deliberate public DTO fields; no raw document dumps appear in customer screens.

Discovery accepts service/category/area/text, available-now, verified, pricing, minimum-rating, bounded pagination, optional longitude/latitude/radius and supported sorting. Coordinates are GeoJSON **[longitude, latitude]**. Search displays approximate derived distance, never private stored points. Customers may enter private job/proposal coordinates; opportunity serializers expose general areas. Private booking fulfillment data is displayed only when the backend authorizes it.

Workers must be public, active, service/area-matched and identity-approved for marketplace quotes. Profiles can be built before approval. Skills/certificates do not imply formal licensing. Pending quotes alone are editable/withdrawable; quoted jobs have immutable terms. Acceptance is separate from booking creation; concurrent acceptance, conflicts, expiry and pending-payment holds remain enforced centrally by the unchanged API. UI actions follow these states and report stale/conflicting server decisions rather than guessing success.

Money input is decimal GMD converted using BigInt arithmetic to safe integer bututs; no floating-point multiplication is used. Aggregated totals returned as strings remain strings until exact formatting. Scheduling is explicitly Africa/Banjul and minute-aligned UTC on the wire, independently of browser timezone.

Uploads include bounded counts, accepted MIME hints, a 5 MiB client limit, progress and visible errors. The backend rechecks bytes, MIME, image processing, ownership and purpose. Single-file controls support replacement; successful files remain selected if a later file in a batch fails. Public portfolio is separated from private identity, chat, job, completion and dispute evidence. Signed access links are not persisted or logged by frontend code. Media previews periodically renew access while mounted. Removing an unattached file from a draft removes its reference; physical orphan cleanup remains a backend/provider retention concern.

The conversation socket authenticates with the current access token and explicitly joins the active authorized room. Changing conversations/accounts disconnects the previous socket. Incoming `message` events invalidate that room's cached history. Sending uses idempotent REST message creation with a unique `clientMessageId`; Socket.IO delivers events. Polling provides a fallback. Read operations update receipts. No unsupported typing/presence event is invented.

Voice recording requests microphone permission only on user action, checks Opus recording support, stops after three minutes, supports stop/preview/discard/cancel, releases tracks and blob URLs on cleanup and uploads through `VOICE_NOTE`. Existing WAV/Ogg/WebM files are an alternative when browser recording is unavailable. Audio playback requests relationship-authorized signed access. Background URL renewal preserves buffered audio; expired access can renew through the same authorized query and recover the playback position. The backend controls contact-sharing policy and rejects blocked messages; the client displays that explanation.

Admin consequential actions require a visible confirmation and reason where the backend requires one. Admin review notes remain in the admin verification workspace. Account suspension warns that sessions are revoked. Dispute decisions and review moderation call the actual audited server actions; there is no arbitrary ledger editing or balance mutation interface. Normal notifications display safe resource updates without leaking contact details.

## Explicit backend gaps

No supported endpoint exists for password reset/change, OTP/email verification, editing authentication identity fields, public worker free-slot calendars, administrator-wide job management or audit-event listing. These routes explain the gap. No mock success, fabricated list or weakened backend policy fills it. Persistent sign-in would require a separately approved secure cookie/BFF strategy; browser storage was deliberately not used. Actual support contacts, final legal terms, production retention/CSP policy and real payments are deployment/product work beyond the existing contracts.
