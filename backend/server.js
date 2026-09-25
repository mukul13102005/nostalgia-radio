/**
 * Nostalgia Radio — Backend
 * Real-time chat + live online-count, one room per theme.
 * Deploy this folder on Render as a "Web Service".
 */
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Allow your Vercel frontend to call this backend.
// Set ALLOWED_ORIGIN in Render's Environment tab once you know your Vercel URL,
// e.g. https://nostalgia-radio.vercel.app  — until then "*" keeps things working.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.set("trust proxy", 1); // Render sits behind a proxy
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] }
});

// ---- in-memory state (resets on server restart — fine for a live-chat vibe) ----
const MAX_HISTORY = 80;
const chatHistory = {};   // { themeId: [ {name, text, ts}, ... ] }
const roomUsers = {};     // { themeId: Set(socket.id) }
const socketMeta = {};    // { socket.id: { theme, name } }

function ensureTheme(themeId) {
  if (!chatHistory[themeId]) chatHistory[themeId] = [];
  if (!roomUsers[themeId]) roomUsers[themeId] = new Set();
}

function broadcastCount(themeId) {
  ensureTheme(themeId);
  io.to(themeId).emit("online", roomUsers[themeId].size);
}

app.get("/", (req, res) => {
  res.send("Nostalgia Radio backend is running. Connect via Socket.IO.");
});

app.get("/health", (req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  socket.on("join", ({ theme, name }) => {
    if (!theme) return;
    theme = String(theme).slice(0, 40); // theme id OR "priv_XXXXXX" private-room code
    const prev = socketMeta[socket.id];
    if (prev && prev.theme && prev.theme !== theme) {
      socket.leave(prev.theme);
      roomUsers[prev.theme] && roomUsers[prev.theme].delete(socket.id);
      broadcastCount(prev.theme);
    }
    ensureTheme(theme);
    socket.join(theme);
    roomUsers[theme].add(socket.id);
    socketMeta[socket.id] = { theme, name: (name || "Guest").slice(0, 18) };

    socket.emit("history", chatHistory[theme]);
    broadcastCount(theme);
  });

  socket.on("chat message", ({ theme, name, text }) => {
    if (!theme || !text) return;
    theme = String(theme).slice(0, 40);
    ensureTheme(theme);
    const msg = { name: (name || "Guest").slice(0, 18), text: String(text).slice(0, 200), ts: Date.now() };
    chatHistory[theme].push(msg);
    while (chatHistory[theme].length > MAX_HISTORY) chatHistory[theme].shift();
    io.to(theme).emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    const meta = socketMeta[socket.id];
    if (meta && meta.theme) {
      roomUsers[meta.theme] && roomUsers[meta.theme].delete(socket.id);
      broadcastCount(meta.theme);
    }
    delete socketMeta[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Nostalgia Radio backend listening on port " + PORT));
