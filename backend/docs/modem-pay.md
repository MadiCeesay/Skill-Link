# Modem Pay payments (test mode)

SkillLink can take real mobile-money and card payments through [Modem Pay](https://modempay.com),
a Gambian gateway that supports Wave, Afrimoney, QMoney, APS and cards. The simulated
provider stays the default, so tests and offline demos are unchanged.

## Turning it on

In `backend/.env`:

```
PAYMENT_PROVIDER=modempay
MODEMPAY_SECRET_KEY=sk_test_...        # from the Modem Pay dashboard (test mode)
MODEMPAY_WEBHOOK_SECRET=...            # webhook signing secret from the dashboard
MODEMPAY_AMOUNT_UNIT=GMD               # switch to BUTUT if Modem Pay shows 100x amounts
PUBLIC_API_URL=https://<your-api>      # only when deployed; leave empty on localhost
```

Restart the backend. The Payment page then shows **Pay with Modem Pay** instead of the
simulated result picker.

## How a payment flows

1. The customer presses **Pay with Modem Pay**. `POST /api/payments/bookings/:id/checkout`
   creates a `PENDING` payment and a Modem Pay payment intent (`POST /v1/payments`) with the
   booking and payment ids in `metadata`, and returns the hosted `payment_link`.
2. The browser goes to Modem Pay. The customer pays with a wallet or card.
3. Modem Pay confirms the result in two independent ways:
   - **Webhook** `POST /api/payments/modempay/webhook`. The `x-modem-signature` header is an
     HMAC-SHA512 of the raw body with the webhook secret; unsigned or altered calls get 400.
     `charge.succeeded` holds the money, `charge.failed` / `payment_intent.cancelled` mark the
     payment failed. Other events are acknowledged and ignored.
   - **Return check** `POST /api/payments/bookings/:id/verify`. When the customer comes back
     (`?modempay=return`), the page asks the server to fetch the intent from Modem Pay
     (`GET /v1/payments/:id`). This makes localhost demos work, where webhooks cannot reach.
4. On success the same code as before runs: payment `HELD`, three ledger entries
   (customer payment, platform fee, worker pending earning) and booking `CONFIRMED`.

## Safety rules

- Results are applied inside a transaction with the worker lock and are idempotent: repeated
  webhooks or return checks never create extra ledger entries.
- The paid amount must equal the booking amount, otherwise 409 and nothing changes.
- A payment that succeeds after the booking closed is logged for a manual refund in the
  Modem Pay dashboard instead of reopening the booking.
- Only the booking's customer can start or verify a payment.
- The secret key never reaches the browser; provider errors are shown as a generic message.

## Tests

- `tests/unit/modempay-provider.test.js` — request format, amount units, status mapping,
  signature checks.
- `tests/integration/modempay.test.js` — checkout link, idempotent retry, signed webhook,
  bad signature, wrong amount, failure and retry, return check, access control (uses a fake
  Modem Pay API, no network).
