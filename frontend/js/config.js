/*
  ================================================================
  RUNTIME CONFIG — sirf isi file mein cheezein badalni hain.
  YEH FILE HAI: frontend/js/config.js   (index.html mein KUCH NAHI badalna)
  ================================================================

  1) BACKEND_URL — already live hai, isse mat chhedo.

  2) YOUTUBE_API_KEY — YEH ZAROORI HAI. Isके bina koi bhi gaana nahi
     bajega (search-fallback hata diya gaya hai, jaisa tumne kaha).
     App har gaane ke liye exact video seedha YouTube Data API v3 se
     dhoondhta hai, isliye ek valid key yahan neeche paste karo.

     Key kaise banaye (5 minute ka kaam, bilkul free):
       a) https://console.cloud.google.com/ par jao, Google account se login karo.
       b) Upar se "New Project" banao (koi bhi naam, e.g. "nostalgia-radio").
       c) Left menu → "APIs & Services" → "Library" → search karo
          "YouTube Data API v3" → usko "Enable" karo.
       d) "APIs & Services" → "Credentials" → "Create Credentials" →
          "API key" → ek key milegi (jaisa: AIzaSy...).
       e) Us key ko copy karke neeche wali line mein paste karo.

     (Optional but recommended: us key ko "Restrict key" karke sirf
      "YouTube Data API v3" tak limit kar do, taaki koi misuse na kare.)
*/
window.BACKEND_URL = "https://nostalgia-radio-s994.onrender.com";
window.YOUTUBE_API_KEY = "AIzaSyBrilgayUlGkWDZLGnBabCUTRR3c0vOZsY";
