# SMS alerts (SMS.to)

Many people in The Gambia do not keep an app open, so SkillLink can text them when
something important happens. In-app notifications stay the main channel; SMS is extra.

## Turning it on

In `backend/.env` (and in Render → Environment for the live site):

```
SMS_PROVIDER=smsto
SMSTO_API_KEY=...        # from the SMS.to dashboard (API keys)
SMSTO_SENDER_ID=SkillLink
```

## When a text is sent

| Event | Who | Text (plus a link to SkillLink) |
|---|---|---|
| New offer on a request | customer | You received a new offer for your request. |
| Direct price / booking request | worker | A customer asked you for a price / wants to book you. |
| Offer accepted | worker | Good news: your offer was accepted. |
| Booking ready to pay / confirmed / cancelled | both | Your booking is ready / confirmed / cancelled. |
| Work marked complete | customer | The work is marked complete. Please check it and confirm. |
| Payment released | worker | Payment for your completed job was released. |
| Identity verification approved | worker | Your identity verification was approved. |

Chat messages and minor updates are not texted.

## Rules

- Texts contain no names, amounts, addresses or phone numbers, only what happened and a link.
- Each event is texted once, even if the notification is raised again.
- Sending happens in the background: an SMS failure never blocks or undoes the action,
  and the in-app notification is always kept. Failures are logged as `[sms] … not sent`.
- The number comes from the user's account (+220 format).

## Tests

`tests/unit/sms-provider.test.js` and `tests/integration/sms-alerts.test.js`.
