# 📻 Nostalgia Radio — Multi-Theme Playlist Website

**Frontend → Vercel · Backend (real-time chat) → Render**

8 themes, 20 gaane har theme mein, live chat, live "online" counter, clean
mobile-first UI. Do hisso mein bant chuki hai taaki tum apne plan ke hisaab
se deploy kar sako.

```
project/
├── frontend/     → Vercel par deploy hogi (static site)
│   ├── index.html
│   ├── css/style.css
│   └── js/ (data.js, config.js, app.js)
├── backend/       → Render par deploy hoga (Node + Socket.IO server)
│   ├── server.js
│   └── package.json
└── render.yaml     → optional, Render "Blueprint" ke liye
```

## 🎵 Themes (8 total, 20-20 songs)
1. 🧱 राजू मिस्त्री Playlist — Construction site
2. 📻 पापा के ज़माने के गाने — Retro Bollywood
3. 🐃 भोजपुरी Bangers — Bhojpuri & Bihari hits
4. 💻 Corporate Majdoor — 9-to-5 lo-fi/chill
5. 🍽️ बर्तन Time — Kitchen-chore nostalgia
6. 🚌 बस ड्राइवर — Highway raat playlist
7. 💃 शादी की बाराथ — Wedding/baraat dance
8. 🏏 गली क्रिकेट Josh — Cricket/sports anthem

---

## 🚀 Step 1 — Backend deploy karo (Render)

1. Poore `project` folder ko ek naye **GitHub repo** mein push kar do.
2. https://render.com par jao → free account (card nahi chahiye) → **New +** → **Web Service**.
3. Apna GitHub repo connect karo.
4. Settings bharo:
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. **Create Web Service** dabao. 2-3 minute mein deploy ho jayega, tumhe URL milega jaisa:
   `https://nostalgia-radio-backend.onrender.com`
6. *(Optional but recommended)* Render → apni service → **Environment** tab mein
   `ALLOWED_ORIGIN` variable add karo, value apni Vercel site ka URL
   (jaise `https://nostalgia-radio.vercel.app`) — step 2 ke baad pata chalega,
   tab wapas aake daal dena.

> **Free tier note:** Render ka free web service ~15 min inactivity ke baad
> so jaata hai, agli request par 20-30 second mein wapas jaag jaata hai. Chat
> history bhi in-memory hai (restart par reset ho jaati hai) — live-chat vibe
> ke liye bilkul theek hai.

## 🚀 Step 2 — Frontend deploy karo (Vercel)

1. Usi GitHub repo ko https://vercel.com par import karo (free account).
2. Project settings mein **Root Directory** ko `frontend` set karo.
3. Framework Preset: **Other** (ye plain static site hai, build command
   khaali chhod do, output directory bhi khaali/`./`).
4. **Deploy** dabao. 1 minute mein live ho jayegi:
   `https://<tumhara-project>.vercel.app`

## 🔗 Step 3 — Dono ko jodo

1. `frontend/js/config.js` kholo, ye line update karo:
   ```js
   window.BACKEND_URL = "https://nostalgia-radio-backend.onrender.com";
   ```
   (apna Step-1 wala Render URL daalo.)
2. GitHub par push karo — Vercel khud-ba-khud redeploy kar dega.
3. Bas — ab **real live chat + real online-count** sabke beech chalu hai.

Isko bina kiye bhi site chalti hai (Demo Mode — chat sirf tumhare apne
browser tak) — ye ek line hi hai jo deploy ke baad bharni padti hai, kyunki
Render tumhara backend URL pehle se predict nahi kiya ja sakta.

---

## 🆓 Gaane kaise bajte hain (bilkul free)

Har track YouTube ke **official embedded player** se stream hota hai —
search-based embed use hota hai, isliye kisi video ID ko dhundhne ki
zaroorat nahi, site "as-is" chal jaati hai.

Exact YouTube video chahiye kisi gaane ke liye:
```js
// frontend/js/data.js mein
{ "t": "Roop Tera Mastana", "a": "Kishore Kumar Era", "yt": "VIDEO_ID_YAHAN" }
```
`VIDEO_ID` YouTube URL ke `watch?v=` ke baad wala hissa hota hai.

100% free & legal — kuch bhi is repo mein hosted nahi hota, saara audio
YouTube se aata hai, rights holders ko unka revenue milta rehta hai.

---

## 💻 Local development (test karne ke liye)

```bash
# Backend
cd backend
npm install
npm start          # http://localhost:3001 par chalega

# Frontend — kisi bhi simple static server se, e.g.:
cd frontend
npx serve .         # ya VS Code "Live Server" extension
```
Local test ke liye `frontend/js/config.js` mein
`window.BACKEND_URL = "http://localhost:3001";` set kar do.

---

## ➕ Naya theme ya gaana add karna

`frontend/js/data.js` khol lo — simple array hai:
```js
{
  "id": "unique-id",
  "icon": "🎸",
  "title": "Naya Theme Title",
  "tag": "Chhoti tagline",
  "accent": "#hexcolor",
  "heroBg": "linear-gradient(160deg,#color1,#color2 55%,#color3)",
  "quotes": [["Quote text","Kisne bola"]],
  "tracks": [ {"t":"Song Name","a":"Artist/Era"}, ... 20 tracks ... ],
  "svg": "<svg>...</svg>"
}
```
Naya theme add karne par backend mein kuch change nahi karna padta — server
har theme ke liye khud-ba-khud ek chat room bana deta hai.

---

## ⚠️ Disclaimer
Koi bhi audio is repo/site mein hosted nahi hai. Saara playback YouTube ke
embedded player ke through hota hai; saare rights unke respective
labels/composers/performers ke paas hain. Song titles/artists sirf
reference ke taur par listed hain.
