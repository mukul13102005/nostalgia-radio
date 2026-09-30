/**
 * Nostalgia Radio — Backend
 * Real-time chat + live online count, plus a small proxy so the YouTube
 * API key never has to live in the frontend. Deploy this folder on Render.
 *
 * Required environment variable (set in Render's dashboard, never in git):
 *   YOUTUBE_API_KEY — a YouTube Data API v3 key. Without it, /api/yt-search
 *   still runs but returns {error:"not_configured"} and songs won't play.
 *
 * Socket.IO protocol (unchanged, so old + new frontends both work):
 *   client -> server : "join" {theme, name, cid?}   "chat message" {text}
 *   server -> client : "history" [msgs]   "chat message" {name,text,ts,cid}
 *                      "online" number    "join_error" reason   "rate" ms
 *
 * HTTP:
 *   GET /health              -> {ok, up, rooms, online}
 *   GET /api/yt-search?q=... -> {videoId} | {error}
 */
"use strict";

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

/* ------------------------------------------------------------------ *
 * Allowed origins.  ALLOWED_ORIGIN can be "*" (default) or one or more
 * comma-separated URLs, e.g. https://my-site.vercel.app
 * (Applies to normal requests AND to WebSocket connections.)
 * ------------------------------------------------------------------ */
const ORIGINS = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const ANY_ORIGIN = ORIGINS.length === 0 || ORIGINS.includes("*");
const originOk = (origin) => ANY_ORIGIN || !origin || ORIGINS.includes(origin);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Render sits behind a proxy
app.use(cors({ origin: (origin, cb) => cb(null, originOk(origin)) }));

app.get("/", (req, res) => {
  res.type("text/plain").send("Nostalgia Radio backend is running. Connect via Socket.IO.");
});
app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, up: Math.round(process.uptime()), rooms: rooms.size, online: io.engine.clientsCount });
});

/* Frontend asks US to find a song's YouTube video ID, instead of calling
   YouTube directly with a key embedded in the page (that key would be
   visible to anyone who opens dev tools on a public GitHub-deployed site). */
app.get("/api/yt-search", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!ytLimiterOk(req.ip)) return res.status(429).json({ error: "rate_limited" });

  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 150) : "";
  if (!q) return res.status(400).json({ error: "bad_request" });

  const cached = ytCacheGet(q);
  if (cached) return res.json({ videoId: cached });

  const key = (process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) return res.status(503).json({ error: "not_configured" });

  try {
    const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&videoEmbeddable=true&q="
      + encodeURIComponent(q) + "&key=" + key;
    const ytRes = await fetch(url);
    const data = await ytRes.json();
    if (data.error) {
      const reason = (data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || data.error.status || "";
      const quota = reason === "quotaExceeded" || reason === "dailyLimitExceeded";
      console.error("yt-search upstream error:", reason || data.error.message);
      return res.status(quota ? 503 : 502).json({ error: quota ? "quota_exceeded" : "upstream_error" });
    }
    const videoId = data.items && data.items[0] && data.items[0].id && data.items[0].id.videoId;
    if (!videoId) return res.json({ error: "not_found" });
    ytCacheSet(q, videoId);
    res.json({ videoId });
  } catch (err) {
    console.error("yt-search fetch failed:", err && err.message);
    res.status(502).json({ error: "upstream_error" });
  }
});

const server = http.createServer(app);
// Render's load balancer keeps connections alive longer than Node's 5s default;
// without this you get random 502s on the first request after an idle period.
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000;

const io = new Server(server, {
  cors: { origin: ANY_ORIGIN ? "*" : ORIGINS, methods: ["GET", "POST"] },
  allowRequest: (req, cb) => cb(null, originOk(req.headers.origin)),
  maxHttpBufferSize: 8 * 1024, // chat messages are tiny; default (1 MB) is an easy DoS
  perMessageDeflate: false, // saves CPU/RAM on the free plan
  pingInterval: 20000,
  pingTimeout: 20000
});

/* ------------------------------ limits ---------------------------- */
const MAX_HISTORY = 80; // messages kept per room
const MAX_ROOMS = 300; // hard cap so nobody can fill the server's memory
const MSG_GAP_MS = 400; // min gap between two messages of one socket
const BURST_MAX = 8; // ...and at most 8 messages
const BURST_WINDOW_MS = 10 * 1000; // ...per 10 seconds
const JOIN_MAX = 20; // join events per 10 s (a real user never gets near this)
const PRIVATE_TTL_MS = 5 * 60 * 1000; // empty private room is wiped after 5 min
const PUBLIC_TTL_MS = 60 * 60 * 1000; // empty theme room is wiped after 1 hour

const PUBLIC_RE = /^(?!priv_)[a-z0-9_]{2,24}$/; // theme ids from frontend/js/data.js
const PRIVATE_RE = /^priv_[A-Z0-9]{6}$/; // private room codes

/* ------------------------------ state ----------------------------- */
const rooms = new Map(); // roomId -> { history: [], emptySince: ms|null }
const meta = new Map(); // socket.id -> { room, name, cid, lastMsgAt, burst[], joins[] }

/* Resolved YouTube video IDs, shared across every visitor — most people
   pick from the same 180-song playlists, so this alone avoids the vast
   majority of repeat searches (the free API quota is ~100 searches/day). */
const YT_CACHE_MAX = 4000;
const ytCache = new Map(); // normalized query -> videoId
function ytCacheGet(q) { return ytCache.get(q) || null; }
function ytCacheSet(q, id) {
  if (ytCache.size >= YT_CACHE_MAX) ytCache.delete(ytCache.keys().next().value); // evict oldest
  ytCache.set(q, id);
}

/* Small fixed-window limiter so this endpoint (which spends a shared,
   quota-limited YouTube key) can't be hammered by one visitor. */
function makeLimiter(max, windowMs) {
  const hits = new Map(); // key -> {count, resetAt}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || now > h.resetAt) { h = { count: 0, resetAt: now + windowMs }; hits.set(key, h); }
    h.count++;
    return h.count <= max;
  };
}
const ytLimiterOk = makeLimiter(30, 60 * 1000); // 30 searches/min per IP — generous for real use, blocks scraping

/* ----------------------------- helpers ---------------------------- */
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/g;
// zero-width + bidi-override characters (used to fake names / hide text).
// ZWJ/ZWNJ are kept on purpose: emoji sequences and Hindi conjuncts need them.
const INVISIBLE_RE = /[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

function cleanText(value, max) {
  return String(value == null ? "" : value)
    .replace(CONTROL_RE, " ")
    .replace(INVISIBLE_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
function cleanId(value) {
  return String(value == null ? "" : value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
}
function onlineIn(roomId) {
  const set = io.sockets.adapter.rooms.get(roomId);
  return set ? set.size : 0;
}
function announce(roomId) {
  const n = onlineIn(roomId);
  io.to(roomId).emit("online", n);
  const room = rooms.get(roomId);
  if (room) room.emptySince = n ? null : Date.now();
}
function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) return null;
    room = { history: [], emptySince: null };
    rooms.set(roomId, room);
  }
  return room;
}
// One bad packet must never take the whole server down.
const safe = (fn) => (...args) => {
  try {
    fn(...args);
  } catch (err) {
    console.error("handler error:", err && err.message);
  }
};

/* ---------------------------- sockets ----------------------------- */
io.on("connection", (socket) => {
  socket.on(
    "join",
    safe((data) => {
      if (!data || typeof data !== "object") return;
      const roomId = typeof data.theme === "string" ? data.theme.trim() : "";
      if (!PUBLIC_RE.test(roomId) && !PRIVATE_RE.test(roomId)) {
        socket.emit("join_error", "bad_room");
        return;
      }

      const now = Date.now();
      const prev = meta.get(socket.id);
      const joins = prev ? prev.joins.filter((t) => now - t < BURST_WINDOW_MS) : [];
      if (joins.length >= JOIN_MAX) return; // flood — ignore
      joins.push(now);

      const room = getRoom(roomId);
      if (!room) {
        socket.emit("join_error", "busy");
        return;
      }

      if (prev && prev.room !== roomId) {
        socket.leave(prev.room);
        announce(prev.room);
      }
      socket.join(roomId);
      meta.set(socket.id, {
        room: roomId,
        name: cleanText(data.name, 18) || "Guest",
        cid: cleanId(data.cid) || socket.id.slice(0, 12),
        lastMsgAt: prev ? prev.lastMsgAt : 0,
        burst: prev ? prev.burst : [],
        joins
      });

      socket.emit("history", room.history);
      announce(roomId);
    })
  );

  socket.on(
    "chat message",
    safe((data) => {
      // Room + name always come from the server-side state set by "join",
      // never from the payload (no posting into rooms you did not join).
      const m = meta.get(socket.id);
      if (!m || !data || typeof data.text !== "string") return;
      const text = cleanText(data.text, 200);
      if (!text) return;

      const now = Date.now();
      if (m.lastMsgAt && now - m.lastMsgAt < MSG_GAP_MS) return;
      m.burst = m.burst.filter((t) => now - t < BURST_WINDOW_MS);
      if (m.burst.length >= BURST_MAX) {
        socket.emit("rate", BURST_WINDOW_MS);
        return;
      }
      m.burst.push(now);
      m.lastMsgAt = now;

      const room = rooms.get(m.room);
      if (!room) return;
      const msg = { name: m.name, text, ts: now, cid: m.cid };
      room.history.push(msg);
      if (room.history.length > MAX_HISTORY) room.history.splice(0, room.history.length - MAX_HISTORY);
      io.to(m.room).emit("chat message", msg);
    })
  );

  socket.on(
    "disconnect",
    safe(() => {
      const m = meta.get(socket.id);
      meta.delete(socket.id);
      if (m) announce(m.room);
    })
  );
});

/* Sweep empty rooms so memory never grows forever. */
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (onlineIn(id) > 0) {
      room.emptySince = null;
      continue;
    }
    if (room.emptySince == null) {
      room.emptySince = now;
      continue;
    }
    const ttl = id.startsWith("priv_") ? PRIVATE_TTL_MS : PUBLIC_TTL_MS;
    if (now - room.emptySince > ttl) rooms.delete(id);
  }
}, 60 * 1000).unref();

/* Safety net + clean shutdown (Render sends SIGTERM on every deploy). */
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
function shutdown() {
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => console.log("Nostalgia Radio backend listening on port " + PORT));
