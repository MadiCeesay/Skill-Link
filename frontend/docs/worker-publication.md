# Worker identity approval and profile publication

Identity approval and public profile visibility are separate existing backend controls. An ACTIVE, identity-approved worker can still have a DRAFT profile. Draft profiles are intentionally absent from public discovery and are ineligible for matched jobs. Approval does not automatically publish a worker's details.

The worker dashboard now shows both identity verification and visibility badges, explains draft status, and offers a confirmed Publish profile action using the existing authenticated PATCH /workers/me/profile endpoint. The existing server validates profession, bio, selected active services and service areas. No admin-only bypass, automatic publication, fake location or invented profile data is introduced.

Matched opportunity requests wait for a PUBLIC profile with APPROVED identity verification. Workers who are still drafting or awaiting verification see next-step guidance instead of the expected 403 error panel. Profile changes invalidate relevant opportunity queries so publication can immediately start the appropriate requests.

Tests cover the approved-draft notice, no premature opportunity requests, pending-verification guidance, explicit publication confirmation, exact PATCH payload and opportunity loading after publication. Lint and production build pass. The full frontend run passed 83 of 84 tests; one existing discovery test hit its five-second limit. All three discovery tests passed on a separate rerun with a twenty-second CLI limit. No test assertions or project timeout settings were weakened.
