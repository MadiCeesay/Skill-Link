# Authenticated dashboard refinement — 26 October 2026

## Scope and visual direction

The supplied orange-sidebar dashboard was the primary reference for density, hierarchy, rounded cards, utility controls, booking timelines and financial grouping. The professional dashboard follows that structure most closely. Customer and admin overviews use the same visual system with role-specific content.

The approved public homepage, authentication/RBAC, backend code/contracts, provider settings and marketplace business logic were preserved. No marketplace records were created for the redesign. Browser tests use their existing disposable database; live previews only signed into the existing local accounts, read their dashboards and signed out.

## Files

- `src/features/dashboard-overview.jsx`: shared current-state breakdown, booking timeline, simulated finance widgets, and connected customer/professional/admin overview compositions.
- `src/features/dashboard.jsx`: preserves the existing Dashboard export and Account screen; delegates the overview to the new composition.
- `src/features/admin.jsx`: preserves administrative screens/actions; delegates only AdminDashboard to the new composition.
- `src/layouts/Layouts.jsx`: refined utility header, functional marketplace search for customers/professionals, compact navigation, mobile drawer and keyboard behavior.
- `src/styles/dashboard.css`: authenticated-workspace styling, responsive grids, charts, cards and typography. Selectors are scoped to the workspace or unique overview components; public-page styling remains in the existing stylesheet.
- `tests/dashboard.test.jsx`: data fidelity, role-specific widgets, connected links, loading/errors, empty charts, new-worker onboarding and upcoming-booking ordering/exclusions.
- `tests/browser/marketplace.spec.js`: overview screenshots for all roles at the four widths, search navigation, admin search omission and mobile drawer interaction.

## Role overviews and data mapping

| Widget | Existing API/source | Behavior |
| --- | --- | --- |
| Admin KPI pills | `/admin/metrics` | Exact server totals for users, approved identities, completed bookings and open disputes. |
| Admin review desk | `/admin/verifications`, `/admin/disputes`, `/admin/metrics` | Actual pending applications and recent open dispute cases. Resource links open the existing review screens; full queues remain accessible. When recent disputes do not include an open case but the aggregate indicates pending cases, the panel points to the complete queue. |
| Admin recent bookings | `/admin/bookings?page=1&limit=3` | Recent records with actual schedules, descriptions, named areas and statuses. |
| Admin marketplace breakdown | `/admin/metrics` | Current booking status distribution and actual request/review/professional totals. This is not a historical trend chart. |
| Admin recently joined | `/admin/users?page=1&limit=3` | Real names, role, join date and account state. Worker rows link to existing worker inspection; other rows link to People. No private contacts are displayed. |
| Admin simulated finances | `/admin/metrics` | Actual gross collection, platform fees and refunds in GMD, explicitly labelled simulated. Links to existing payment/ledger screens. |
| Professional KPIs/reputation | `/workers/me/profile` | Authoritative completed-job count, review count/rating, profile completion, visibility and verification status. A new worker without a profile gets an onboarding state. |
| Opportunities / customer requests | `/job-requests/opportunities` or `/job-requests/me` | Real request title, named area, quote count, timing and status; View opens the correct role route. No customer identity/contact is invented. |
| Proposals and conversations | `/direct-proposals/me`, customer `/conversations/me` | Server pagination totals; all-proposal counts are labelled as such rather than being misrepresented as pending-only counts. |
| Upcoming booking timeline | `/bookings/me?page=1&limit=50` | Future CONFIRMED/AWAITING_PAYMENT records sorted by start time; cancelled, completed and past appointments are excluded. If more than 50 records exist, the recent-record scope is displayed. The backend has no global upcoming-sort/filter endpoint. |
| Professional earnings | `/finances/me` | Current pending and released simulated balances, exact butut-to-GMD formatting, and a balance breakdown. No unsupported withdrawal action. |
| Customer booking activity | `/bookings/me?page=1&limit=50` | Explicitly labelled recent-record status breakdown. No invented all-time completion count. |
| Customer next steps | Recent booking states and existing routes | Unpaid reservations link to simulated checkout; worker-completed bookings link to confirmation details. General booking/proposal/update actions remain available. Review eligibility stays server-controlled on the booking detail page. |
| Header notifications/profile | Existing unread-count endpoint and AccountAvatar | Real unread indicator and protected professional photo access are preserved. |
| Header search | Existing `/professionals?q=…` discovery | Customer/professional search navigates to real professional/skill discovery. Admin has no pretend global search field. |

## Reference elements adapted

Compact orange navigation with circular icons and a clear active pill; white utility header; personalized professional greeting; real search where supported; notification/account controls; compact KPI pills; prominent request/review cards; timeline appointments; lower-row current-state analytics, reputation and simulated financial summaries; restrained shadows, warm surfaces, dark actions and orange highlights.

The reference’s gardening content, Sri Lankan currency, fabricated percentages/history, customer identities, appointment samples and withdrawal control were not copied. SkillLink lacks historical dashboard trend series, worker most-requested-service aggregates, withdrawal functionality, and a searchable admin-wide backend API. Current aggregates and useful real-data panels replace those decorations. Empty datasets remain empty rather than generating fake activity.

## Responsiveness and accessibility

- 1440px: readable compact sidebar; four KPIs; two operational panels; three lower panels.
- 1024px: reduced sidebar/spacing; layout stays information-dense with bounded content.
- 768px: icon rail with named link titles, two-column KPI/lower groups, financial card spanning the lower group.
- 375px: hidden navigation drawer, full-width search, two-column KPIs and stacked operational/financial cards. Existing quick navigation remains available.
- Drawer supports close button, scrim, Escape, contained Tab navigation and focus restoration. Hidden mobile navigation is not keyboard-focusable. All existing routes remain available.
- Existing scrollable table containers are retained on administrative/detail screens. Charts have descriptive accessible labels and textual legends; zero datasets use neutral empty rings. Loading, empty, success and retryable failure states use the established shared components.

## Validation

- Frontend unit/component suite: **64 passed, 9 files**.
- Complete existing browser suite: **14 passed**, including role boundaries, both hiring paths, verification, messaging/image/voice, simulated payment, completion/review, dispute/refund and responsive screens.
- Focused dashboard responsiveness/navigation: **4 passed**, covering 375, 768, 1024 and 1440px, all three roles, actual search navigation, admin search omission, drawer/Escape behavior and no root horizontal overflow.
- Lint and production build passed; final configured-secret scan is run against frontend source/public/build.
- Live previews of the existing admin, professional and customer accounts all rendered with zero visible errors and no horizontal overflow. The professional account’s real Cloudinary header photo decoded successfully. Each preview session signed out afterward.
- Backend source was not touched, so no backend regression rerun was required for this UI-only change.
- Dashboard unit fixtures remain test-only. Browser fixtures are disposable; live account previews do not manufacture marketplace activity.

Screenshots from the isolated browser checks are generated under ignored `frontend/test-results/`: `customer-WIDTH.png`, `worker-overview-WIDTH.png`, and `admin-overview-WIDTH.png`. Private live previews are under ignored `backend/.local-integration/dashboard-ROLE-1440.png` and contain dashboard data, not credential forms.

No backend limitation was hidden or bypassed for visual convenience. Historical charts, global upcoming booking ordering, administrative search, withdrawal, admin-wide jobs/audit listings and unsupported account features remain outside the existing API capabilities.
