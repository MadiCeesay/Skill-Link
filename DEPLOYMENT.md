# Deploying SkillLink for testing

The backend runs on **Render**, the frontend on **Vercel** and the database on **MongoDB Atlas**.
Do the steps in this order, because each one needs a URL from the one before.

## 1. Database: MongoDB Atlas (free M0)

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Database Access: add a user with a password.
3. Network Access: allow `0.0.0.0/0`. Render's free tier has no fixed IP address.
4. Connect → Drivers: copy the `mongodb+srv://...` string and add the database name, e.g.
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/skilllink?retryWrites=true&w=majority`

Atlas clusters are replica sets, so the app's transactions work without any extra setup.

## 2. Backend: Render

1. Render → **New → Blueprint**, pick this repo. Render reads `render.yaml`.
2. Fill in the values it asks for:
   - `MONGODB_URI`: the Atlas string from step 1.
   - `FRONTEND_ORIGIN`: put `https://example.com` for now. You'll change it in step 4.
   - `PUBLIC_API_URL`: the Render URL, e.g. `https://skilllink-api.onrender.com`.
   - `MODEMPAY_SECRET_KEY` / `MODEMPAY_WEBHOOK_SECRET`: from the Modem Pay dashboard in test mode.
     For a demo without Modem Pay, set `PAYMENT_PROVIDER=mock` instead.
3. Once it's deployed, open `https://<your-api>.onrender.com/api/health`. You should see `{"success":true,...}`.

Free Render services go to sleep after 15 minutes without traffic. The first request after
that takes about 50 seconds, so open the health URL before you start a test session.

## 3. Frontend: Vercel

1. Vercel → **Add New → Project**, import this repo.
2. **Root Directory: `frontend`**. The framework is detected as Vite.
3. Environment variable: `VITE_API_URL = https://<your-api>.onrender.com/api`
4. Deploy and copy the URL, e.g. `https://skill-link.vercel.app`.

## 4. Connect the two

1. On Render, set `FRONTEND_ORIGIN` to the exact Vercel URL (`https://`, no trailing slash) and save.
   Render redeploys on its own. CORS and Socket.IO only accept this one origin.
2. In the Modem Pay dashboard, set the webhook URL to
   `https://<your-api>.onrender.com/api/payments/modempay/webhook`.

Use the main production URL (`*.vercel.app`) for testing. Preview URLs have a different origin,
so the API will refuse them.

## 5. Accounts and demo data (optional)

Render's free tier has no shell. Run the seed scripts from your laptop against Atlas instead:

```
cd backend
MONGODB_URI="mongodb+srv://..." npm run seed:admin   # also needs ADMIN_* variables, see .env.example
MONGODB_URI="mongodb+srv://..." npm run seed:demo
```

## 6. Optional features

| Feature | Variables on Render |
| --- | --- |
| Photos, verification documents, voice notes | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, then `MEDIA_PROVIDER=cloudinary` |
| AI job description helper | `GEMINI_API_KEY` |
| Voice-note transcripts | `ELEVENLABS_API_KEY` |

## Two-person test plan

One person signs up as a **customer**, the other as a **worker**. Ideally use different
browsers or phones.

1. Worker: complete the profile, services, prices and **availability**, then get verified
   (the admin approves it).
2. Customer: find the worker, send a request for a time **within the worker's availability**.
3. Worker: accept it, or send a quote that the customer then accepts. This creates the booking.
4. Customer: pay within **15 minutes**. The payment page shows a countdown. Modem Pay test wallets
   and cards don't move real money.
5. Worker: at the scheduled time, **Start work**, then **Mark complete**.
6. Customer: confirm the work and leave a review. Also try chat, voice notes and a dispute.

Things to note while testing: anything confusing, any error message, and anything that looks
different on a phone.
