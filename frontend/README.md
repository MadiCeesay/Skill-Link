# SkillLink web application

Responsive customer, professional and administrator workspaces integrated with the existing SkillLink API. React 19, Vite, React Router, TanStack Query, Socket.IO and Lucide. Requires Node **22.12+**, the existing backend dependencies and MongoDB replica-set support for marketplace transactions.

## Run locally

From the repository root, use two terminals:

```powershell
cd backend
npm ci
npm run dev
```

Keep the existing backend `.env`. Follow `backend/README.md` for MongoDB, signing secrets, catalog/admin provisioning and Cloudinary configuration. Never put these secrets in the frontend. Configure `FRONTEND_ORIGIN=http://localhost:5173` for the browser origin you actually use.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:5173**. The only frontend variable is:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Use consistent hostnames: `localhost` and `127.0.0.1` are different origins. Vite listens on loopback port 5173. The API and Socket.IO must be reachable by the browser. No production data or demo passwords are bundled into the application. Create a customer/professional using registration; provision an administrator using the existing backend procedure.

## Commands

```powershell
npm test          # utility, authorization, component and API-client tests
npm run lint
npm run build
npm run preview  # built application on port 4173; adjust backend origin first
npm run test:e2e # real backend + temporary MongoDB replica set + isolated browser
```

The browser suite starts its own API on **5001** and Vite on **5174**, uses disposable test accounts and a protected in-memory media provider, and never reads the user's database URI. Install backend dependencies first. The harness uses an existing cached Windows MongoDB binary when available; otherwise mongodb-memory-server downloads one. Playwright uses installed Chrome on Windows or its Chromium browser elsewhere (`npx playwright install chromium`). Ports must be free. Browser microphone tests use fake browser audio only inside the test runner. HTML results are in `playwright-report/`; screenshots/traces are in `test-results/`. These generated files are gitignored.

## Important behavior

- Access and rotating refresh tokens stay **in memory**. Reloading or closing the tab requires signing in again. Tokens are not stored in localStorage, sessionStorage or JavaScript-readable cookies. API requests share one refresh operation; logout revokes the current server session and clears cached private data.
- All money is parsed as decimal GMD into safe **integer bututs**, with exact display using BigInt. One GMD is 100 bututs. Financial totals returned as integer strings stay exact.
- All proposed times are explicitly **Africa/Banjul**, transmitted as UTC. The backend validates weekly availability, blocked dates, conflicts, holds and lifecycle permissions. Public slot calendars are not exposed by the existing API; users propose a time, then the API validates it.
- Quote acceptance is followed by a separate scheduling/booking step. Direct proposals require professional acceptance and use the same centralized booking engine.
- Payments, held funds and earnings are **simulated**. No real checkout, card collection, withdrawal or money movement is offered.
- Private files are requested through authorized access endpoints and short-lived signed URLs. Conversation media uses conversation access checks, not owner-only URLs. Exact locations and protected identity documents never appear on public discovery cards.
- There is no bundled fake marketplace catalog, rating, professional count, revenue chart or testimonial. Empty API results produce purposeful empty states. Test fixtures live only under `tests/`.

## Documentation

- [Homepage/admin reliability and requested demo-worker removal](docs/marketplace-reliability.md)
- [Final manual-testing repairs, validation and FYP demonstration](docs/manual-testing-report.md)
- [Authenticated dashboard redesign and data mapping](docs/dashboard-redesign.md)
- [Final integration audit, verification and demo guide](docs/final-integration-report.md)
- [Current recovery audit and demo readiness](docs/recovery-audit.md)
- [Architecture, integration map and privacy](docs/architecture.md)
- [Completion report, QA and manual flows](docs/frontend-completion-report.md)
- [Asset sources and licenses](docs/assets.md)
- [Original requested scope](docs/frontend-specification.md)
- [Backend preservation manifest](docs/backend-baseline-hashes.json)

## Production hosting

Build with the public `VITE_API_URL` set at **build time**; serve `dist/` over HTTPS with an SPA fallback to `index.html` for application routes. Configure the backend's exact HTTPS frontend origin, Cloudinary protected delivery and MongoDB replica set according to its existing documentation. Proxy `/socket.io` with WebSocket upgrades (and polling if retained). No credentials belong in `VITE_*` variables. Apply CSP/security headers at the hosting layer with API, Socket.IO and protected media origins allowed; microphone recording requires HTTPS or localhost. Do not publish test servers or test fixtures as production API routes.

Password recovery/change, OTP/email verification, account identity editing, public availability slots, an admin-wide job listing and an audit-event listing have no supported backend endpoints. Their screens explain the limitation instead of issuing invented requests. Supplied privacy/terms pages explain current behavior and demo scope; operator-approved legal documents and actual support contacts are still needed for a public launch.
# Flexible pricing update

See [private quote requests and flexible pricing](docs/flexible-pricing.md) for the customer/worker workflow, compatibility, API rules and verification scope.

