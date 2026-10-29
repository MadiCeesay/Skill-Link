# SKILLLINK — COMPLETE FRONTEND BUILD

You are now responsible for building the **complete frontend for SkillLink**, my Final Year Project.

This is not a prototype, landing-page-only task, or static UI exercise.

Build the complete responsive web application and integrate it with the existing SkillLink backend.

---

# 1. PROJECT OVERVIEW

**SkillLink** is a two-sided local service marketplace initially designed for The Gambia.

It connects:

### Customers
People who need skilled services.

### Professionals / Workers
Verified skilled workers who provide those services.

Examples include:

- plumbers
- electricians
- carpenters
- painters
- cleaners
- mechanics
- tailors
- masons
- technicians
- gardeners
- repair professionals
- other services provided by the backend catalog

SkillLink supports two important customer journeys.

### Journey A — Discover & Hire

Customer:

Searches for a service  
→ discovers professionals  
→ views worker profile  
→ checks services, portfolio, verification, pricing and reviews  
→ contacts/hires professional  
→ booking  
→ payment workflow  
→ service completion  
→ review

### Journey B — Post a Job

Customer:

Posts a job request  
→ SkillLink matches eligible professionals  
→ professionals see the opportunity  
→ workers submit quotes  
→ customer compares quotes/profiles  
→ customer accepts a quote  
→ booking  
→ messaging  
→ payment workflow  
→ service completion  
→ review

Both journeys are essential.

---

# 2. EXISTING BACKEND — INSPECT BEFORE CODING

The backend already exists and is substantially complete.

DO NOT rebuild the backend.

DO NOT invent APIs without checking the backend.

DO NOT weaken or restructure backend security merely to make frontend development easier.

Before writing substantial frontend code, inspect the entire backend.

Pay particular attention to:

- `backend/README.md`
- `backend/docs/openapi.json`
- `backend/docs/architecture.md`
- `backend/docs/final-backend-report.md`

Also inspect:

- routes
- controllers
- models
- services
- validation schemas
- authentication
- RBAC
- middleware
- serializers
- Socket.IO
- MediaProvider
- payment architecture
- notifications
- state machines
- error handling

The backend is the SOURCE OF TRUTH for functionality.

Map frontend actions to real endpoints.

Never guess an endpoint when the OpenAPI specification or backend code provides the answer.

---

# 3. IMPORTANT BACKEND CAPABILITIES

The existing backend includes functionality around:

- customer registration
- worker registration
- login
- JWT access tokens
- rotating refresh tokens
- logout/session revocation
- role-based authorization
- worker onboarding
- worker professional profiles
- service catalog
- worker services
- pricing
- service areas
- portfolio
- media
- worker verification
- verification badges
- worker discovery
- job requests
- worker matching
- quotes
- quote acceptance
- direct hiring
- bookings
- availability
- scheduling
- messaging
- image messages
- voice messages
- Socket.IO realtime communication
- contact-sharing protection
- mock/simulated payments
- financial ledger
- completion workflow
- disputes
- reviews
- notifications
- admin operations
- platform metrics
- audit events

Inspect the backend for exact behavior and endpoints.

---

# 4. ATTACHED SCREENSHOTS — PRIMARY DESIGN REFERENCE

I have attached screenshots from a **Two-Sided Handyman Services Marketplace** design.

These screenshots are the PRIMARY VISUAL AND UX INSPIRATION for SkillLink.

Some screenshots represent:

- homepage
- hero
- service categories
- professional cards
- worker profiles
- customer dashboard
- worker dashboard
- booking interfaces
- service discovery
- navigation
- forms
- statistics
- messaging
- worker experiences
- reviews
- "How It Works"
- professional recruitment
- footer
- other marketplace screens

Study ALL attached screenshots carefully.

Do not ignore them and replace them with a generic React/SaaS dashboard.

Extract their strongest design principles:

- spacious composition
- strong typography
- professional marketplace appearance
- photography-driven presentation
- clean cards
- information hierarchy
- large clear CTAs
- service discovery
- professional cards
- dashboard composition
- whitespace
- approachable visual language
- clear navigation
- strong worker presentation
- mobile-friendly layouts
- simple but polished forms

---

# 5. DO NOT COPY THE REFERENCE

The reference is inspiration, NOT a template to duplicate.

Do NOT copy:

- Handyman logo
- Handyman branding
- company name
- exact text
- Sri Lankan locations
- Sri Lankan currency
- people/images
- fake statistics
- copyrighted visual assets
- exact color palette
- exact screen layouts pixel-for-pixel

Create an ORIGINAL SkillLink product.

The goal is:

> If the designers behind this high-quality marketplace had been given the SkillLink requirements, what would they design?

Use that mindset.

---

# 6. SKILLLINK VISUAL IDENTITY

SkillLink needs a recognizable identity.

DO NOT default to green.

Green should mainly represent semantic states such as:

- verified
- successful
- completed
- available

Do NOT create another generic green application.

Also avoid the stereotypical AI-generated design style:

- excessive purple gradients
- excessive blue gradients
- glowing cards everywhere
- excessive glassmorphism
- giant rounded rectangles everywhere
- random floating blobs
- unnecessary animations

Create a professional service marketplace.

Recommended direction:

### Primary
Deep indigo / royal blue

### Background
Warm off-white / very light neutral

### Surface
White

### Main text
Near-black / dark navy

### Secondary text
Slate gray

### Borders
Soft neutral gray

### Success
Green

### Warning
Amber

### Error / cancelled / rejected
Red

Build a complete accessible palette around this direction.

The final interface should feel:

- trustworthy
- professional
- modern
- human
- polished
- approachable
- accessible
- distinctive

---

# 7. DESIGN SYSTEM

Before creating dozens of pages, establish a reusable SkillLink design system.

Define:

- colors
- typography
- spacing
- breakpoints
- container widths
- border radius
- shadows
- icons
- buttons
- inputs
- selects
- textareas
- radio controls
- checkboxes
- tabs
- badges
- verification indicators
- status chips
- avatars
- service cards
- worker cards
- job cards
- quote cards
- booking cards
- dashboard cards
- statistic cards
- message bubbles
- notification items
- tables
- modals
- dialogs
- dropdowns
- pagination
- skeleton loaders
- empty states
- error states
- toast notifications

All pages must feel like parts of ONE product.

Do not independently style every page.

---

# 8. RESPONSIVE DESIGN

SkillLink is a web application, but mobile experience is extremely important.

Build for:

- desktop
- laptop
- tablet
- mobile

Do NOT simply shrink desktop pages.

Customer pages should feel almost like a native marketplace app on mobile.

Desktop can use:

- full navigation
- sidebars
- multi-column layouts
- wider dashboards

Mobile should intelligently use:

- compact header
- navigation drawer
- bottom navigation where useful
- stacked cards
- touch-friendly controls
- sticky primary actions where appropriate

Avoid horizontal overflow.

Test important breakpoints.

---

# 9. PUBLIC HOMEPAGE

Use the attached Handyman homepage screenshots as strong composition inspiration.

The SkillLink homepage should immediately explain:

> Find trusted skilled professionals near you.

But SkillLink must communicate TWO actions:

### Find a Professional

AND

### Post a Job

Both should be visible prominently.

---

# 10. HOMEPAGE HERO

Build a high-quality marketplace hero inspired by the reference screenshots.

Possible headline direction:

**Find Trusted Skilled Professionals Near You**

Supporting copy should explain that SkillLink connects customers with verified local professionals.

Include:

- service search
- strong worker/professional photography
- Find a Professional CTA
- Post a Job CTA
- tasteful trust indicators

Do NOT fabricate numbers such as:

- 5.6K customers
- 500+ workers
- 4.8K reviews

Only show statistics when they come from real backend data.

Otherwise use genuine trust concepts such as:

- Verified Professionals
- Verified Reviews
- Protected Communication

---

# 11. SERVICE CATEGORIES

Use the category strip from the reference as inspiration.

Categories should come from the SkillLink catalog API wherever possible.

Possible examples:

- Plumbing
- Electrical
- Carpentry
- Painting
- Cleaning
- Mechanics
- Tailoring
- Masonry
- Gardening
- Technical services

Do not permanently hardcode categories when the backend provides them.

Provide:

**View All Services**

Selecting a service should lead into discovery.

---

# 12. TOP PROFESSIONALS

Adapt "Top Rated Handymen" into:

# Top Rated Professionals

Professional cards should use backend-supported information such as:

- photo
- name
- profession
- verification
- rating
- review count
- completed jobs
- service tags
- approximate service area
- starting price
- availability

Actions:

**View Profile**

and where appropriate:

**Hire / Request Service**

Never expose protected private information.

---

# 13. HOW SKILLLINK WORKS

Use the strong storytelling structure from the reference.

Suggested customer flow:

### 1 — Tell Us What You Need
Search for a professional or post a job.

### 2 — Connect With Professionals
Discover workers or receive responses from eligible professionals.

### 3 — Compare & Choose
Compare profiles, verified reviews and quotes and communicate safely.

### 4 — Book With Confidence
Confirm the professional and manage the service through SkillLink.

Keep this visually simple and easy to understand.

---

# 14. BECOME A SKILLLINK PROFESSIONAL

Adapt the worker recruitment section from the screenshots.

Heading:

**Become a SkillLink Professional**

Communicate real benefits:

- Receive relevant job opportunities
- Submit quotes
- Set your own availability
- Showcase your portfolio
- Build a verified profile
- Manage bookings
- Build reputation through verified reviews
- Track SkillLink earnings

CTA:

**Join as a Professional**

---

# 15. TRUST SECTION

Trust should be central to SkillLink.

Create a tasteful section explaining:

### Verified Professionals
Workers can undergo SkillLink verification.

### Verified Reviews
Reviews originate from eligible completed SkillLink jobs.

### Protected Communication
Customers and professionals can communicate through the platform.

### Professional Profiles
Customers can evaluate services, portfolios and reputation.

Do not exaggerate security guarantees.

---

# 16. HOMEPAGE REVIEWS

Use the attached testimonial composition as inspiration.

Use actual verified reviews from the API when available.

Do NOT present fabricated testimonials as real customers.

If there are no reviews, design an appropriate new-platform/empty state.

---

# 17. FOOTER

Use the dark structured reference footer as inspiration.

Potential structure:

### SkillLink
Short description.

### Services
- Browse Services
- Find Professionals
- Post a Job

### Professionals
- Join SkillLink
- Job Opportunities
- Professional Resources

### Company
- About
- How It Works

### Support
- Help
- Safety
- Privacy
- Terms

Do not fabricate contact information or social profiles.

---

# 18. PUBLIC SERVICE DISCOVERY

Create a polished service discovery experience.

Support backend capabilities for:

- service search
- categories
- filtering
- worker discovery
- location/service-area matching
- pagination

Provide useful loading, empty and error states.

---

# 19. WORKER DISCOVERY

Create an excellent worker search/browse experience.

Use:

- professional cards
- meaningful filters
- verification
- ratings
- services
- pricing
- availability
- approximate service area/distance where backend permits

Never expose exact protected coordinates.

---

# 20. PUBLIC WORKER PROFILE

This must be one of SkillLink's strongest pages.

Use attached profile screenshots where available.

Display appropriate backend-supported information:

- profile photo
- professional name
- headline
- verification badges
- rating
- review count
- completed jobs
- About
- services
- pricing
- portfolio
- availability
- service area
- verified reviews

Strong actions:

**Request Service**

**Hire Professional**

where appropriate.

---

# 21. AUTHENTICATION

Create professional:

- Login
- Customer registration
- Worker registration
- account verification UI
- forgot password
- reset password

IMPORTANT:

Inspect backend support.

If OTP verification has not yet been implemented, DO NOT fabricate OTP endpoints.

The frontend may prepare a clean verification interface, but clearly isolate functionality requiring backend implementation.

Use the existing JWT access/refresh architecture correctly.

Handle:

- authentication
- refresh
- logout
- expired sessions
- protected routes
- role authorization
- account status

Never expose tokens unnecessarily.

---

# 22. ROLE-BASED APPLICATION

SkillLink has:

- CUSTOMER
- WORKER
- ADMIN

Navigation and accessible pages must adapt to role.

Do not merely hide unauthorized links.

Use proper protected routes and backend authorization.

---

# 23. CUSTOMER DASHBOARD

Use attached dashboard screenshots as primary visual inspiration where applicable.

The customer dashboard should provide useful information such as:

- greeting/profile
- Find Professional
- Post a Job
- active job requests
- incoming quotes
- upcoming bookings
- messages
- notifications
- recent activity
- relevant workers/services where supported

Avoid clutter.

Prioritize actions customers actually need.

---

# 24. POST A JOB

Create a polished job-request experience.

Use actual backend JobRequest fields.

Potential information includes:

- category/service
- description
- budget type
- budget
- preferred schedule
- location/service area
- attachments

Use a clear multi-step form if that improves UX.

Explain that eligible professionals can receive the opportunity and submit quotes.

Provide:

- validation
- progress
- image/attachment handling
- loading
- success
- errors

---

# 25. CUSTOMER JOB REQUESTS

Create:

### My Jobs

with useful filters/statuses.

Each request should open:

### Job Details

showing:

- service
- description
- status
- budget
- schedule
- attachments
- received quotes
- edit/cancel actions only when backend lifecycle permits

---

# 26. QUOTES

Quote comparison is an important SkillLink experience.

Customers should easily compare:

- worker
- verification
- rating
- quoted amount
- message
- schedule where available
- status

Provide:

- View Worker
- Chat where allowed
- Accept Quote

Quote acceptance must call the actual backend workflow.

Do not fake booking creation on the client.

---

# 27. DIRECT HIRING

Support backend direct-hire workflow.

Customer:

Worker Profile  
→ Request/Hire  
→ Proposal  
→ Worker accepts/rejects  
→ centralized booking workflow

Use actual backend behavior.

---

# 28. CUSTOMER BOOKINGS

Provide clear booking categories/states based on backend lifecycle.

The backend may use statuses including:

- PENDING
- AWAITING_PAYMENT
- CONFIRMED
- IN_PROGRESS
- WORKER_MARKED_COMPLETED
- COMPLETED
- CANCELLED
- DISPUTED

Only show actions allowed in each state.

Design:

- booking list
- booking details
- timeline/status presentation
- worker information
- service details
- schedule
- payment state
- communication CTA
- completion actions

---

# 29. MESSAGING

Build a high-quality marketplace messaging experience.

Use actual SkillLink messaging backend.

Support:

- conversation list
- text messages
- image messages
- voice messages
- system messages
- timestamps
- unread indicators
- history
- realtime Socket.IO updates

Persisted messages remain the source of truth.

Respect backend contact-sharing protection.

If a message is blocked because it attempts to share prohibited contact information, show the backend's safety explanation gracefully.

---

# 30. VOICE MESSAGES

Voice accessibility is an important SkillLink feature.

Build polished:

- record button
- recording timer
- cancel
- preview
- send
- playback
- duration where available

Do NOT implement speech-to-text unless backend support exists.

Do NOT implement Wolof/Mandinka/Fula AI.

Those remain future work.

---

# 31. NOTIFICATIONS

Create:

- notification list
- unread indicators
- mark as read
- pagination where supported

Support backend notification events around:

- jobs
- quotes
- proposals
- bookings
- payments
- messages
- completion
- disputes
- verification
- reviews

---

# 32. MOCK PAYMENT EXPERIENCE

SkillLink currently uses simulated/mock payment infrastructure.

Design it professionally but NEVER mislead the user into believing real money is being transferred.

Use actual PaymentService endpoints.

Display:

- amount
- service
- booking
- payment status
- platform fee where appropriate
- simulated transaction result

Use GMD.

Backend money is represented in integer bututs.

Create a centralized money formatter:

100 bututs = 1 GMD.

Never perform inconsistent currency conversion in individual components.

---

# 33. COMPLETION

Support backend completion workflow.

Typical journey:

Confirmed  
→ In Progress  
→ Worker Marks Completed  
→ Customer Reviews Completion

Customer can:

- confirm completion

OR where supported:

- report a problem

Confirmation should lead to the backend completion/payment release behavior.

---

# 34. REVIEWS

Allow eligible customers to review completed SkillLink bookings.

Use:

- 1–5 stars
- review content where supported

Clearly distinguish verified reviews.

Prevent frontend from offering reviews when backend eligibility does not permit them.

---

# 35. DISPUTES

Create an appropriate customer/worker dispute experience where backend support permits.

Display:

- dispute status
- booking
- reason/details
- relevant outcome

Do not invent dispute actions unavailable to the role.

---

# 36. CUSTOMER PROFILE / SETTINGS

Create polished customer account pages using supported backend data.

Potential sections:

- personal information
- account
- notifications
- security/session-related controls where supported

Do not expose security-sensitive backend information.

---

# 37. WORKER DASHBOARD

Use attached worker-dashboard screenshots as primary design inspiration.

This should feel like a professional work-management application.

Show meaningful backend-supported information such as:

- verification status
- new job opportunities
- direct-hire requests
- active quotes
- upcoming bookings
- unread messages
- pending earnings
- released earnings
- completed jobs
- rating
- reviews
- quick actions

Do not overcrowd it.

---

# 38. WORKER ONBOARDING

Create a clear onboarding experience.

Guide worker through:

- professional profile
- services
- pricing
- service area
- portfolio
- availability
- verification

Where possible, show onboarding progress.

---

# 39. WORKER PROFESSIONAL PROFILE

Allow workers to manage:

- professional information
- headline
- About
- services
- pricing
- service area
- portfolio
- other backend-supported profile information

Provide preview/view-public-profile functionality where appropriate.

---

# 40. WORKER VERIFICATION

Create a trustworthy verification flow.

Support backend states such as:

- pending
- approved
- rejected
- resubmission

Display:

- identity verification status
- work evidence status
- verification badges

Explain why verification matters.

Identity documents must remain private.

---

# 41. WORKER SERVICES & PRICING

Provide intuitive management of:

- offered services
- pricing type
- amounts

Respect backend pricing modes such as:

- FIXED
- HOURLY
- STARTING_FROM
- QUOTE_REQUIRED

Use GMD display correctly.

---

# 42. WORKER SERVICE AREA

Provide intuitive service-area configuration based on actual backend fields.

Never accidentally expose protected exact coordinates publicly.

---

# 43. WORKER PORTFOLIO

Create a visual portfolio manager.

Support:

- upload
- preview
- metadata where available
- remove/manage

Use the existing MediaProvider/backend APIs.

Handle upload progress and errors professionally.

---

# 44. WORKER JOB OPPORTUNITIES

Workers should see eligible job requests returned by backend matching.

Cards should show enough information to evaluate the opportunity without exposing protected customer information.

Provide useful:

- service
- approximate area
- budget
- schedule
- request summary
- status

---

# 45. SUBMIT QUOTE

Create a polished quote submission experience.

Use actual backend fields.

Potential inputs:

- amount
- message
- proposed schedule

Support:

- submit
- validation
- status
- withdraw when backend allows

---

# 46. DIRECT HIRE REQUESTS — WORKER

Workers should clearly see customer direct-hire proposals.

Allow supported:

- inspect
- accept
- reject

Acceptance should use backend workflow.

---

# 47. WORKER BOOKINGS

Provide professional management of:

- upcoming
- active
- awaiting payment
- in progress
- marked completed
- completed
- cancelled
- disputed

Actions must follow backend state machine.

---

# 48. WORKER AVAILABILITY

Create an intuitive schedule manager.

Support backend:

- recurring weekly availability
- blocked dates
- time off
- availability information

The backend uses appropriate timezone handling.

Display times clearly to users.

---

# 49. WORKER EARNINGS

Create a professional earnings interface using simulated SkillLink financial information.

Display backend-supported:

- pending earnings
- released earnings
- platform fees where relevant
- ledger/transaction history

Do NOT represent this as actual bank money.

---

# 50. WORKER REVIEWS & REPUTATION

Display:

- average rating
- review count
- completed jobs
- verified reviews
- verification/reputation indicators

Make this useful for professionals building credibility.

---

# 51. ADMIN APPLICATION

Create a distinct admin interface.

It should share SkillLink design tokens but prioritize operational clarity and information density.

Do not simply copy the customer dashboard.

---

# 52. ADMIN DASHBOARD

Use real backend metrics where available.

Potential metrics include:

- users
- customers
- workers
- verified workers
- pending verifications
- open jobs
- accepted jobs
- bookings
- completed bookings
- cancelled bookings
- disputed bookings
- reviews
- simulated payment volume
- simulated platform revenue
- pending disputes

Use charts only where meaningful.

Do not add fake decorative charts.

---

# 53. ADMIN USERS

Support backend operations for:

- inspect users
- filter/search where supported
- status
- role
- suspend
- reactivate

Sensitive mutations require clear confirmation.

---

# 54. ADMIN WORKER VERIFICATION

Create an excellent verification-review workspace.

Allow administrators to inspect permitted verification information/evidence and perform backend-supported:

- approve
- reject

Display verification history/status clearly.

---

# 55. ADMIN CATALOG

Create interfaces for backend-supported:

- categories
- services
- activation/deactivation
- catalog management

---

# 56. ADMIN JOBS & BOOKINGS

Create operational views for:

- jobs
- bookings
- statuses
- relevant relationships
- filters where backend supports them

---

# 57. ADMIN PAYMENTS & LEDGER

Create read/inspection interfaces for simulated:

- payments
- ledger entries
- platform fees
- worker earnings
- statuses

Make it explicit that the provider is simulated/mock.

---

# 58. ADMIN DISPUTES

Create an operational dispute workspace.

Support backend resolution options such as:

- release to worker
- refund customer

Require confirmation.

Display relevant audit context.

---

# 59. ADMIN REVIEWS

Allow backend-supported review moderation.

Admins may:

- inspect
- flag/hide where supported

Do not allow UI to secretly alter customer ratings if backend does not permit that.

---

# 60. ADMIN AUDIT INFORMATION

Where backend endpoints support it, expose appropriate audit information for sensitive administrative operations.

Prioritize clarity over decorative UI.

---

# 61. SEARCH & FILTER UX

Search/filter experiences should be intentional.

Use appropriate combinations of:

- search
- category
- service
- rating
- verification
- pricing
- availability
- location/service area
- status
- dates

ONLY when backend APIs support them.

Do not create fake client-side filters that imply server capabilities that do not exist.

---

# 62. LOADING STATES

Do not rely on giant centered spinners.

Use:

- skeleton cards
- skeleton tables
- button loading states
- form progress
- inline loading indicators

Maintain layout stability.

---

# 63. EMPTY STATES

Every important page must have an intentional empty state.

Examples:

### No Jobs
"Post your first job and connect with skilled professionals."

### No Quotes
"Your request is live. Quotes from eligible professionals will appear here."

### No Bookings
"Find a professional or post a job to get started."

### No Portfolio
"Show customers what you can do."

### No Messages
"Your SkillLink conversations will appear here."

### No Notifications
"You're all caught up."

Do not leave blank screens.

---

# 64. ERROR UX

Translate technical API errors into understandable messages.

Do not display raw stack traces.

Handle:

- validation
- unauthorized
- forbidden
- not found
- conflict
- rate limit
- network failure
- server error

Preserve useful backend messages where safe.

---

# 65. CONFIRMATION UX

Use confirmation dialogs for consequential actions such as:

- cancel job
- withdraw quote
- cancel booking
- reject direct hire
- remove portfolio item
- admin suspension
- dispute resolution

Do not annoy users with confirmation for harmless actions.

---

# 66. ACCESSIBILITY

Implement:

- semantic HTML
- keyboard navigation
- visible focus states
- sufficient contrast
- proper labels
- useful ARIA
- accessible dialogs
- accessible menus
- touch-friendly mobile controls

Accessibility is part of quality, not optional polish.

---

# 67. PERFORMANCE

Optimize for real-world usage, including mobile connections.

Use:

- route-level code splitting
- lazy loading
- optimized images
- responsive images
- sensible API caching
- minimal unnecessary requests
- request cancellation where useful
- skeleton states
- efficient rendering

Avoid unnecessary heavy dependencies.

---

# 68. FRONTEND ARCHITECTURE

Inspect the repository before deciding exact technologies.

Use a maintainable modern frontend architecture.

A possible structure:

src/
  api/
  assets/
  components/
  features/
  hooks/
  layouts/
  pages/
  routes/
  services/
  store/
  styles/
  utils/

Organize by feature where useful.

Centralize:

- API client
- authentication
- session refresh
- role guards
- Socket.IO
- money formatting
- date/time formatting
- media URLs
- status presentation
- error handling

Do not overengineer.

---

# 69. API CONFIGURATION

Use environment configuration.

For a Vite frontend this may be:

`VITE_API_URL`

but inspect the project before deciding.

The current local backend runs on:

`http://localhost:5000`

Do not hardcode this URL throughout components.

Use environment configuration.

---

# 70. AUTHENTICATION ARCHITECTURE

Integrate properly with existing JWT architecture.

Handle:

- login
- access token
- refresh token workflow
- session expiration
- logout
- current user
- role
- protected routes

Avoid insecure token handling.

Inspect backend implementation before choosing storage/refresh strategy.

---

# 71. REALTIME

Use existing Socket.IO backend for supported realtime messaging behavior.

Centralize Socket.IO connection lifecycle.

Handle:

- authentication
- reconnect
- conversation rooms
- new messages
- cleanup
- errors

Do not create multiple uncontrolled socket connections across components.

---

# 72. MONEY

Backend money is stored in integer bututs.

1 GMD = 100 bututs.

Create centralized helpers.

Example:

250000 backend bututs → GMD 2,500.00

Never display raw butut values to normal users.

Use:

**GMD**

rather than Sri Lankan Rs.

---

# 73. DATES & TIMES

Centralize date/time formatting.

Present:

- booking dates
- availability
- message timestamps
- notifications
- job dates

consistently.

Respect backend timezone behavior.

---

# 74. STATUS SYSTEM

Create centralized presentation for statuses.

Examples:

Booking:
- Pending
- Awaiting Payment
- Confirmed
- In Progress
- Awaiting Customer Confirmation
- Completed
- Cancelled
- Disputed

Quote:
- Pending
- Accepted
- Rejected
- Withdrawn
- Expired

Verification:
- Pending
- Approved
- Rejected

Payment:
- Pending
- Successful
- Failed
- Held
- Released
- Refunded
- Disputed

Use consistent colors/icons.

Do not duplicate status logic across pages.

---

# 75. PHOTOGRAPHY

The reference design uses photography effectively.

Use professional service-related imagery thoughtfully.

Images should represent realistic skilled professionals.

Avoid making every page dependent on huge stock photography.

Dashboards should prioritize data and actions.

Do not copy images from the reference screenshots.

---

# 76. ICONS

Use one consistent icon library.

Do not mix multiple unrelated icon styles.

Avoid unnecessary emoji in production UI.

---

# 77. ANIMATION

Use restrained animation.

Good:

- modal transitions
- dropdowns
- subtle hover states
- skeleton transitions
- toast feedback
- navigation transitions

Avoid:

- constant bouncing
- floating blobs
- excessive parallax
- unnecessary page animation
- distracting effects

---

# 78. DO NOT FAKE PRODUCTION DATA

Development fixtures are acceptable while building.

The completed integrated application should use the real API wherever backend support exists.

Do not ship fake:

- workers
- reviews
- bookings
- earnings
- payment volume
- customer counts

as though they were real.

---

# 79. OUT OF SCOPE

Do NOT implement the following as current V1 functionality unless existing backend support proves otherwise:

- real Wave payment
- APS payment
- Stripe
- PayPal
- real escrow
- lending / BNPL
- live driver/GPS tracking
- AI recommendations
- Wolof speech recognition
- Mandinka speech recognition
- Fula speech recognition
- AI voice assistant
- native mobile application

Voice recording/messaging IS part of V1.

Speech recognition is future work.

---

# 80. OTP / ACCOUNT VERIFICATION

The UI may include a professional account verification/OTP experience.

However:

FIRST inspect backend support.

If OTP does not currently exist:

- do not fabricate an API
- do not pretend OTP is functional
- isolate the UI cleanly
- document the backend gap

Do not block the rest of the frontend because of OTP.

---

# 81. TESTING

Add meaningful frontend tests.

Prioritize:

- authentication
- protected routes
- role routing
- job creation
- quote workflows
- booking actions
- payment presentation
- messaging
- verification
- review eligibility
- admin authorization
- important formatting/utilities

Run:

- tests
- lint
- build

Resolve frontend errors before considering the work complete.

---

# 82. DEVELOPMENT PROCESS

You are authorized to build the COMPLETE frontend.

Do not stop after only building static screenshots.

Proceed systematically.

## PHASE 1 — ANALYSIS

Before substantial implementation:

1. Inspect repository.
2. Inspect backend.
3. Inspect OpenAPI.
4. Inspect backend documentation.
5. Inspect all attached screenshots.
6. Map backend endpoints.
7. Map roles.
8. Map frontend screens.
9. Identify backend/frontend gaps.
10. Decide frontend stack.
11. Define design system.

Then continue.

Do not wait for approval unless there is a genuine ambiguity/blocker that cannot be resolved from the repository or these requirements.

---

# 83. PHASE 2 — FOUNDATION

Build:

- frontend project
- design tokens
- typography
- shared components
- responsive layout
- routing
- API client
- authentication
- role guards
- error handling
- query/data architecture
- Socket.IO architecture
- utility formatters

---

# 84. PHASE 3 — PUBLIC + AUTH

Build:

- homepage
- services
- worker discovery
- worker profile
- How It Works
- login
- registration
- account verification UI where appropriate
- forgot/reset password where supported

---

# 85. PHASE 4 — CUSTOMER

Build complete:

- customer dashboard
- job posting
- job management
- quotes
- direct hiring
- bookings
- messaging
- voice
- notifications
- mock payment
- completion
- reviews
- disputes
- profile

---

# 86. PHASE 5 — WORKER

Build complete:

- worker dashboard
- onboarding
- profile
- verification
- services
- pricing
- service area
- portfolio
- opportunities
- quotes
- direct hire
- bookings
- availability
- messaging
- voice
- notifications
- earnings
- reviews/reputation
- settings

---

# 87. PHASE 6 — ADMIN

Build:

- admin dashboard
- users
- workers
- verification
- catalog
- jobs
- bookings
- payments
- ledger
- disputes
- reviews
- metrics
- audit information

---

# 88. PHASE 7 — INTEGRATION

Connect all relevant screens to real backend APIs.

Remove unnecessary mock data.

Verify:

- authentication
- role authorization
- CRUD/actions
- lifecycle actions
- Socket.IO
- media
- payment simulation
- notifications
- admin operations

---

# 89. PHASE 8 — RESPONSIVE POLISH

Review every major flow on:

- desktop
- laptop
- tablet
- mobile

Fix:

- overflow
- spacing
- typography
- navigation
- tables
- forms
- cards
- dialogs
- touch targets

---

# 90. PHASE 9 — FINAL QUALITY

Run:

- frontend tests
- lint
- production build

Review:

- accessibility
- responsiveness
- API integration
- loading states
- empty states
- error states
- visual consistency
- security assumptions
- performance

---

# 91. DO NOT DAMAGE THE BACKEND

The existing backend has extensive tests and documentation.

Do not casually modify it.

If frontend integration reveals a genuine backend problem:

1. identify the exact problem,
2. identify the endpoint/module,
3. explain why frontend integration cannot proceed correctly,
4. propose the smallest safe fix,
5. preserve existing tests and security.

Do not rewrite backend architecture.

---

# 92. SCREEN INVENTORY

At minimum, ensure the final application accounts for the following.

## PUBLIC

- Homepage
- Services
- Worker Discovery
- Worker Profile
- How It Works
- Login
- Customer Registration
- Worker Registration
- Account Verification where supported
- Forgot Password where supported
- Reset Password where supported

## CUSTOMER

- Dashboard
- Find Professionals
- Post Job
- My Jobs
- Job Details
- Quotes
- Direct Hire
- Bookings
- Booking Details
- Messages
- Voice Messages
- Notifications
- Payment
- Completion
- Reviews
- Disputes
- Profile / Settings

## WORKER

- Dashboard
- Onboarding
- Professional Profile
- Verification
- Services
- Pricing
- Service Area
- Portfolio
- Job Opportunities
- Opportunity Details
- Submit Quote
- My Quotes
- Direct Hire Requests
- Bookings
- Booking Details
- Availability
- Messages
- Voice Messages
- Notifications
- Earnings
- Reviews / Reputation
- Profile / Settings

## ADMIN

- Dashboard
- Users
- Workers
- Verification Queue
- Verification Details
- Categories
- Services
- Jobs
- Bookings
- Payments
- Ledger
- Disputes
- Reviews
- Platform Metrics
- Audit information where supported

Avoid creating redundant separate pages when a better UX can combine closely related functionality.

---

# 93. NAVIGATION

Design navigation based on role.

### Public
Home  
Services  
Find Professionals  
How It Works  
Become a Professional  
Login / Get Started

### Customer
Dashboard  
Find Professionals  
Post a Job  
My Jobs  
Bookings  
Messages  
Notifications  
Profile

### Worker
Dashboard  
Opportunities  
Bookings  
Messages  
Availability  
Earnings  
Profile

Secondary worker management can live inside profile/workspace:

- verification
- services
- pricing
- portfolio
- reviews

### Admin
Dashboard  
Users  
Verifications  
Catalog  
Jobs  
Bookings  
Payments  
Disputes  
Reviews

Use good information architecture rather than placing 20 links in one sidebar.

---

# 94. VISUAL QUALITY BAR

This is a Final Year Project, but the interface should NOT look like one.

The goal is for someone seeing it for the first time to think:

> "This looks like a real startup product."

Avoid:

- unfinished screens
- inconsistent components
- default browser controls
- giant empty spaces caused by poor layout
- random colors
- inconsistent border radius
- inconsistent iconography
- excessive gradients
- fake charts
- placeholder lorem ipsum
- broken mobile layouts
- raw API data
- technical status codes exposed to users

---

# 95. SCREENSHOT INTERPRETATION RULE

If an attached screenshot corresponds closely to a SkillLink page, use it as the strongest visual reference for that page.

Examples:

Homepage screenshot
→ SkillLink homepage

Customer dashboard screenshot
→ SkillLink customer dashboard

Worker dashboard screenshot
→ SkillLink worker dashboard

Professional profile screenshot
→ SkillLink worker profile

Booking screenshot
→ SkillLink booking experience

Messaging screenshot
→ SkillLink messaging

If no screenshot exists for a required SkillLink page:

DO NOT create a completely different design.

Infer that page from the established SkillLink design system and surrounding screenshots.

All screens must look like they belong to the same application.

---

# 96. YOU MAY IMPROVE THE REFERENCES

The screenshots are not restrictions.

You are expected to improve UX where SkillLink requires functionality the reference does not contain.

For example:

- Post a Job
- quote comparison
- verification
- voice messaging
- disputes
- availability
- worker earnings
- admin operations

These should feel native to the same design system.

---

# 97. FINAL DELIVERABLE

Do not consider the task complete merely because pages render.

The final deliverable should be a functioning SkillLink frontend integrated with the existing backend.

At completion provide a report containing:

### Architecture
- frontend stack
- folder structure
- major architectural decisions

### Design
- design system
- responsive strategy
- how screenshots influenced implementation

### Screens
- public screens completed
- customer screens completed
- worker screens completed
- admin screens completed

### Integration
- backend APIs integrated
- Socket.IO integration
- authentication
- media
- notifications
- payment simulation

### Quality
- tests
- lint result
- production build result
- responsive checks

### Gaps
Clearly identify anything that could not be implemented because backend support does not currently exist.

### Run Instructions
Provide exact commands to run:

1. backend
2. frontend

locally.

---

# 98. FINAL PRINCIPLE

Remember this distinction throughout development:

**THE ATTACHED SCREENSHOTS DEFINE THE VISUAL DIRECTION.**

**THE EXISTING SKILLLINK BACKEND DEFINES THE FUNCTIONALITY.**

Combine both.

Do not sacrifice functionality merely because the inspiration screenshots do not contain a SkillLink feature.

Do not sacrifice design quality merely because the backend contains many features.

The final result should be:

**SkillLink — a polished, responsive, trustworthy two-sided marketplace for discovering, hiring and working with skilled local professionals.**

Build the complete frontend systematically from start to finish.