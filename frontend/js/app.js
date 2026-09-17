/* ================= STATE ================= */
let currentThemeId = localStorage.getItem("theme_choice") || THEMES[0].id;
let currentTrackIdx = 0;
let isPlaying = false;
let myName = localStorage.getItem("radio_name") || "";

function theme(){ return THEMES.find(t=>t.id===currentThemeId); }

/* ================= THEME DROPDOWN ================= */
function renderThemeDropdown(){
  const list = document.getElementById("ddList");
  list.innerHTML = "";
  THEMES.forEach(t=>{
    const el = document.createElement("div");
    el.className = "theme-dd-item dev" + (t.id===currentThemeId ? " active":"");
    el.innerHTML = `<span class="ic">${t.icon}</span>${t.title}<span class="tag2">${t.tracks.length} gaane</span>`;
    el.onclick = ()=>{ switchTheme(t.id); closeDropdown(); };
    list.appendChild(el);
  });
  const t = theme();
  document.getElementById("ddIcon").textContent = t.icon;
  document.getElementById("ddLabel").textContent = t.title;
}
function toggleDropdown(){
  document.getElementById("ddBtn").classList.toggle("open");
  document.getElementById("ddList").classList.toggle("open");
}
function closeDropdown(){
  document.getElementById("ddBtn").classList.remove("open");
  document.getElementById("ddList").classList.remove("open");
}
document.addEventListener("click", (e)=>{
  const wrap = document.querySelector(".theme-dd-wrap");
  if(wrap && !wrap.contains(e.target)) closeDropdown();
});

function switchTheme(id){
  currentThemeId = id;
  localStorage.setItem("theme_choice", id);
  currentTrackIdx = 0;
  stopPlayback();
  applyTheme();
  renderThemeDropdown();
  joinRoom();
}

/* ================= HERO / PLAYLIST / QUOTES ================= */
function applyTheme(){
  const t = theme();
  document.documentElement.style.setProperty("--accent-c", t.accent);
  document.getElementById("hero").style.background = t.heroBg;
  document.getElementById("heroIllust").innerHTML = t.svg || "";
  document.getElementById("heroTitle").textContent = t.title;
  document.getElementById("heroTag").textContent = t.tag;
  document.getElementById("ddIcon").textContent = t.icon;
  document.getElementById("ddLabel").textContent = t.title;
  document.getElementById("chatThemeName").textContent = t.title;
  document.getElementById("trackCount").textContent = "(" + t.tracks.length + " gaane)";
  renderPlaylist();
  renderQuotes();
  loadTrackMeta();
}

function renderPlaylist(){
  const t = theme();
  const wrap = document.getElementById("playlist");
  wrap.innerHTML = "";
  t.tracks.forEach((tr,i)=>{
    const el = document.createElement("div");
    el.className = "track" + (i===currentTrackIdx ? " playing":"");
    el.innerHTML = `<div class="n">${i+1}</div>
      <div class="info"><div class="tt">${tr.t}</div><div class="aa">${tr.a}</div></div>
      <div class="play-ic">${i===currentTrackIdx && isPlaying ? "▶":"—"}</div>`;
    el.onclick = ()=>{ currentTrackIdx = i; isPlaying = true; loadTrackMeta(); playCurrent(); renderPlaylist(); };
    wrap.appendChild(el);
  });
}

function renderQuotes(){
  const t = theme();
  const wrap = document.getElementById("quotesWrap");
  wrap.innerHTML = "";
  (t.quotes || []).forEach(q=>{
    const el = document.createElement("div");
    el.className = "quote-card dev";
    el.innerHTML = `"${q[0]}"<span class="who">— ${q[1]}</span>`;
    wrap.appendChild(el);
  });
}

function loadTrackMeta(){
  const t = theme();
  const tr = t.tracks[currentTrackIdx];
  document.getElementById("trackTitle").textContent = tr.t;
  document.getElementById("trackSub").textContent = tr.a;
  document.getElementById("art").style.background = t.accent;
}

/* ================= PLAYER (YouTube — free, no video-ID hunting needed) =================
   Har track ke liye YouTube search-embed use hota hai, isliye site "as-is" kaam karti hai.
   Zyada precise control chahiye to data.js mein kisi track ko "yt":"VIDEO_ID" field do —
   agar wo present hai to seedha wahi video chalega. */
function playCurrent(){
  const t = theme();
  const tr = t.tracks[currentTrackIdx];
  const holder = document.getElementById("ytHolder");
  let src;
  if(tr.yt){
    src = `https://www.youtube.com/embed/${tr.yt}?autoplay=1&playsinline=1`;
  } else {
    const q = encodeURIComponent(tr.t + " " + tr.a + " song");
    src = `https://www.youtube.com/embed?listType=search&list=${q}&autoplay=1&playsinline=1`;
  }
  holder.innerHTML = `<iframe width="1" height="1" src="${src}" frameborder="0"
    allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  isPlaying = true;
  document.getElementById("playBtn").textContent = "⏸";
  renderPlaylist();
}
function stopPlayback(){
  document.getElementById("ytHolder").innerHTML = "";
  isPlaying = false;
  document.getElementById("playBtn").textContent = "▶";
}
function togglePlay(){
  if(isPlaying){ stopPlayback(); } else { playCurrent(); }
}
function nextTrack(){
  const t = theme();
  currentTrackIdx = (currentTrackIdx+1) % t.tracks.length;
  loadTrackMeta(); renderPlaylist();
  if(isPlaying) playCurrent();
}
function prevTrack(){
  const t = theme();
  currentTrackIdx = (currentTrackIdx-1+t.tracks.length) % t.tracks.length;
  loadTrackMeta(); renderPlaylist();
  if(isPlaying) playCurrent();
}

/* ================= ABOUT (reveal on scroll or ℹ️ tap) ================= */
function scrollToAbout(){
  document.getElementById("about").scrollIntoView({behavior:"smooth", block:"start"});
}

/* ================= NAME MODAL ================= */
function openNameModal(){ document.getElementById("nameModal").style.display = "flex"; }
function setName(){
  const v = document.getElementById("nameInput").value.trim();
  if(!v) return;
  myName = v.slice(0,18);
  localStorage.setItem("radio_name", myName);
  document.getElementById("nameModal").style.display = "none";
  joinRoom();
}
if(myName){
  document.getElementById("nameModal").style.display = "none";
} else {
  myName = "Guest" + Math.floor(Math.random()*9000+1000);
}

/* ================= CHAT DRAWER open/close ================= */
function openChat(){
  document.getElementById("chatOverlay").classList.add("open");
  document.getElementById("chatBadge").style.display = "none";
}
function closeChat(){
  document.getElementById("chatOverlay").classList.remove("open");
}

/* ================= BACKEND (Socket.IO on Render) or LOCAL DEMO fallback =================
   Frontend Vercel par, backend Render par. js/config.js mein BACKEND_URL daalte hi
   real cross-visitor chat + real online-count chalu ho jata hai. Khaali chhoda to
   site "Demo Mode" mein chalti hai (sirf tumhare apne browser tak). */
let socket = null;
let socketReady = false;

function initBackend(){
  const url = (window.BACKEND_URL || "").trim();
  if(url && window.io){
    try{
      socket = io(url, { transports: ["websocket", "polling"] });

      socket.on("connect", ()=>{
        socketReady = true;
        setModeNote(true);
        joinRoom();
      });
      socket.on("disconnect", ()=>{
        socketReady = false;
        setModeNote(false);
      });
      socket.on("connect_error", ()=>{
        socketReady = false;
        setModeNote(false);
      });
      socket.on("history", (arr)=> renderMsgs(arr || []));
      socket.on("chat message", (msg)=> appendMsg(msg));
      socket.on("online", (count)=>{
        document.getElementById("onlineCount").textContent = Math.max(count, 1);
      });
    }catch(e){
      console.warn("Socket connection failed, using demo mode.", e);
      socketReady = false;
      setModeNote(false);
    }
  } else {
    setModeNote(false);
  }
  if(!socketReady){
    document.getElementById("onlineCount").textContent = demoPseudoOnline;
    loadChat();
  }
}

function setModeNote(connected){
  document.getElementById("chatModeNote").textContent = connected
    ? "🟢 Real live chat — sab visitors ek saath"
    : "🟡 Demo mode — sirf tumhare browser tak (backend jodo README ke hisaab se)";
}

function joinRoom(){
  if(socketReady && socket){
    socket.emit("join", { theme: currentThemeId, name: myName });
  } else {
    loadChat();
  }
}

/* ---- local demo fallback (no backend configured) ---- */
let demoPseudoOnline = 100 + Math.floor(Math.random()*900);
setInterval(()=>{
  if(!socketReady){
    demoPseudoOnline += Math.floor(Math.random()*7) - 3;
    if(demoPseudoOnline < 40) demoPseudoOnline = 40;
    const el = document.getElementById("onlineCount");
    if(el) el.textContent = demoPseudoOnline;
  }
}, 4000);

function loadChat(){
  if(socketReady) return; // real messages arrive via "history"/"chat message" events
  const arr = JSON.parse(localStorage.getItem("demo_chat_" + currentThemeId) || "[]");
  renderMsgs(arr);
}

function renderMsgs(arr){
  const msgsEl = document.getElementById("msgs");
  msgsEl.innerHTML = "";
  if(!arr.length){
    msgsEl.innerHTML = '<div class="chat-empty">Sabse pehle message tum bhejo!</div>';
    return;
  }
  arr.forEach(appendMsg);
}

function appendMsg(m){
  const msgsEl = document.getElementById("msgs");
  const empty = msgsEl.querySelector(".chat-empty");
  if(empty) empty.remove();
  const mine = m.name === myName;
  const el = document.createElement("div");
  el.className = "msg" + (mine ? " me":"");
  el.innerHTML = `<span class="nm">${mine?"Tum":escapeHtml(m.name||"Guest")}</span>${escapeHtml(m.text||"")}`;
  msgsEl.appendChild(el);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function escapeHtml(s){
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function sendMsg(){
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if(!text) return;
  input.value = "";
  const msg = { name: myName, text: text, ts: Date.now() };

  if(socketReady && socket){
    socket.emit("chat message", { theme: currentThemeId, name: myName, text: text });
  } else {
    const key = "demo_chat_" + currentThemeId;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(msg);
    while(arr.length > 80) arr.shift();
    localStorage.setItem(key, JSON.stringify(arr));
    appendMsg(msg);
  }
}

/* ================= INIT ================= */
renderThemeDropdown();
applyTheme();
initBackend();
