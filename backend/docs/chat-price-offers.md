# Price offers in a pending proposal conversation

Either the customer or worker can propose a positive GMD price in an existing
`DIRECT_PROPOSAL` conversation. The API uses integer bututs (100 = GMD 1).
Only the other participant can accept or decline. New offers replace the previous
open offer; history retains the original amount, sender and outcome.

- `POST /api/conversations/:id/price-offers` — `{ "amountBututs": 65000 }`
- `POST /api/conversations/:id/price-offers/:offerId/respond` —
  `{ "decision": "ACCEPTED" }` or `{ "decision": "DECLINED" }`

Responses contain `offer` and `message`. Message history includes `PRICE_OFFER`
messages with a `priceOffer` summary and current status. Clients cannot post
PRICE_OFFER or SYSTEM messages through the ordinary message endpoint.

Acceptance changes `agreedAmountBututs` and sets the internal proposal mode to
`NEGOTIATED` and status to `PENDING`. This works for legacy, listed-price and
request-quote proposals. It invalidates earlier quote acceptance; original quote
history remains. It does **not** create a booking or charge the customer. The
worker confirms the proposal using the existing accept action to create an unpaid
booking, then the customer pays through the existing mock-payment flow. The UI
links back to the proposal after the price is agreed.

Transactions lock the same worker scheduling row used by proposal decisions,
booking creation and checkout. Acceptance calls the shared booking-terms validator:
active customer, eligible verified public worker, matching service/area, future
schedule, availability and no overlapping reservation/booking. The agreed amount,
offer outcome and system message commit together. Failed validation or message
insertion rolls the entire response back. Self-acceptance, outsiders, stale offers,
expired/closed proposals and any proposal with a booking are rejected. Consequently
paid booking amounts and ledger history cannot be renegotiated through chat.

A partial unique index permits one OPEN offer per proposal. The same transaction
replaces the old offer and inserts the new one. Responses are single-use and races
serialize on the shared worker lock. An unanswered offer on a subsequently closed
proposal is displayed as closed and cannot be answered.

Socket.IO uses the existing authenticated conversation rooms and recipient
reauthentication on delivery. Committed REST writes emit `price-offer` with the
same response data. Socket writes are also supported:

- `price-offer:send`: `{ conversation, offer: { amountBututs } }`
- `price-offer:respond`: `{ conversation, offerId, response: { decision } }`

These have the existing authenticated acknowledgement and rate-limit policy.
The frontend refetches conversation, history and proposal data on events and
reconnect; the REST view remains available with periodic refresh when disconnected.
No private identity, email or phone fields are added.
