# SkillLink UI inspiration study

Reviewed 25 October 2026. User requested the Dribbble handyman-app search as inspiration for the future SkillLink interface. This is a provisional design brief, not frontend implementation or an approved final palette.

## References

- Search: https://dribbble.com/search/handyman-app
- Hanwik / Panze: https://dribbble.com/shots/27403629-Hanwik-Handyman-Home-Repair-Service-Marketplace-App-Design
- Project management / Panze: https://dribbble.com/shots/27403590-Handyman-Home-Repair-Service-Mobile-App-UI-UX-Design
- HandyHub / Reyhane Reyhani: https://dribbble.com/shots/27383327-HandyHub-On-Demand-Handyman-Home-Services-App-UI
- Handyman redesign / Digitalkit: https://dribbble.com/shots/26338546-Handyman-App-Redesign-Home-Services

Search results, design descriptions, published palettes and available image-search previews were reviewed. Several original full-resolution CDN images failed to load, and no interactive browser was available. Findings are an initial direction rather than an exhaustive visual audit of every shot. Do not represent unseen details as verified.

## Observed direction

Hanwik references emphasize structured discovery, categories, professional profiles, project cards, schedules and service progress. Available previews show light backgrounds, dark blue accents, rounded cards and bottom navigation. Published palette includes #F4F6F8, #0A0F19 and #0A2C52.

HandyHub describes bright surfaces, purple primary accents, modular containers and a calendar/time-grid modal that collapses into a concise schedule summary. It is a useful alternative palette and scheduling reference, not a reason to mix competing brand colors.

Digitalkit's redesign explicitly covers both technicians and customers. Use it as a reminder that worker task management needs its own information hierarchy, rather than reusing the customer shopping screen.

## Proposed SkillLink adaptation

- Mobile-first responsive interface, with wider desktop layouts and a separate admin dashboard. Native application work remains outside the present request.
- Light neutral surfaces, dark readable typography, one strong brand accent, restrained shadows/borders, consistent rounded cards and generous spacing. Final colors/font/logo remain undecided.
- Customer home: general service area, search, database-driven category icons, two visible routes (Find a worker / Post a job), concise worker cards and upcoming booking summary.
- Worker cards: photo, profession, meaningful verification badge, general area, real review count/rating where available and honest pricing labels (per hour / starting from / quote required).
- Profile: professional details, services, portfolio, pricing and real reviews, with a clear request/proposal action. Avoid contact and exact-coordinate exposure.
- Customer job flow: short staged form, optional photos, budget, general/private location distinction, received quote comparison and explicit acceptance.
- Booking flow: selected professional/service, available dates and intervals, transparent summary, worker-consent state when required and clearly labelled simulated checkout.
- Job tracking: clear state chips/timeline and state-specific next action. Distinguish worker-marked complete from customer-confirmed completion.
- Worker home: relevant opportunities, pending direct proposals, submitted quotes, today's bookings, verification status and availability controls. Financial summaries explicitly say simulated.
- Messaging: simple conversation history with image and voice-record/play controls, visible upload/send states and useful contact-sharing error text.
- Admin: restrained sidebar, real metrics, verification/dispute queues and auditable operations.
- Candidate customer navigation: Home, Jobs, Messages, Profile. Candidate worker navigation: Opportunities, Bookings, Messages, Profile; availability accessible from dashboard/profile. Validate this hierarchy during wireframing.

## Product constraints to retain

Adapt the visual language to SkillLink's implemented workflows. Direct proposals require worker acceptance. Quote acceptance does not itself book a slot. Availability and conflict results come from the server. Payments are mock-only. GMD is the display currency; backend money remains integer bututs. Location examples should reflect The Gambia. Verification and reviews must be evidence-backed. Empty, loading, error, expired, pending and unverified states need intentional designs.

Prioritize readable labels, strong contrast, generous touch targets, lightweight images and low-bandwidth use. Voice recording is supported; speech recognition and live GPS tracking are not. Inspiration should inform an original SkillLink design; do not copy another product's branding, artwork or screen assets.
