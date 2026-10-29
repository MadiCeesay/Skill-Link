# Admin demo booking cleanup — 27 October 2026

At the owner's request, five generated demo bookings were archived from the active admin booking, payment, ledger, review and dispute lists. Their contributions are excluded from the admin overview booking, review, dispute and financial metrics. Accepted demo jobs linked to those bookings are excluded from overview job totals.

Preserved unchanged: Musa Banja's completed booking `6adff764aa0ddab68ab1e1e0`, GMD 500, completed 27 October 2026. Its payment, ledger, evidence, review and user accounts were not altered.

No bookings, payments, ledger entries, reviews, disputes or accounts were deleted. Archival sets adminArchivedAt/adminArchiveReason on the five demo bookings and records DEMO_BOOKING_ARCHIVED audit events. Existing admin detail routes retain access to historical records. Customer/worker lifecycle records and reputation are unchanged.

The owner subsequently requested excluding generated demo accounts from overview counters too. User.adminMetricsExcludedAt is an internal metrics-only marker: user role counts and verification counters omit flagged identities. It does not change login, account status, profiles, sessions or history. The exact two generated customers and two generated professionals are selected from the ignored local credential artifacts; the operating administrator and both participants in Musa's preserved booking are protected. `scripts/exclude-demo-account-metrics.mjs` defaults to inspection, backs up original marker values before applying, records one User audit event per changed identity and verifies the running admin API. Real future accounts remain counted normally. Account administration lists retain all accounts for traceability.

Applied and verified against the live overview: 3 people (operating administrator, Musa and his customer), 1 approved professional and 1 completed booking. The 21-test admin integration suite passed, including metrics-only exclusion and unchanged account availability.

The cleanup script defaults to inspection. Application requires `--apply` and an explicit expected `--keep` ID. It matches exact generated demo worker identities from ignored local credential artifacts, rejects active work, checks the preserved booking, backs up the affected booking documents in ignored `.local-integration/`, and archives transactionally with auditing. It never prints credentials. An operator can recover the original archival metadata using that backup; there is no public deletion or archive endpoint.

Verification: 20 admin integration tests passed, including archived-list exclusion, overview financial exclusion, preserved detail access and retained immutable ledger entries. Live verification confirmed one visible admin booking, one completed booking, GMD 500 simulated volume, GMD 50 released platform revenue and GMD 0 refunds. The running admin API also returned one booking and preserved Musa's booking ID.
