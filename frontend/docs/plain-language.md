# Plain English and simpler layouts — items 11–16

This pass changes frontend copy and presentation. It does not add or change backend routes, stored data, request payloads, authentication, pricing, role checks, media access, payment outcomes or booking transitions.

## Terms

| Word | What the user sees | Existing routes retained |
| --- | --- | --- |
| Requests | Work posted by a customer; matched work for a worker | `/app/jobs`, `/work/opportunities` |
| Offers | Prices and terms exchanged before booking | `/app/proposals`, `/work/quotes`, `/work/proposals` |
| Bookings | Agreed work and its progress | `/app/bookings`, `/work/bookings` |

Workers use “Offers sent” and “Offers received” to distinguish the two existing pages. Dashboard cards, sidebars, mobile navigation and related actions use the same main words. API identifiers such as Quote and DirectProposal remain unchanged.

## Requested changes

11. Removed static notices about missing features from sign-in/register, My account, Forgot password, admin Requests and admin activity. Sign-in/register no longer show the obsolete memory-only session notice. Forgot password still links back to sign-in; no reset form, code or email-delivery promise was added. Account details remain read-only and genuine request errors still appear.
12. Payment, booking-payment, earnings and admin finance screens use a shared small “Simulated payment · no real money moves” label. Other headings, actions, status chips and helper text use ordinary payment wording. Payment result choices, idempotency keys and requests remain unchanged.
13. Replaced quote/proposal terminology in presentation with Requests, Offers and Bookings. Existing counts keep their existing data sources. The admin accepted-offer total remains global and excludes private offers/archived demo work as before.
14. The workspace header identifies the account type instead of repeating a greeting. Customer/worker dashboards retain their one “Hello, name” heading.
15. Replaced the customer's “Your project desk” with “Next booking”, using the already-loaded booking query. The card shows service, person, time, status and the next step. It links to the existing booking or payment page; rendering/clicking the card does not submit a payment, start work or confirm completion. Completed/cancelled bookings and expired unpaid holds are excluded. Existing worker-profile controls and Messages/Notifications links remain.
16. Admin headings and explanations use plain language. Removed endpoint/API/V1 implementation notes and replaced transaction/reputation-counter wording with user-facing consequences. Review, status-change and dispute confirmation actions retain their existing validation and permissions.

Page headings and empty states were simplified in the affected workspaces. The orange design, existing components, pagination, loading/error states and routes are retained.

## Checks

Existing component assertions and browser selectors were updated where the requested text changed. The next-booking checks verify the existing payment/completion link destinations and that rendering performs no mutation. Desktop/phone browser checks cover a single greeting, matching navigation words, next-booking context, one payment label and the absence of developer notices on the named pages. The isolated browser harness uses its own replica set and media provider, without accessing live Atlas demo data.

Verified 15 November 2026:

- 103 frontend tests passed across 12 files, using one worker and a 20-second per-test timeout. Five initial failures were expectations for intentionally replaced copy; those expectations were updated, with no assertions about permissions or actions removed.
- The isolated browser journey passed at 1440px and 375px for customer/worker dashboards, booking/payment views and messages. It also checked register, sign-in, Forgot password, My account and admin Requests/activity/finance pages. It verified one greeting and one demo label on each checked payment screen. The confirmation run passed after the final text/spacing changes.
- Desktop/phone screenshot review confirmed the next-booking card, short headings, matching navigation words, payment labels and admin request explanation. Added spacing separates the main booking action from Messages/Notifications.
- ESLint and production build passed. Configured-secret scan: 62 files, zero exposures. No new backend or environment-file changes were made for this pass.
## Work hours and People controls — items 21–23

Work hours offers a Monday–Saturday 08:00–18:00 preset. Each working day can copy
all its intervals, including breaks, to Monday–Friday while keeping weekend hours.
Empty days say “Not working”. These controls only edit the form; Save availability
still validates and saves through the existing endpoint, including booking constraints.
Blocked dates and time off are unchanged by the presets.

The customer dashboard gives Find a professional and Post request matching primary
buttons beside the greeting. People supports name search and a role filter through
`GET /admin/users?q=...&role=...`. Filters run before pagination and reset the page to
one when changed. Search is submitted explicitly; Clear filters restores all people.
The endpoint remains admin-only and returns the existing safe user summary.

