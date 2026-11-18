// Modem Pay: Gambian payment processor for Wave, Afrimoney, QMoney, APS and cards.
// See backend/docs/modem-pay.md.
//
// Flow: SkillLink creates a payment intent, the customer pays on Modem Pay's hosted
// checkout page, and Modem Pay tells SkillLink the result through a signed webhook.
// SkillLink can also ask Modem Pay for the intent's status (used when the customer
// returns, and on localhost where webhooks cannot reach the server).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../../utils/ApiError.js';

const MODEMPAY_API = 'https://api.modempay.com/v1/payments';
const SUCCEEDED = ['succeeded', 'successful', 'success', 'completed', 'paid'];
const FAILED = ['failed', 'cancelled', 'canceled', 'expired'];

/** Maps Modem Pay's intent or transaction status to SUCCEEDED, FAILED or PENDING. */
export function intentOutcome(status) {
  const value = String(status || '').toLowerCase();
  if (SUCCEEDED.includes(value)) return 'SUCCEEDED';
  if (FAILED.includes(value)) return 'FAILED';
  return 'PENDING';
}

export class ModemPayProvider {
  name = 'modempay';
  // The customer is sent to Modem Pay's page instead of SkillLink recording a result.
  redirects = true;

  /**
   * @param {object} options
   * @param {string} options.secretKey sk_test_... or sk_live_..., server only
   * @param {string} [options.webhookSecret] from Modem Pay dashboard → Developers → Webhooks
   * @param {'GMD'|'BUTUT'} [options.amountUnit] how Modem Pay reads `amount`
   * @param {string} options.frontendOrigin where customers return after paying
   * @param {string} [options.callbackUrl] public URL of SkillLink's webhook endpoint
   */
  constructor({ secretKey, webhookSecret, amountUnit = 'GMD', frontendOrigin, callbackUrl, fetchImpl = globalThis.fetch, timeoutMs = 20000 }) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
    this.amountUnit = amountUnit;
    this.frontendOrigin = frontendOrigin;
    this.callbackUrl = callbackUrl;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  /** SkillLink stores money in bututs (1 GMD = 100 bututs). */
  toProviderAmount(bututs) {
    return this.amountUnit === 'BUTUT' ? bututs : Math.round(bututs) / 100;
  }

  async request(method, url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.secretKey },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Modem Pay is not responding. Please try again.');
    } finally {
      clearTimeout(timer);
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('[modempay] ' + method + ' failed: HTTP ' + response.status + ' ' + String(result?.message || result?.error || '').slice(0, 200));
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'Modem Pay could not start the payment. Please try again.');
    }
    // Responses are wrapped in { data: ... }; accept both shapes.
    return result?.data ?? result;
  }

  /** Creates a payment intent and returns the checkout page to send the customer to. */
  async createCheckout({ bookingId, paymentId, amountBututs }) {
    const back = this.frontendOrigin + '/app/bookings/' + bookingId + '/payment?modempay=';
    const intent = await this.request('POST', MODEMPAY_API, {
      data: {
        amount: this.toProviderAmount(amountBututs),
        currency: 'GMD',
        title: 'SkillLink booking',
        description: 'Payment for SkillLink booking ' + String(bookingId).slice(-6).toUpperCase(),
        // Lets the webhook find the right SkillLink payment.
        metadata: { booking_id: String(bookingId), payment_id: String(paymentId) },
        return_url: back + 'return',
        cancel_url: back + 'cancelled',
        ...(this.callbackUrl ? { callback_url: this.callbackUrl } : {}),
        from_sdk: false,
      },
    });
    if (!intent?.id || !intent?.payment_link)
      throw new ApiError(502, 'INVALID_PROVIDER_RESPONSE', 'Modem Pay returned an invalid response');
    return { reference: String(intent.id), redirectUrl: String(intent.payment_link) };
  }

  /** Asks Modem Pay for the current state of a payment intent. */
  async retrieve(intentId) {
    const intent = await this.request('GET', MODEMPAY_API + '/' + encodeURIComponent(intentId));
    return { outcome: intentOutcome(intent?.status), status: intent?.status, amount: intent?.amount ?? null };
  }

  /**
   * Checks the x-modem-signature header: HMAC-SHA512 of the request body with the
   * webhook secret, as hex (the same check as Modem Pay's own SDK).
   */
  verifySignature(rawBody, signature) {
    if (!this.webhookSecret || typeof signature !== 'string' || !signature) return false;
    const candidates = [rawBody];
    // Modem Pay's SDK signs JSON.stringify(body); accept that form too.
    try { candidates.push(JSON.stringify(JSON.parse(rawBody))); } catch { return false; }
    return candidates.some(body => {
      const expected = createHmac('sha512', this.webhookSecret).update(body).digest('hex');
      return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    });
  }
}
