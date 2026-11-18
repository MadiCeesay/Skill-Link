# Plan items 5–10: booking progress, amounts and participant context

## Behavior

- **5 — Progress:** “Booking arranged” uses the persisted booking `createdAt` timestamp. Completing or confirming a booking no longer makes this earlier milestone look unreached. Payment/start/completion milestones retain their authoritative timestamps.
- **6 — Amounts:** GMD accepts up to two decimal places, converts through decimal strings/BigInt into integer bututs, and rejects excess precision rather than silently changing an agreement. GMD 499.79 is exactly 49979 bututs and remains valid. Monetary fields show this guidance, request a decimal keyboard, and blur on wheel scrolling to prevent accidental spinbox changes. Existing agreed amounts, fixed service prices and ledger entries are not rounded or rewritten.
- **7 — Admin Jobs:** `acceptedJobs` is the **global** count of public JobRequests with status `QUOTE_ACCEPTED`, excluding jobs associated with archived demo bookings. It is not the currently signed-in customer's job count and does not include direct proposals. A JobRequest can remain in that state after its booking is completed. The page now says “Job requests with an accepted quote” and explains the scope. No metric definition or historical data was changed.
- **8/9 — People and work:** customer and worker booking lists/details and conversation lists show the other person's name, permitted profile photo, service name and status. Conversation headers carry the same context. Missing/deleted accounts/services are labelled unavailable; missing/failed images use initials. Workers no longer receive a link to their own professional profile inside the customer's identity section.
- **10 — Notifications:** notifications show sentence titles/messages, names and service/work references rather than formatting internal event codes. Existing notifications receive current copy on read without an event-history rewrite. Unread rows retain the background highlight and now carry an explicit text-and-dot “Unread” marker. Mark-one/all and existing destinations remain connected to the current endpoints.

## API/privacy

Participant GET booking list/detail and conversation create/list/detail add optional `counterpart` and `serviceSummary` fields. Counterpart is limited to `id`, `firstName`, `lastName`, and a nullable `{url, expiresAt}` profile image. It never includes emails, phone numbers, locations, account metadata, verification documents or provider storage fields. No contact fields are even selected by the summary lookups.

Original ownership/RBAC checks run first; summary lookup independently checks that the viewer belongs to the record. Other people's photos require owned PROFILE_IMAGE media. Worker photos additionally require the same public-discovery eligibility pipeline; draft/ineligible profiles and identity-document IDs do not supply images. Current customer photo upload capability is unchanged: an absent photo gets initials. Image-provider failure does not hide a booking or conversation.

Lookups are batched across each page, and short-lived links use the existing authenticated media provider. Conversation status follows the related booking when one exists, otherwise the quote/proposal status with lazy expiry. Missing contexts return a null status. Booking mutation/admin responses retain existing optional-summary behavior; participant reads supply the display context.

Notification enrichment is recipient-scoped and independently checks each referenced marketplace relationship before reading participant names and service details. It uses service names and short work references, avoiding free-text addresses, descriptions or contact details in notification copy. Stale/mismatched resources fall back to a generic sentence. Stored event keys, resource IDs, read state and notification deduplication are unchanged. OpenAPI documents the additive fields and metric semantics.

## Verification

Focused integration tests cover both viewer directions; booking/conversation list and detail; quote/proposal and linked-booking status; outsider/admin boundaries; draft/private-document photo denial; legacy notification wording, read state and mismatched ownership; global job counts; exact cents and API precision rejection. Component tests cover both roles, completed timeline, photos/fallbacks, notification read markers, metric labels and currency input behavior. Browser verification uses the existing isolated replica-set harness, never the configured Atlas database.

Verified 15 November 2026:

- 101 frontend tests passed across 12 files with one worker and a 20-second per-test timeout.
- 49 backend integration tests passed across participant presentation, phase 5 messaging and phase 8 administration/notifications. The final participant suite was also rerun: 10 passed.
- The isolated browser journey passed for customer and worker at 1440px and 375px, covering booking list/detail, conversation list, readable notification content and mark-all-read. Sixteen screenshots were captured per run. Initial screenshot inspection found an inherited rule hiding booking chips below 1200px; it was corrected, and the confirmation run explicitly required status chips to be visible. Conversation service/status spacing was confirmed in that second pass.
- Frontend ESLint and production build passed. OpenAPI reference check: 1123 references, zero unresolved. Configured-secret scan: 61 files checked, zero exposures.
- Initial implementation checks found and fixed a server-built MongoDB filter interacting with sanitization, and a test cleanup ordering issue. Final integration/component checks have no remaining failures.

Live Atlas data, existing agreed amounts and ledger entries were not modified. Customer photo-upload capability remains unchanged; initials appear when no permitted photo exists.
