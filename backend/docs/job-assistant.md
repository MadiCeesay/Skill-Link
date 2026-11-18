# AI job description assistant

Helps a customer turn a rough description, a photo or a voice note into a clear job request. The customer always reviews and edits the draft before posting; nothing is posted automatically.

Code: `src/modules/assistant/` (service and routes) and `src/providers/ai/gemini.provider.js` (Google Gemini client). Frontend: `frontend/src/components/JobAssistant.jsx`, shown at the top of **Post request**.

## What it returns

| Field | Meaning |
|---|---|
| title, description | Clear text a worker can quote from, in simple English |
| service | The matching service from SkillLink's own catalog, or empty if nothing fits |
| urgency | LOW, NORMAL or URGENT |
| followUpQuestions | Up to 3 questions about things the customer did not say |
| safetyNote | A short warning for risks such as exposed wires or a gas smell |
| priceRange | See below |
| transcript, detectedLanguage | English version of a voice note and the language spoken |

## Price range

1. If the chosen service has at least 3 SkillLink bookings in the last year (confirmed or later), the range is the **middle half of real prices** (25th to 75th percentile), labelled "Based on N SkillLink jobs".
2. Otherwise it is the **AI's estimate**, labelled as a rough estimate.

Both are rounded to the nearest 50 GMD and kept between GMD 50 and GMD 200,000.

## Safety and privacy

- Text with phone numbers, emails or social links is refused **before** anything is sent to the AI.
- Only the customer's own uploads can be used: their job photos (up to 3) and their own voice note.
- No name, phone, email, address or location is sent.
- The AI's answer is checked against a strict format; answers that are malformed or contain contact details are discarded.
- Each customer can use it 10 times per hour.
- Without `GEMINI_API_KEY` the feature is switched off and the button is hidden; the app works as before.

Note: on Gemini's free tier, Google may use inputs to improve its products. Use a paid key for real customer data.

## Settings

```
GEMINI_API_KEY=        # from https://aistudio.google.com, server only
GEMINI_MODEL=gemini-flash-latest
```

## How to evaluate it

1. Collect 30 real job descriptions from customers or workers, including some in Wolof or Mandinka voice notes.
2. For each, record whether the assistant chose the right service, whether the description was accurate (nothing invented), and whether customers edited it heavily.
3. Report: correct service rate, accuracy rate, and average edits. Compare the AI price ranges with what workers actually quoted.
