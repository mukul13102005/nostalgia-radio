/* ================= STATE ================= */
let currentThemeId = localStorage.getItem("nr_theme") || THEMES[0].id;
let currentTrackIdx = 0;
let isPlaying = false;
let myName = localStorage.getItem("nr_name") || "";
let tempGuestName = "Guest" + Math.floor(Math.random() * 9000 + 1000);
let currentRoom = currentThemeId;
let privateRoomActive = false;
let lastOnlineCount = 1;

function theme(){ return THEMES.find(t => t.id === currentThemeId) || THEMES[0]; }
function displayName(){ return myName || tempGuestName; }

/* ================= TOASTS ================= */
function showToast(msg){
  const wrap = document.getElementById("toastWrap");
  if(!wrap) return;
  const el = document.createElement("div");
  el.className = "toast dev";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

/* ================= VIEW / TAB SWITCHING ================= */
function switchView(name){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.getElementById("nav" + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
  document.getElementById("appMain").scrollTop = 0;

  if(name === "chat"){
    document.getElementById("chatDot").classList.remove("has-new");
    if(!myName){ openNameModal(); }
  }
  if(name === "profile"){
    document.getElementById("profileNameInput").value = myName;
  }
}

/* ================= THEME SHEET ================= */
function renderThemeList(){
  const wrap = document.getElementById("themeList");
  wrap.innerHTML = "";
  THEMES.forEach(t => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "theme-opt dev" + (t.id === currentThemeId ? " active" : "");
    el.style.setProperty("--opt-accent", t.accent);
    el.innerHTML = `<span class="ic">${t.icon}</span><span class="lbl">${t.title}<small>${t.tag}</small></span>`;
    el.onclick = () => { switchTheme(t.id); closeThemeSheet(); };
    wrap.appendChild(el);
  });
}
function openThemeSheet(){ renderThemeList(); document.getElementById("themeSheet").classList.add("open"); }
function closeThemeSheet(){ document.getElementById("themeSheet").classList.remove("open"); }

function switchTheme(id){
  if(id === currentThemeId) return;
  currentThemeId = id;
  localStorage.setItem("nr_theme", id);
  currentTrackIdx = 0;
  loadedKey = null;
  const wasPlaying = isPlaying;
  stopPlayback();
  applyThemeVisuals();
  if(wasPlaying) playCurrent();
  if(!privateRoomActive){ currentRoom = id; joinRoom(); updateChatRoomLabel(); }
}

/* ================= THEME VISUALS ================= */
function applyThemeVisuals(){
  const t = theme();
  document.documentElement.style.setProperty("--accent-c", t.accent);
  document.getElementById("stage").style.background = t.heroBg;
  document.getElementById("themeArt").innerHTML = t.svg;
  document.getElementById("themeTitle").textContent = t.title;
  document.getElementById("themeTag").textContent = t.tag;
  document.getElementById("profileTheme").textContent = t.title;
  document.getElementById("profileThemeCount").textContent = THEMES.length;
  const tc = document.getElementById("themeColorMeta");
  if(tc) tc.setAttribute("content", t.accent);
  renderQuotes();
  updateTrackLabel();
}
/* Shows which song is queued/playing right on the player screen — the
   original UI never surfaced this anywhere, so there was no way to tell
   at a glance whether the song actually matched the theme. */
function updateTrackLabel(){
  const t = theme();
  const tr = t.tracks[currentTrackIdx];
  const el = document.getElementById("trackName");
  if(el && tr) el.innerHTML = `🎵 ${escapeHtml(tr.t)} <span class="artist">— ${escapeHtml(tr.a)}</span>`;
}
function renderQuotes(){
  const t = theme();
  const wrap = document.getElementById("quotesWrap");
  wrap.innerHTML = "";
  (t.quotes || []).forEach(q => {
    const el = document.createElement("div");
    el.className = "quote-card dev";
    el.innerHTML = `"${escapeHtml(q[0])}"<span class="who">— ${escapeHtml(q[1])}</span>`;
    wrap.appendChild(el);
  });
}

/* ================= YOUTUBE PLAYER (IFrame API — real play/pause/resume) =================
   The API script is preloaded at app start (see INIT below), not on first
   tap of Play. Loading it lazily meant the very first "play" on iOS could
   fire ytPlayer.playVideo() from an async callback *outside* the user
   gesture that started it, which Safari's autoplay policy silently blocks.
   Preloading means ytReady is already true by the time someone taps Play,
   so playback starts synchronously inside that tap. */
let ytPlayer = null;
let ytReady = false;
let pendingAutoplay = false;
let loadedKey = null;
function trackKey(){ return currentThemeId + "#" + currentTrackIdx; }

function ensureYT(){
  if(ytPlayer || window.__ytLoading) return;
  window.__ytLoading = true;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
}
window.onYouTubeIframeAPIReady = function(){
  ytPlayer = new YT.Player("ytPlayer", {
    height: "1", width: "1",
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
    events: {
      onReady: () => { ytReady = true; if(pendingAutoplay){ pendingAutoplay = false; playCurrent(); } },
      onStateChange: onPlayerStateChange,
      onError: () => { setStatus("Ye gaana nahi mila, agla try kar rahe hain…"); setTimeout(nextTrack, 900); }
    }
  });
};
function onPlayerStateChange(e){
  if(!window.YT) return;
  if(e.data === YT.PlayerState.PLAYING){
    isPlaying = true; setStatus('<span class="eq"><i></i><i></i><i></i></span>Ab baj raha hai'); updatePlayUI();
  } else if(e.data === YT.PlayerState.PAUSED){
    isPlaying = false; setStatus("Pause — resume karne ke liye play dabao"); updatePlayUI();
  } else if(e.data === YT.PlayerState.BUFFERING){
    setStatus("Load ho raha hai…");
  } else if(e.data === YT.PlayerState.ENDED){
    nextTrack();
  }
}
function setStatus(html){ document.getElementById("statusNote").innerHTML = html; }
function updatePlayUI(){
  document.getElementById("playBtn").textContent = isPlaying ? "⏸" : "▶";
  document.getElementById("disc").classList.toggle("spinning", isPlaying);
  document.getElementById("tonearm").classList.toggle("down", isPlaying);
}

/* Resolved video IDs are cached locally so the same song never burns
   YouTube Data API quota twice on this device. */
function ytCacheGet(query){
  try{ return JSON.parse(localStorage.getItem("nr_ytcache") || "{}")[query] || null; }catch(e){ return null; }
}
function ytCacheSet(query, videoId){
  try{
    const c = JSON.parse(localStorage.getItem("nr_ytcache") || "{}");
    c[query] = videoId;
    localStorage.setItem("nr_ytcache", JSON.stringify(c));
  }catch(e){}
}

function playCurrent(){
  if(!(window.YOUTUBE_API_KEY || "").trim()){
    setStatus("⚠️ YouTube API key set nahi hai — frontend/js/config.js kholo");
    return;
  }
  const t = theme();
  const tr = t.tracks[currentTrackIdx];
  if(!ytReady){ pendingAutoplay = true; ensureYT(); setStatus("Player load ho raha hai…"); return; }

  if(loadedKey === trackKey()){
    ytPlayer.playVideo();
    return;
  }
  loadedKey = trackKey();
  const query = tr.t + " " + tr.a + " full audio song";

  if(tr.yt){
    ytPlayer.loadVideoById(tr.yt);
    return;
  }
  const cached = ytCacheGet(query);
  if(cached){
    ytPlayer.loadVideoById(cached);
    return;
  }
  setStatus("Dhoonda ja raha hai…");
  fetchAndLoad(query);
}
async function fetchAndLoad(query){
  const key = window.YOUTUBE_API_KEY.trim();
  // videoCategoryId=10 -> Music only, relevanceLanguage=hi -> biases results
  // toward the actual Hindi film track instead of covers/reactions/shorts,
  // so the song that plays actually matches the theme it was picked for.
  const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video"
    + "&videoEmbeddable=true&videoCategoryId=10&relevanceLanguage=hi&q="
    + encodeURIComponent(query) + "&key=" + key;
  try{
    const res = await fetch(url);
    const data = await res.json();
    if(data.error){
      const reason = (data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || data.error.status || "";
      if(reason === "quotaExceeded"){
        setStatus("⚠️ YouTube API ka daily quota khatam ho gaya, kal try karo");
      } else {
        setStatus("⚠️ YouTube API key galat/invalid hai — config.js check karo");
      }
      return;
    }
    const vid = data.items && data.items[0] && data.items[0].id && data.items[0].id.videoId;
    if(vid){
      ytCacheSet(query, vid);
      ytPlayer.loadVideoById(vid);
    } else {
      setStatus("Ye gaana YouTube par nahi mila, agla try karo…");
    }
  }catch(e){
    setStatus("⚠️ Network/API error — dobara try karo");
  }
}
function stopPlayback(){
  if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  isPlaying = false;
  updatePlayUI();
  setStatus("Play dabao, gaana shuru");
}
function togglePlay(){
  if(!ytReady || loadedKey !== trackKey()){ playCurrent(); return; }
  const state = ytPlayer.getPlayerState();
  if(state === 1){ ytPlayer.pauseVideo(); } else { ytPlayer.playVideo(); }
}
function nextTrack(){
  const t = theme();
  currentTrackIdx = (currentTrackIdx + 1) % t.tracks.length;
  loadedKey = null;
  updateTrackLabel();
  if(isPlaying) playCurrent();
}
function prevTrack(){
  const t = theme();
  currentTrackIdx = (currentTrackIdx - 1 + t.tracks.length) % t.tracks.length;
  loadedKey = null;
  updateTrackLabel();
  if(isPlaying) playCurrent();
}

/* ================= NAME MODAL / PROFILE ================= */
function openNameModal(){ document.getElementById("nameModal").classList.add("open"); }
function closeNameModal(){ document.getElementById("nameModal").classList.remove("open"); }
function setName(){
  const v = document.getElementById("nameInput").value.trim();
  if(!v) return;
  applyName(v);
  closeNameModal();
}
function saveProfileName(){
  const v = document.getElementById("profileNameInput").value.trim();
  if(!v) return;
  applyName(v);
  showToast("Naam save ho gaya ✓");
}
function applyName(v){
  myName = v.slice(0, 18);
  localStorage.setItem("nr_name", myName);
  updateProfileUI();
  joinRoom();
}
function updateProfileUI(){
  const n = myName || tempGuestName;
  document.getElementById("profileName").textContent = n;
  document.getElementById("avatarRing").textContent = n.charAt(0).toUpperCase();
}

/* ================= CHAT ================= */
let socket = null;
let socketReady = false;

function initBackend(){
  const url = (window.BACKEND_URL || "").trim();
  if(url && window.io){
    socket = io(url, { transports: ["websocket", "polling"] });
    socket.on("connect", () => { socketReady = true; joinRoom(); updateConnPill(); });
    socket.on("disconnect", () => { socketReady = false; updateConnPill(); });
    socket.on("connect_error", () => { socketReady = false; updateConnPill(); });
    socket.on("history", (arr) => renderMsgs(arr || []));
    socket.on("chat message", (msg) => appendMsg(msg));
    socket.on("online", (count) => {
      lastOnlineCount = Math.max(count, 1);
      updateConnPill();
    });
  } else {
    updateConnPill();
  }
}
function updateConnPill(){
  const pill = document.getElementById("onlinePill");
  const label = document.getElementById("pillLabel");
  if(socketReady){
    pill.classList.remove("offline");
    label.textContent = lastOnlineCount + " online";
  } else {
    pill.classList.add("offline");
    label.textContent = "Reconnecting…";
  }
}
function joinRoom(){
  if(socketReady && socket){
    socket.emit("join", { theme: currentRoom, name: displayName() });
  }
}
function updateChatRoomLabel(){
  const label = privateRoomActive
    ? "🔒 Private: " + currentRoom.replace("priv_", "")
    : theme().title;
  document.getElementById("chatRoomLabel").textContent = label;
}

/* deterministic colour per name, so the same person always gets the same
   avatar/name colour across messages — an at-a-glance way to tell people
   apart in a busy room, instead of every bubble looking identical. */
function nameColor(name){
  let hash = 0;
  for(let i = 0; i < name.length; i++){ hash = name.charCodeAt(i) + ((hash << 5) - hash); }
  const hue = Math.abs(hash) % 360;
  return "hsl(" + hue + " 62% 62%)";
}
function formatTime(ts){
  try{ return new Date(ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch(e){ return ""; }
}

function renderMsgs(arr){
  const msgsEl = document.getElementById("msgs");
  msgsEl.innerHTML = "";
  if(!arr.length){
    msgsEl.innerHTML = '<div class="chat-empty dev">Sabse pehle message tum bhejo!</div>';
    return;
  }
  arr.forEach(appendMsg);
}
function appendMsg(m){
  const msgsEl = document.getElementById("msgs");
  const empty = msgsEl.querySelector(".chat-empty");
  if(empty) empty.remove();
  const mine = m.name === displayName();
  const nm = m.name || "Guest";
  const color = nameColor(nm);

  const row = document.createElement("div");
  row.className = "msg-row" + (mine ? " me" : "");

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.style.background = color;
  avatar.textContent = nm.charAt(0).toUpperCase();

  const col = document.createElement("div");
  col.className = "msg-col";
  const nameEl = mine ? "" : `<span class="nm dev" style="color:${color}">${escapeHtml(nm)}</span>`;
  col.innerHTML = `${nameEl}<div class="bubble dev">${escapeHtml(m.text || "")}</div><span class="msg-time">${formatTime(m.ts)}</span>`;

  if(!mine) row.appendChild(avatar);
  row.appendChild(col);
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  if(!document.getElementById("view-chat").classList.contains("active") && !mine){
    document.getElementById("chatDot").classList.add("has-new");
  }
}
function escapeHtml(s){
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function sendMsg(){
  if(!myName){ openNameModal(); return; }
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if(!text) return;
  if(!socketReady){ showToast("Connect ho raha hai, thoda ruk ke try karo"); return; }
  input.value = "";
  socket.emit("chat message", { theme: currentRoom, name: myName, text: text });
}

/* keep the message list full-height while the keyboard is up by hiding
   the nav + credit strip for the duration of typing */
(function setupChatKeyboardHandling(){
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("chatInput");
    const shell = document.getElementById("appShell");
    if(!input || !shell) return;
    input.addEventListener("focus", () => shell.classList.add("kb-open"));
    input.addEventListener("blur", () => shell.classList.remove("kb-open"));
  });
})();

/* ================= PRIVATE ROOMS ================= */
function openRoomSheet(){
  document.getElementById("currentRoomCard").style.display = privateRoomActive ? "block" : "none";
  if(privateRoomActive) document.getElementById("currentRoomLabel").textContent = currentRoom.replace("priv_", "");
  document.getElementById("roomSheet").classList.add("open");
}
function closeRoomSheet(){ document.getElementById("roomSheet").classList.remove("open"); }
function genRoomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function createPrivateRoom(){
  const code = genRoomCode();
  currentRoom = "priv_" + code;
  privateRoomActive = true;
  joinRoom();
  updateChatRoomLabel();
  renderMsgs([]);
  document.getElementById("currentRoomCard").style.display = "block";
  document.getElementById("currentRoomLabel").textContent = code;
}
function joinPrivateRoom(){
  const v = document.getElementById("roomCodeInput").value.trim().toUpperCase();
  if(!v) return;
  currentRoom = "priv_" + v;
  privateRoomActive = true;
  joinRoom();
  updateChatRoomLabel();
  renderMsgs([]);
  closeRoomSheet();
}
function leavePrivateRoom(){
  privateRoomActive = false;
  currentRoom = currentThemeId;
  joinRoom();
  updateChatRoomLabel();
  renderMsgs([]);
  closeRoomSheet();
}
function copyRoomCode(){
  const code = currentRoom.replace("priv_", "");
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(
      () => showToast("Code copy ho gaya ✓"),
      () => showToast("Copy nahi ho paaya, code manually select karo")
    );
  } else {
    showToast("Copy nahi ho paaya, code manually select karo");
  }
}
function shareRoomCode(){
  const code = currentRoom.replace("priv_", "");
  const text = "Mere Nostalgia Radio private room mein aa jao — code: " + code;
  if(navigator.share){
    navigator.share({ title: "Nostalgia Radio Private Room", text: text }).catch(() => {});
  } else {
    copyRoomCode();
  }
}

/* ================= CONTACT (Made by Mukul Kumar) ================= */
function contactMe(){
  const msg = "Hi Mukul! Maine aapki Nostalgia Radio website dekhi — mujhe bhi aisi hi ek modern website banwani hai.";
  window.open("https://wa.me/919572660377?text=" + encodeURIComponent(msg), "_blank");
}

/* ================= INIT ================= */
applyThemeVisuals();
updateChatRoomLabel();
updateProfileUI();
initBackend();
ensureYT(); // preload the YouTube IFrame API so the first tap of Play works immediately
