# Nostalgia Radio

Ek theme, ek playlist, ek adda — live YouTube radio + live chat, private rooms ke saath.

## Structure
```
nostalgia-radio/
├── frontend/          → Vercel par deploy hota hai (static site)
│   ├── index.html
│   ├── css/style.css
│   └── js/ (config.js, data.js, app.js)
├── backend/            → Render par deploy hota hai (Node/Express + Socket.IO)
│   ├── server.js
│   └── package.json
├── render.yaml
└── vercel.json
```

## Deploy — Backend (Render)
1. Repo ko GitHub par push karo.
2. Render → New → Web Service → is repo ko select karo.
3. Root directory: `backend` (render.yaml already isse set kar deta hai agar "Blueprint" se deploy karo).
4. Build command: `npm install`, Start command: `npm start`.
5. Env var `ALLOWED_ORIGIN` ko apne Vercel domain se set karo (e.g. `https://your-app.vercel.app`) — security ke liye `*` se better hai.
6. Deploy hone ke baad backend URL milega, jaisa `https://your-backend.onrender.com`.

## Deploy — Frontend (Vercel)
1. Vercel → New Project → isi repo ko import karo.
2. Root Directory ko repo root par hi rehne do (vercel.json khud `frontend/` ko output folder bata deta hai). Agar Vercel dashboard mein "Root Directory" already `frontend` set hai to `vercel.json` delete kar sakte ho — dono tarike chalte hain.
3. `frontend/js/config.js` mein `window.BACKEND_URL` ko apne live Render URL se match karke rakho (already set hai).
4. Deploy karo.

## YouTube Data API key — ZAROORI HAI
Ye app har gaane ke liye seedha **YouTube Data API v3** se exact video dhoondhta hai (search-fallback jaanboojh kar hata diya gaya hai). Bina key ke koi gaana nahi bajega.

**Key kahan daalni hai:** sirf `frontend/js/config.js` mein — `index.html` ya kisi aur file mein kuch nahi badalna.

1. https://console.cloud.google.com/ → naya project banao.
2. "APIs & Services" → "Library" → "YouTube Data API v3" → Enable.
3. "APIs & Services" → "Credentials" → "Create Credentials" → "API key".
4. Us key ko `frontend/js/config.js` mein `window.YOUTUBE_API_KEY = "..."` wali line mein paste karo.

Free tier har din 100 search calls ke barabar quota deta hai; app har gaana ek baar resolve hone ke baad us user ke browser mein cache kar leta hai, isliye quota zyada tension nahi degi.

## Features
- 4 clean tabs: **Playlist** (player), **Chat**, **Profile**, **About** — home screen par sirf play/pause/next/prev, koi song-list kabhi nahi dikhti.
- Real play / pause / **resume** via YouTube IFrame Player API (iframe reload nahi hota — sahi resume milta hai).
- Har theme ka apna live chat room; default theme **Deluxe Salon**.
- **Private rooms**: koi bhi 6-char code wala apna khud ka chat room bana sakta hai — sirf jinke paas code hai wahi dekh sakte hain. Gaana peeche chalta rehta hai.
- Naya visitor jab pehli baar Chat kholta hai, tabhi naam poocha jaata hai (Profile tab se bhi naam set/edit ho sakta hai).
- Backend restart hone par chat history reset ho jaati hai (in-memory) — ye jaanboojh kar hai, "live vibe" ke liye.
