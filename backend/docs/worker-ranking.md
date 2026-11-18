# Worker ranking ("Recommended for you")

The default order on the professionals page. Each matching worker gets a score from 0 to 100, and each card shows up to three plain-language reasons, for example "Within about 5 km", "Rated 4.8 from 12 reviews", "Usually replies within an hour".

Code: `src/modules/ranking/ranking.score.js` (formula) and `src/modules/ranking/response-stats.js` (responsiveness data). Used by `src/modules/discovery/discovery.service.js` when `sort=recommended`.

## Formula

score = 100 × (0.30 × distance + 0.20 × rating + 0.15 × trust + 0.15 × responsiveness + 0.10 × experience + 0.10 × availability)

| Factor | How it is turned into a number from 0 to 1 | Why |
|---|---|---|
| Distance | 1 / (1 + km / 5); 0.5 if the customer gave no location | Closer workers arrive sooner and cost less to travel |
| Rating | Bayesian average with a prior of 3 reviews at 3.5 stars, mapped from 1–5 to 0–1 | One lucky 5-star review cannot beat a long good record; new workers are not buried |
| Trust | 0.6 for approved identity + 0.4 for reviewed work evidence | Safety is the main worry when inviting someone home |
| Responsiveness | answer rate × (0.5 + 0.5 × speed), speed = 1 / (1 + average minutes / 60); 0.5 until the worker has 3 answers | Unanswered requests were the main reason proposals expired |
| Experience | log(1 + jobs) / log(21), capped at 1 | The first completed jobs say more than the twentieth |
| Availability | 1 if "available now", otherwise 0.3 | Helps urgent jobs without hiding busy workers |

Responsiveness uses direct requests from the last 180 days. Requests the customer cancelled before an answer, and requests that are still open, are ignored. A request the worker let expire counts as not answered. `DirectProposal.respondedAt` records the worker's first accept, decline or quote; older requests fall back to `updatedAt`.

## Privacy

Only the score and the reasons leave the server. The exact distance, the coordinates and the factor breakdown are never returned. Distance reasons use the same 5 km bands as the rest of the public site.

## Limits

- Up to 500 matching workers are ranked per search; enough for the current marketplace.
- The weights are a reasoned starting point, not learned from data. Once there are enough bookings, they can be tuned using the evaluation below.

## How to evaluate it

1. **Ranking quality:** for real searches, record which position the customer opened or booked. A useful ranking makes position 1–3 far more common than a plain list would.
2. **Comparison:** run the same searches with `sort=relevance` (verified first, then nearest) and compare how often customers pick from the top three.
3. **Fairness check:** confirm new workers with no reviews still appear on the first page for nearby searches.
