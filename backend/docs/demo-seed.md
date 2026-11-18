# Repeatable local/demo data

From `backend`, with the existing development `.env` configured:

```
npm run seed:demo
```

This targets **the database in MONGODB_URI**. Use a dedicated demo database if you want
the demo accounts separate from real users. It refuses NODE_ENV=production. A MongoDB
replica set and the configured Cloudinary media provider are required. Do not print or
share `.env` or the generated login file.

The script creates 10 fictional workers covering all eight services, three customers,
and a replacement demo administrator. Names, towns, skills, fixed prices (converted
from GMD to integer bututs) and Monday–Saturday 08:00–18:00 availability are populated.
Nine workers have synthetic approved verification fixtures; the tenth is pending.
These are test states, not real identity checks. Evidence is explicitly marked DEMO ONLY.

It adds three open requests and seven bookings: awaiting payment, confirmed, in progress,
worker marked complete, completed, cancelled and disputed. The disputed booking has one
open dispute; the completed booking has released mock funds and is ready for a customer
review. There is also an unanswered Carpentry offer and a short chat on each booking.
Payments, attempts, ledger entries, completion counters and accepted source offers are
created together in transactions. No real money moves.

Login credentials and booking IDs are written only to:
`backend/.local-integration/demo/demo-logins.json` (ignored by Git). Passwords are randomly
generated and stored before account creation so interrupted runs can resume. Reruns keep
passwords, account status, availability, profile edits and booking/payment progress. They
do not recreate a fresh awaiting-payment hold: it expires after the normal reservation
period, and requests/offers retain their normal expiry dates. This is deliberate; the
seed never rewinds user actions. For a completely fresh scenario use a separate empty
demo database and a separate local manifest directory (the exported seeding function
accepts `localDir`), rather than deleting financial history.

Add optional photos following [seed-assets/README.md](../seed-assets/README.md), then
rerun the command. Missing photos use initials; missing photos do not block the seed.
Upload failures stop the run and can be retried. Cloudinary remains the media provider;
there is no local-filesystem media bypass. An offline MongoDB alone does not make
Cloudinary uploads available offline.

## Existing data cleanup

Only the five known Integration IDs and generated `integration/manual-customer/worker-*
@example.test` accounts qualify. They are disabled, excluded from overview metrics,
sessions revoked, and their worker profiles made draft. A replacement active demo admin
is established first. Real users are kept. Their bookings are archived from admin active
lists. Pure test-to-test conversations/messages and unbooked junk offers are backed up
locally and removed; accepted offers remain as provenance. Mixed real/test chats remain.
Open requests belonging to the retired accounts are cancelled.

Cleanup never deletes payments, attempts, ledger entries, disputes or reviews. Backups
are ignored local JSON files alongside the login file. A narrow, audited repair corrects
three known Musa carpenter offers and their linked booking from Electrician to Carpentry.
Amounts, statuses, participants and all financial history are unchanged. Other historical
services are never guessed from a worker's current profile.

The seed uses stable IDs, checks identity/contact collisions, and takes an exclusive local
lock. If a process is forcibly killed, check no seed is running before removing its stale
`backend/.local-integration/demo/seed.lock`. Do not run from multiple machines concurrently.

## Manual checks

1. Sign in as a generated customer; inspect Requests, Offers, Bookings and Messages.
2. Open the awaiting-payment booking promptly and record a successful mock payment.
3. Sign in as its worker; start work after its scheduled start. Alternatively use the
   already-confirmed fixture, whose start time is in the past.
4. Use the in-progress fixture to mark completion, then the customer account to confirm
   and review. Use the completed fixture to test a review immediately.
5. Sign in as the demo admin to inspect the pending verification and open dispute.
6. Inspect mock payment history: held/released/disputed balances must match their bookings.
7. Run the command again: no duplicate accounts, bookings or ledger entries should appear.

Password recovery is not yet supported: its sign-in link is hidden and the three recovery
and verification placeholder routes redirect to `/login`.
