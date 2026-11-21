# Put Khit Ride online (so you can open it on your phone)

Vercel hosts the **React website**. The **Spring Boot API + database** cannot run on Vercel, so it is hosted separately (Render below).

## Option A - phone on the same Wi-Fi (2 minutes, no account)
1. Find your PC's IP: `ipconfig` -> "IPv4 Address" (e.g. 192.168.1.20).
2. In `frontend`, create `.env` with `VITE_API=http://192.168.1.20:8081`.
3. Start the backend, then `npm run dev -- --host` in `frontend`.
4. On the phone open `http://192.168.1.20:5173` (allow Java/Node through Windows Firewall if asked).

## Option B - public link
1. Push the project to GitHub (do NOT commit any API keys).
2. **Backend on Render**: render.com -> New -> Blueprint -> pick your repo (it reads `render.yaml`). Wait for the deploy, then copy the service URL, e.g. `https://khit-api.onrender.com`. Test `https://khit-api.onrender.com/api/products`.
   - Optional: add `ANTHROPIC_API_KEY` in the service's Environment tab for full AI chat answers.
3. **Website on Vercel**: vercel.com -> Add New Project -> import the same repo -> set **Root Directory = frontend** -> add environment variable `VITE_API` = your Render URL (no trailing slash) -> Deploy.
4. Open the Vercel link on your phone.

Notes
- Free Render services go to sleep when idle; the first request can take a minute. Check Render's current free-tier limits.
- Photos uploaded in the back office are stored on the server's disk and may disappear when a free instance restarts. Photos in `frontend/public/images` are part of the website and are safe.
- Payments are a demo; no real money moves.
