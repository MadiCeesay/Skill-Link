// SMS alerts through SMS.to (https://sms.to). Messages are short, contain no contact
// details or payment data, and only point people back to SkillLink.
const SMSTO_API = 'https://api.sms.to/sms/send';

export class SmsToProvider {
  constructor({ apiKey, senderId = 'SkillLink', fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
    if (!apiKey) throw new Error('SMS.to needs an API key');
    this.apiKey = apiKey;
    // Alphanumeric sender IDs are limited to 11 characters.
    this.senderId = String(senderId).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 11) || 'SkillLink';
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.available = true;
  }

  async send({ to, message }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(SMSTO_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.apiKey },
        body: JSON.stringify({ to, message, sender_id: this.senderId }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success === false) {
        throw new Error('HTTP ' + response.status + ' ' + String(body?.message || '').slice(0, 160));
      }
      return { delivered: true, id: body?.message_id ?? body?.data?.message_id ?? null };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class DisabledSmsProvider {
  available = false;
  async send() {
    return { delivered: false };
  }
}

// Which notifications also go out by SMS, and their text. Kept generic on purpose:
// no names, amounts, addresses or phone numbers.
const SMS_TEXT = {
  NEW_QUOTE: 'You received a new offer for your request.',
  PROFESSIONAL_QUOTE_RECEIVED: 'A professional sent you a price for your job.',
  QUOTE_REQUESTED: 'A customer asked you for a price for a job.',
  PROPOSAL_PENDING: 'A customer wants to book you for a job.',
  QUOTE_ACCEPTED: 'Good news: your offer was accepted.',
  BOOKING_AWAITING_PAYMENT: 'Your booking is ready. Pay to confirm it.',
  BOOKING_CONFIRMED: 'Your booking is confirmed.',
  BOOKING_WORKER_MARKED_COMPLETED: 'The work is marked complete. Please check it and confirm.',
  PAYMENT_RELEASED: 'Payment for your completed job was released.',
  BOOKING_CANCELLED: 'A booking was cancelled.',
  VERIFICATION_APPROVED: 'Your identity verification was approved.',
};

export function smsText(type, appUrl) {
  const text = SMS_TEXT[type];
  if (!text) return null;
  return 'SkillLink: ' + text + (appUrl ? ' Open ' + appUrl.replace(/^https?:\/\//, '') : ' Open SkillLink to see it.');
}
