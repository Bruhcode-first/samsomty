(function () {
  "use strict";

  var MOBILE = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    (navigator.userAgent || "").toLowerCase()
  );

  var raf =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (fn) {
      return setTimeout(fn, 16);
    };

  var rand = Math.random;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  /* ====================================================================
     AUDIO — pad drone + live music-box melody + synced heartbeat.
     Drop a file named song.mp3 next to index.html to use your own song.
  ==================================================================== */
  /* ── MUSIC ───────────────────────────────────────────────────────────
     Full song + autoplay = song.mp3 in this folder (Spotify embeds are preview
     only and won't autoplay the full track). Steps:

       1. Export / save your track as song.mp3 (same song as the Spotify link)
       2. Put song.mp3 next to index.html
       3. Paste your Spotify link below for album art + "open in Spotify"

     The song auto-starts when her name appears in the sky (~2.6s after "open the sky").
  ────────────────────────────────────────────────────────────────────── */
  var SONG_FILE = "song.mp3";
  var SONG_TITLE = "";
  var SONG_ARTIST = "";
  var SONG_COVER = "";
  var SPOTIFY_URL = "https://open.spotify.com/track/2UaswhFiFjhWfIBpiVSfEt?si=bb77d4e1f7b9476b";
  var MUSIC_AT_MS = 2600;       // when the now-playing card appears + song starts
  var SONG_VOLUME = 0.88;       // default volume (0–1) — also adjustable with the slider on screen
  var VOLUME_STORAGE_KEY = "salma-song-volume";

  /* Secret visit counter — counts each browser session once, stored online.
     Tap the faint ✦ in the top-left corner 4× quickly to reveal the total. */
  var VISIT_COUNTER_KEY = "heart-salma-sky-youse-7k2m";
  var VISIT_COUNTER_HIT = "https://countapi.mileshilliard.com/api/v1/hit/";
  var VISIT_COUNTER_GET = "https://countapi.mileshilliard.com/api/v1/get/";
  var VISIT_SESSION_KEY = "salma-sky-visit-logged";

  function recordVisit() {
    try {
      if (sessionStorage.getItem(VISIT_SESSION_KEY)) return;
      sessionStorage.setItem(VISIT_SESSION_KEY, "1");
    } catch (e) {}
    fetch(VISIT_COUNTER_HIT + VISIT_COUNTER_KEY, { method: "GET", mode: "cors" }).catch(
      function () {}
    );
  }

  function fetchVisitCount(cb) {
    fetch(VISIT_COUNTER_GET + VISIT_COUNTER_KEY, { method: "GET", mode: "cors" })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var v = d && d.value !== undefined ? parseInt(d.value, 10) : null;
        cb(v !== null && !isNaN(v) ? v : null);
      })
      .catch(function () {
        cb(null);
      });
  }

  function setupVisitReveal() {
    var hotspot = document.getElementById("visitHotspot");
    var toast = document.getElementById("visitToast");
    if (!hotspot || !toast) return;

    var clicks = 0;
    var resetTimer = null;
    var hideTimer = null;

    function hideToast() {
      toast.classList.remove("is-visible");
      hideTimer = setTimeout(function () {
        toast.hidden = true;
      }, 400);
    }

    function showToast(count) {
      toast.textContent =
        count === null ? "visits: unavailable" : count + " visit" + (count === 1 ? "" : "s");
      toast.hidden = false;
      requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideToast, 8000);
    }

    hotspot.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      clicks++;
      hotspot.classList.add("is-tapping");
      setTimeout(function () {
        hotspot.classList.remove("is-tapping");
      }, 180);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        clicks = 0;
      }, 3200);
      if (clicks >= 4) {
        clicks = 0;
        fetchVisitCount(showToast);
      }
    });

    hotspot.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    });
  }

  /* Browser tab title. Leave "" to use whatever you put in index.html <title>.
     Or set here; use {name} for her name (e.g. "For you my cute {name} ❤"). */
  var PAGE_TITLE = "";

  function Soundscape() {
    this.ctx = null;
    this.on = false;
    this.padGain = null;
    this.musicGain = null;
    this.beatMs = 1040;
    this.tempo = 68;
    this.melStep = 0;
    this.nextNoteTime = 0;
    this.melTimer = null;
    this.fileEl = null;
    this.usingFile = false;
  }

  Soundscape.prototype.boot = function () {
    if (this.ctx) return this.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  };

  Soundscape.prototype.startPad = function () {
    var ctx = this.boot();
    if (!ctx || this.padGain) return;
    var master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    var freqs = [110, 164.81, 220, 329.63];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freqs[i];
      var g = ctx.createGain();
      g.gain.value = 0.04 + i * 0.01;
      o.connect(g);
      g.connect(master);
      o.start();
    }

    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    var lfoG = ctx.createGain();
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG);
    lfoG.connect(master.gain);
    lfo.start();

    master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3);
    this.padGain = master;
  };

  /* live music-box melody: I–V–vi–IV in C */
  var CHORDS = [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65],
  ];
  var LEAD = [
    72, 76, 74, 72,
    71, 74, 72, 71,
    69, 72, 71, 69,
    65, 69, 67, 72,
  ];
  var ARP = [0, 1, 2, 3, 2, 3, 1, 2];

  Soundscape.prototype.startMelody = function () {
    var ctx = this.boot();
    if (!ctx || this.musicGain || this.usingFile) return;

    var music = ctx.createGain();
    music.gain.value = 0.0001;
    music.connect(ctx.destination);

    var delay = ctx.createDelay(1.0);
    delay.delayTime.value = (60 / this.tempo) / 1.5;
    var fb = ctx.createGain();
    fb.gain.value = 0.34;
    var wet = ctx.createGain();
    wet.gain.value = 0.3;
    music.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    music.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4);
    this.musicGain = music;
    this.melStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.25;

    var self = this;
    this.melTimer = setInterval(function () {
      self.scheduleMelody();
    }, 25);
  };

  Soundscape.prototype.voice = function (midi, t, vel, kind) {
    var ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    var f = 440 * Math.pow(2, (midi - 69) / 12);
    var dur = kind === "lead" ? 2.2 : kind === "bass" ? 2.6 : 1.3;
    var o = ctx.createOscillator();
    o.type = kind === "lead" ? "sine" : "triangle";
    o.frequency.value = f;
    var o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2;
    var o2g = ctx.createGain();
    o2g.gain.value = vel * 0.22;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(o2g);
    o2g.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.1);
    o2.stop(t + dur + 0.1);
  };

  Soundscape.prototype.scheduleMelody = function () {
    var ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    var eighth = (60 / this.tempo) / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      if (this.on && !this.usingFile) {
        var step = this.melStep % 32;
        var bar = (step / 8) | 0;
        var e = step % 8;
        var chord = CHORDS[bar];
        this.voice(chord[ARP[e]] + 12, this.nextNoteTime, 0.06, "arp");
        if (e % 2 === 0) {
          this.voice(LEAD[bar * 4 + e / 2], this.nextNoteTime, 0.075, "lead");
        }
        if (e === 0) this.voice(chord[0] - 12, this.nextNoteTime, 0.05, "bass");
      }
      this.nextNoteTime += eighth;
      this.melStep++;
    }
  };

  Soundscape.prototype.tryFile = function () {
    if (this.fileEl) return;
    var self = this;
    var el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    el.addEventListener("canplaythrough", function () {
      if (self.usingFile) return;
      self.usingFile = true;
      var ctx = self.ctx;
      if (self.musicGain && ctx) {
        try {
          self.musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
        } catch (e) {}
        clearInterval(self.melTimer);
        self.melTimer = null;
      }
      if (self.padGain && ctx) {
        try {
          self.padGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1);
        } catch (e) {}
      }
      if (self.on) {
        el.play().then(function () {
          self.fadeFile(0.85, 2);
        }).catch(function () {});
      }
    });
    el.addEventListener("error", function () {
      self.usingFile = false;
    });
    el.src = SONG_FILE;
    el.load();
    this.fileEl = el;
  };

  Soundscape.prototype.fadeFile = function (to, secs) {
    var el = this.fileEl;
    if (!el) return;
    var from = el.volume;
    var start = performance.now();
    function step(now) {
      var k = Math.min(1, (now - start) / (secs * 1000));
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  Soundscape.prototype.heartbeat = function () {
    if (!this.on) return;
    var ctx = this.boot();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    var t = ctx.currentTime;
    function thump(g, f, at) {
      var o = ctx.createOscillator();
      var gn = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * 0.5, at + 0.09);
      gn.gain.setValueAtTime(0, at);
      gn.gain.linearRampToValueAtTime(g, at + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
      o.connect(gn);
      gn.connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.17);
    }
    thump(0.11, 52, t);
    thump(0.07, 39, t + 0.14);
  };

  Soundscape.prototype.stopMelody = function () {
    this.usingFile = true;
    clearInterval(this.melTimer);
    this.melTimer = null;
    var ctx = this.ctx;
    if (this.musicGain && ctx) {
      try {
        this.musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      } catch (e) {}
    }
    if (this.padGain && ctx) {
      try {
        this.padGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1);
      } catch (e) {}
    }
  };

  Soundscape.prototype.setOn = function (v, melodyOnly) {
    this.on = v;
    var ctx = this.boot();
    if (!ctx) return;
    if (v) {
      if (ctx.state === "suspended") ctx.resume();
      this.startPad();
      if (!melodyOnly && !this.usingFile) {
        this.startMelody();
      }
      var t = ctx.currentTime;
      if (this.padGain) {
        try { this.padGain.gain.linearRampToValueAtTime(0.12, t + 1.5); } catch (e) {}
      }
      if (this.musicGain && !this.usingFile && !melodyOnly) {
        try { this.musicGain.gain.linearRampToValueAtTime(0.5, t + 1.5); } catch (e) {}
      }
    } else {
      var t2 = ctx.currentTime;
      if (this.padGain) {
        try { this.padGain.gain.linearRampToValueAtTime(0.0001, t2 + 0.6); } catch (e) {}
      }
      if (this.musicGain) {
        try { this.musicGain.gain.linearRampToValueAtTime(0.0001, t2 + 0.6); } catch (e) {}
      }
      if (this.fileEl && this.usingFile) this.fadeFile(0, 0.6);
    }
  };

  /* ====================================================================
     PARTICLE ENGINE
  ==================================================================== */
  var PHASE = { GALAXY: 0, NAME: 1, HEART: 2, PLAY: 3 };

  // parametric heart outline (math y is up-positive)
  function heartOutline(t) {
    return [
      16 * Math.pow(Math.sin(t), 3),
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
    ];
  }

  // soft round glow sprite, tinted
  function makeGlowSprite(inner, mid) {
    var c = document.createElement("canvas");
    var R = 32;
    c.width = c.height = R * 2;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, mid);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    return c;
  }

  var booted = false;

  function init() {
    if (booted) return;
    booted = true;

    var canvas = document.getElementById("sky");
    var ctx = canvas.getContext("2d", { alpha: false });
    var intro = document.getElementById("intro");
    var beginBtn = document.getElementById("beginBtn");
    var hud = document.getElementById("hud");
    var hudHint = document.getElementById("hudHint");
    var soundBtn = document.getElementById("soundBtn");
    var pulseRing = document.getElementById("pulseRing");
    var letter = document.getElementById("letter");
    var letterSecret = document.getElementById("letterSecret");
    var finaleBtn = document.getElementById("finaleBtn");
    var cursorGlow = document.getElementById("cursorGlow");
    var nowPlaying = document.getElementById("nowPlaying");
    var letterBtn = document.getElementById("letterBtn");
    var letterClose = document.getElementById("letterClose");

    recordVisit();
    setupVisitReveal();

    var sound = new Soundscape();

    /* personalization: ?to=Name (defaults to Salma) */
    var NAME = (function () {
      var p = (new URLSearchParams(window.location.search).get("to") || "").trim();
      p = p.replace(/[<>]/g, "").slice(0, 18);
      return p || "Salma";
    })();
    if (PAGE_TITLE && PAGE_TITLE.trim()) {
      document.title = PAGE_TITLE.trim().replace(/\{name\}/gi, NAME);
    }
    var introNameEl = document.querySelector(".intro__title span");
    if (introNameEl) introNameEl.textContent = NAME;
    var letterNameEl = document.querySelector(".letter__name");
    if (letterNameEl) letterNameEl.textContent = NAME;

    /* music state — configured by setupMusic() near the end of init() */
    var music = {
      useSynth: true,
      audio: null,
      ready: false,
      toggleBtn: null,
      titleEl: null,
      artistEl: null,
      volSlider: null,
      volume: SONG_VOLUME,
      momentPlayed: false,
    };

    function loadSavedVolume() {
      try {
        var saved = parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY));
        if (!isNaN(saved) && saved >= 0 && saved <= 1) music.volume = saved;
      } catch (e) {}
    }

    function applyVolume(v, skipSave) {
      music.volume = Math.max(0, Math.min(1, v));
      if (music.audio) music.audio.volume = music.volume;
      if (music.volSlider) music.volSlider.value = String(Math.round(music.volume * 100));
      if (!skipSave) {
        try {
          localStorage.setItem(VOLUME_STORAGE_KEY, String(music.volume));
        } catch (e) {}
      }
      if (sound.on && sound.ctx) {
        if (sound.padGain) {
          try {
            sound.padGain.gain.setTargetAtTime(0.12 * music.volume, sound.ctx.currentTime, 0.12);
          } catch (e) {}
        }
        if (sound.musicGain && !sound.usingFile) {
          try {
            sound.musicGain.gain.setTargetAtTime(0.5 * music.volume, sound.ctx.currentTime, 0.12);
          } catch (e) {}
        }
      }
    }

    loadSavedVolume();

    var width = 0, height = 0, dpr = 1;
    var cx = 0, cy = 0;
    var SCALE = 1;
    var maxR = 1;

    var phase = PHASE.GALAXY;
    var phaseAt = 0;
    var started = false;
    var startedAt = 0;
    var interactive = false;
    var beating = false;

    var now = 0, lastNow = 0, dt = 16;
    var galaxyAngle = 0;
    var heartAngle = 0;
    var beatPhase = 0;
    var beatCount = 0;
    var beatEnvNow = 0;

    var COUNT = MOBILE ? 1900 : 4600;
    var P = [];

    var SPRITES = [];
    var farStars = [];
    var ripples = [];
    var bursts = [];
    var fireworks = [];
    var floaters = [];
    var shooting = [];
    var lastShoot = 0;

    var pointer = { x: 0, y: 0, on: false, has: false };
    var px = 0, py = 0;
    var tapCount = 0;
    var finaleDone = false;

    var FOCAL = 64;

    /* ---------- sprites & particles ---------- */
    function buildSprites() {
      SPRITES = [
        makeGlowSprite("rgba(255,255,255,1)", "rgba(255,190,225,0.55)"),   // white-hot
        makeGlowSprite("rgba(255,225,240,1)", "rgba(255,120,180,0.5)"),    // rose
        makeGlowSprite("rgba(255,180,215,1)", "rgba(240,70,150,0.5)"),     // pink
        makeGlowSprite("rgba(255,240,210,1)", "rgba(255,180,90,0.45)"),    // gold
        makeGlowSprite("rgba(235,200,255,1)", "rgba(170,90,230,0.45)"),    // violet
      ];
    }

    function pickSprite() {
      var r = rand();
      if (r < 0.5) return 2;       // pink (majority)
      if (r < 0.78) return 1;      // rose
      if (r < 0.9) return 0;       // white
      if (r < 0.97) return 3;      // gold accent
      return 4;                    // violet accent
    }

    function buildParticles() {
      P = [];
      for (var i = 0; i < COUNT; i++) {
        // heart volume point (puffy 3D): fill the outline, give z-thickness
        var t = rand() * TAU;
        var o = heartOutline(t);
        // bias slightly inward so the heart reads fuller / heavier
        var rr = Math.pow(rand(), 0.62);
        var lx = o[0] * rr;
        var ly = o[1] * rr;
        var thick = (1 - rr * 0.85) * 7.5;    // puffy toward centre
        var lz = (rand() * 2 - 1) * thick;

        P.push({
          x: width / 2 + (rand() * 2 - 1) * width,
          y: height / 2 + (rand() * 2 - 1) * height,
          vx: 0, vy: 0,
          cs: 0.5, ca: 0,                     // current scale / alpha (eased)
          lx: lx, ly: ly, lz: lz,
          nx: 0, ny: 0,                        // name target (set in buildName)
          gA: rand() * TAU,
          gR: Math.pow(rand(), 0.7) * 1,       // 0..1, scaled to maxR at runtime
          spr: pickSprite(),
          base: 0.85 + rand() * 1.8,
          tw: rand() * TAU,
          tws: 0.4 + rand() * 1.6,
        });
      }
    }

    /* sample the name into screen-space target points, assign to particles */
    function buildName() {
      var fs = Math.min(width * 0.26, MOBILE ? 150 : 260);
      var oc = document.createElement("canvas");
      var octx = oc.getContext("2d");
      var font = function (s) {
        return "700 " + s + 'px "Great Vibes", "Playfair Display", cursive';
      };
      octx.font = font(fs);
      var tw = octx.measureText(NAME).width;
      var maxW = width * 0.82;
      if (tw > maxW) {
        fs = fs * (maxW / tw);
        octx.font = font(fs);
        tw = octx.measureText(NAME).width;
      }
      var pad = Math.ceil(fs * 0.5);
      var W = Math.ceil(tw) + pad * 2;
      var H = Math.ceil(fs * 1.6) + pad;
      oc.width = W;
      oc.height = H;
      octx.font = font(fs);
      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(NAME, W / 2, H / 2);

      var data = octx.getImageData(0, 0, W, H).data;
      var step = MOBILE ? 4 : 3;
      var pts = [];
      for (var y = 0; y < H; y += step) {
        for (var x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4 + 3] > 130) {
            pts.push([x - W / 2, y - H / 2]);
          }
        }
      }
      if (!pts.length) return;
      var ncx = width / 2;
      var ncy = height * 0.42;
      for (var i = 0; i < P.length; i++) {
        var pt = pts[(i * 1299709) % pts.length]; // spread assignment
        P[i].nx = ncx + pt[0] + (rand() - 0.5) * 2;
        P[i].ny = ncy + pt[1] + (rand() - 0.5) * 2;
      }
    }

    function buildFarStars() {
      var n = MOBILE ? 90 : 170;
      farStars = [];
      for (var i = 0; i < n; i++) {
        farStars.push({
          x: rand() * width,
          y: rand() * height,
          r: rand() * 1.3 + 0.2,
          ph: rand() * TAU,
          sp: 0.3 + rand() * 1.4,
          depth: rand(),
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 2 : 2);
      width = window.innerWidth;
      height = window.innerHeight;
      cx = width / 2;
      cy = height * 0.46;
      maxR = Math.min(width, height) * 0.42;
      SCALE = Math.min(width, height) / (MOBILE ? 33 : 40);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildFarStars();
      buildName();
      ctx.fillStyle = "#05030f";
      ctx.fillRect(0, 0, width, height);
    }

    /* ---------- targets per phase ---------- */
    var tg = { x: 0, y: 0, s: 1, a: 1 };

    function galaxyTarget(p) {
      var r = p.gR * maxR;
      var spin = galaxyAngle * (0.5 + 0.9 * (1 - p.gR));
      var a = p.gA + spin;
      tg.x = cx + Math.cos(a) * r;
      tg.y = cy + Math.sin(a) * r * 0.52 - height * 0.02;
      tg.s = 0.5 + 0.7 * (1 - p.gR);
      tg.a = 0.55 + 0.45 * (1 - p.gR);
      return tg;
    }

    function nameTarget(p) {
      tg.x = p.nx;
      tg.y = p.ny;
      tg.s = 0.9;
      tg.a = 1;
      return tg;
    }

    function heartTarget(p) {
      var beat = 1 + beatEnvNow * 0.11;
      var lx = p.lx * beat, ly = p.ly * beat, lz = p.lz * beat;
      var ca = Math.cos(heartAngle), sa = Math.sin(heartAngle);
      var rx = lx * ca + lz * sa;
      var rz = -lx * sa + lz * ca;
      var persp = FOCAL / (FOCAL - rz);
      tg.x = cx + rx * SCALE * persp;
      tg.y = cy - ly * SCALE * persp;
      tg.s = persp * (0.7 + 0.5 * beatEnvNow);
      tg.a = clamp(0.35 + (persp - 0.78) * 1.4, 0.25, 1);
      return tg;
    }

    function targetFor(p) {
      if (phase === PHASE.GALAXY) return galaxyTarget(p);
      if (phase === PHASE.NAME) return nameTarget(p);
      return heartTarget(p);
    }

    /* ---------- choreography ---------- */
    function setPhase(p) {
      phase = p;
      phaseAt = now;
    }

    function beginExperience() {
      if (started) return;
      started = true;
      startedAt = performance.now();
      setPhase(PHASE.GALAXY);

      document.body.classList.add("is-playing");
      intro.classList.add("is-out");
      hud.hidden = false;

      buildName();

      setTimeout(function () {
        setPhase(PHASE.NAME);
        onMusicMoment();
      }, MUSIC_AT_MS);
      setTimeout(function () {
        setPhase(PHASE.HEART);
        beating = true;
        beatPhase = 0;
        beatCount = 0;
        if (pulseRing) pulseRing.classList.add("is-alive");
      }, 5800);
      setTimeout(function () {
        setPhase(PHASE.PLAY);
        interactive = true;
      }, 8800);
      setTimeout(function () {
        if (hudHint) hudHint.classList.add("is-gone");
        if (letterBtn) letterBtn.classList.add("is-shown");
      }, 9800);
    }

    var letterOpen = false;

    function openLetter() {
      if (!letter || letterOpen) return;
      letterOpen = true;
      letter.hidden = false;
      letter.setAttribute("aria-hidden", "false");
      if (letterBtn) {
        letterBtn.classList.remove("is-shown");
        letterBtn.setAttribute("aria-expanded", "true");
      }
      requestAnimationFrame(function () {
        letter.classList.add("is-visible");
        revealLetter();
      });
    }

    function closeLetter() {
      if (!letter || !letterOpen) return;
      letterOpen = false;
      letter.classList.remove("is-visible");
      letter.setAttribute("aria-hidden", "true");
      if (letterBtn) {
        letterBtn.classList.add("is-shown");
        letterBtn.setAttribute("aria-expanded", "false");
      }
      var els = letter.querySelectorAll("[data-reveal]");
      setTimeout(function () {
        for (var i = 0; i < els.length; i++) els[i].classList.remove("is-shown");
        if (!letterOpen) letter.hidden = true;
      }, 1250);
    }

    if (letterBtn) {
      letterBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openLetter();
      });
    }
    if (letterClose) {
      letterClose.addEventListener("click", function (e) {
        e.stopPropagation();
        closeLetter();
      });
    }
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && letterOpen) closeLetter();
    });

    /* ---------- music card (top-right) ---------- */
    function revealNowPlaying() {
      if (!nowPlaying.classList.contains("np") && !nowPlaying.children.length) return;
      nowPlaying.hidden = false;
      requestAnimationFrame(function () {
        nowPlaying.classList.add("is-shown");
      });
    }

    function setMusicNotice(msg) {
      if (music.artistEl) music.artistEl.textContent = msg;
    }

    function onMusicMoment() {
      if (music.momentPlayed) return;
      music.momentPlayed = true;
      revealNowPlaying();

      if (music.audio && music.ready) {
        music.useSynth = false;
        sound.setOn(true, true);
        applyVolume(music.volume, true);
        startSong(true);
        if (soundBtn) soundBtn.setAttribute("aria-pressed", "true");
        return;
      }

      setMusicNotice("add song.mp3 to this folder for the full track");
      music.useSynth = true;
      sound.setOn(true);
      applyVolume(music.volume, true);
      if (soundBtn) soundBtn.setAttribute("aria-pressed", "true");

      var tries = 0;
      var waitForFile = setInterval(function () {
        tries++;
        if (music.audio && music.ready) {
          clearInterval(waitForFile);
          music.useSynth = false;
          sound.stopMelody();
          startSong(true);
        } else if (tries > 24) {
          clearInterval(waitForFile);
        }
      }, 250);
    }

    function setupMusic() {
      var hasFile = SONG_FILE && SONG_FILE.trim();
      var hasSpotify = SPOTIFY_URL && SPOTIFY_URL.trim();

      if (hasFile || hasSpotify) {
        buildCard();
        if (hasSpotify) fetchSpotifyMeta();
      }

      if (!hasFile) {
        setMusicNotice("add song.mp3 for full song (see script.js)");
        return;
      }

      var a = new Audio();
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      a.src = SONG_FILE;
      a.addEventListener("canplaythrough", function () {
        if (music.ready) return;
        music.ready = true;
        music.useSynth = false;
        music.audio = a;
        setMusicNotice(SONG_ARTIST || "now playing");
        if (music.momentPlayed) {
          sound.stopMelody();
          startSong(true);
        }
      });
      a.addEventListener("error", function () {
        setMusicNotice("song.mp3 missing — add the file next to index.html");
      });
      a.load();
    }

    function playIcon() {
      return "<svg viewBox='0 0 24 24' width='18' height='18'><path d='M8 5v14l11-7z' fill='currentColor'/></svg>";
    }
    function pauseIcon() {
      return "<svg viewBox='0 0 24 24' width='18' height='18'><path d='M6 5h4v14H6zM14 5h4v14h-4z' fill='currentColor'/></svg>";
    }

    function buildCard() {
      if (soundBtn) soundBtn.style.display = "none";
      nowPlaying.classList.add("np");
      nowPlaying.innerHTML = "";

      var cover = document.createElement("div");
      cover.className = "np__cover";
      if (SONG_COVER) cover.style.backgroundImage = "url('" + SONG_COVER + "')";
      else { cover.classList.add("np__cover--blank"); cover.textContent = "♥"; }

      var meta = document.createElement("div");
      meta.className = "np__meta";
      var titleEl = document.createElement("div");
      titleEl.className = "np__title";
      titleEl.textContent = SONG_TITLE || "our song";
      var artistEl = document.createElement("div");
      artistEl.className = "np__artist";
      artistEl.textContent = SONG_ARTIST || "loading…";
      music.artistEl = artistEl;
      music.titleEl = titleEl;
      var eq = document.createElement("div");
      eq.className = "np__eq";
      eq.innerHTML = "<span></span><span></span><span></span><span></span>";
      meta.appendChild(titleEl);
      meta.appendChild(artistEl);
      meta.appendChild(eq);

      var volRow = document.createElement("div");
      volRow.className = "np__vol";
      var volIcon = document.createElement("span");
      volIcon.className = "np__vol-icon";
      volIcon.setAttribute("aria-hidden", "true");
      volIcon.textContent = "♪";
      var volSlider = document.createElement("input");
      volSlider.type = "range";
      volSlider.className = "np__vol-slider";
      volSlider.min = "0";
      volSlider.max = "100";
      volSlider.value = String(Math.round(music.volume * 100));
      volSlider.setAttribute("aria-label", "Song volume");
      volSlider.addEventListener("input", function (e) {
        e.stopPropagation();
        applyVolume(parseInt(volSlider.value, 10) / 100);
      });
      volSlider.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
      });
      music.volSlider = volSlider;
      volRow.appendChild(volIcon);
      volRow.appendChild(volSlider);
      meta.appendChild(volRow);

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "np__toggle";
      toggle.setAttribute("aria-label", "Play or pause");
      toggle.innerHTML = playIcon();
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePlay();
      });
      music.toggleBtn = toggle;

      nowPlaying.appendChild(cover);
      nowPlaying.appendChild(meta);
      nowPlaying.appendChild(toggle);

      if (SPOTIFY_URL) {
        var link = document.createElement("a");
        link.className = "np__spotify";
        link.href = SPOTIFY_URL;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("aria-label", "Open in Spotify");
        link.textContent = "♫";
        link.addEventListener("click", function (e) { e.stopPropagation(); });
        nowPlaying.appendChild(link);
      }
    }

    function setPlayingUI(playing) {
      if (playing) nowPlaying.classList.add("is-playing");
      else nowPlaying.classList.remove("is-playing");
      if (music.toggleBtn) music.toggleBtn.innerHTML = playing ? pauseIcon() : playIcon();
    }

    function fadeAudioVolume(el, to, secs) {
      var from = el.volume;
      var start = performance.now();
      function step(ts) {
        var k = Math.min(1, (ts - start) / (secs * 1000));
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k < 1) requestAnimationFrame(step);
        else applyVolume(to, true);
      }
      requestAnimationFrame(step);
    }

    function startSong(isAuto) {
      if (!music.audio) return;
      sound.stopMelody();
      var play = music.audio.play();
      if (!play || !play.then) return;
      play
        .then(function () {
          setPlayingUI(true);
          fadeAudioVolume(music.audio, music.volume, isAuto ? 2.2 : 0.5);
          setMusicNotice(SONG_ARTIST || "now playing");
        })
        .catch(function () {
          setPlayingUI(false);
          if (isAuto) {
            setMusicNotice("tap ▶ to play the song");
          }
        });
    }

    function togglePlay() {
      if (!music.audio) return;
      if (music.audio.paused) startSong();
      else { music.audio.pause(); setPlayingUI(false); }
    }

    function fetchSpotifyMeta() {
      if (!SPOTIFY_URL) return;
      var coverEl = nowPlaying.querySelector(".np__cover");
      try {
        fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(SPOTIFY_URL))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d) return;
            if (d.thumbnail_url && !SONG_COVER && coverEl) {
              coverEl.style.backgroundImage = "url('" + d.thumbnail_url + "')";
              coverEl.classList.remove("np__cover--blank");
              coverEl.textContent = "";
            }
            if (d.title && music.titleEl && !SONG_TITLE) {
              var raw = d.title;
              var by = raw.match(/^(.+?)\s+by\s+(.+)$/i);
              if (by) {
                music.titleEl.textContent = by[1].trim();
                if (!SONG_ARTIST && music.artistEl) music.artistEl.textContent = by[2].trim();
              } else {
                music.titleEl.textContent = raw;
              }
            }
          })
          .catch(function () {});
      } catch (e) {}
    }

    function revealLetter() {
      var reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var els = letter.querySelectorAll("[data-reveal]");
      for (var i = 0; i < els.length; i++) {
        (function (el, idx) {
          setTimeout(function () {
            el.classList.add("is-shown");
          }, reduce ? 0 : 250 + idx * 430);
        })(els[i], i);
      }
    }

    /* solid glowing core behind the particles — gives the heart real weight */
    function drawHeartBody() {
      var beat = 1 + beatEnvNow * 0.11;
      var sq = Math.abs(Math.cos(heartAngle)) * 0.8 + 0.2; // squash with rotation
      var fade = Math.min(1, (now - phaseAt) / 1200);
      if (fade <= 0.01) return;
      ctx.save();
      ctx.beginPath();
      var first = true;
      for (var t = 0; t <= TAU + 0.05; t += 0.08) {
        var o = heartOutline(t);
        var X = cx + o[0] * SCALE * beat * sq;
        var Y = cy - o[1] * SCALE * beat;
        if (first) { ctx.moveTo(X, Y); first = false; }
        else ctx.lineTo(X, Y);
      }
      ctx.closePath();
      var glow = (0.16 + beatEnvNow * 0.14) * fade;
      var grad = ctx.createRadialGradient(
        cx, cy + 2 * SCALE, 0,
        cx, cy + 2 * SCALE, 17 * SCALE * beat
      );
      grad.addColorStop(0, "rgba(255,130,175," + glow + ")");
      grad.addColorStop(0.55, "rgba(235,45,115," + glow * 0.65 + ")");
      grad.addColorStop(1, "rgba(120,10,60,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    /* ---------- fx ---------- */
    function drawMiniHeart(x, y, sz, hue, a) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sz / 16, sz / 16);
      ctx.fillStyle = "hsla(" + hue + ", 92%, 74%, " + a + ")";
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(0, 0, -8, -2, -8, 4);
      ctx.bezierCurveTo(-8, 9, 0, 14, 0, 16);
      ctx.bezierCurveTo(0, 14, 8, 9, 8, 4);
      ctx.bezierCurveTo(8, -2, 0, 0, 0, 3);
      ctx.fill();
      ctx.restore();
    }

    function addRipple(x, y) {
      ripples.push({ x: x, y: y, r: 4, life: 1 });
    }

    function addBurst(x, y, big) {
      var n = big ? (MOBILE ? 24 : 44) : MOBILE ? 12 : 20;
      var hearts = [];
      for (var h = 0; h < n; h++) {
        var ang = rand() * TAU;
        var sp = (big ? 3 : 1.6) + rand() * (big ? 5 : 3);
        hearts.push({
          x: x, y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - (big ? 2.5 : 1.2),
          life: 1,
          rot: rand() * TAU,
          spin: (rand() - 0.5) * 0.15,
          size: (big ? 8 : 5) + rand() * (big ? 14 : 8),
          hue: 320 + rand() * 45,
        });
      }
      bursts.push(hearts);
    }

    function launchFirework(x, y) {
      var hue = 300 + rand() * 70;
      var n = MOBILE ? 55 : 110;
      var parts = [];
      for (var i = 0; i < n; i++) {
        var a = rand() * TAU;
        var sp = 1.5 + rand() * 6.5;
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.7 + rand() * 0.5,
          decay: 0.011 + rand() * 0.01,
          spr: rand() < 0.3 ? 3 : rand() < 0.6 ? 0 : 2,
          size: 1.2 + rand() * 1.8,
        });
      }
      fireworks.push(parts);
    }

    function fireworkFinale() {
      if (finaleDone) return;
      finaleDone = true;
      if (finaleBtn) finaleBtn.disabled = true;
      var fcx = width / 2, fcy = height * 0.4;
      for (var i = 0; i < (MOBILE ? 6 : 10); i++) {
        (function (idx) {
          setTimeout(function () {
            launchFirework(
              fcx + (rand() - 0.5) * width * 0.55,
              fcy + (rand() - 0.5) * height * 0.28
            );
            addBurst(fcx, fcy, true);
            if (sound.on) sound.heartbeat();
          }, idx * 260);
        })(i);
      }
      if (letterSecret) letterSecret.classList.add("is-visible");
    }

    function maybeShoot() {
      if (now - lastShoot < 2600 + rand() * 4200) return;
      lastShoot = now;
      var sx = width * 0.1 + rand() * width * 0.8;
      var sy = rand() * height * 0.35;
      var ang = Math.PI * 0.16 + rand() * Math.PI * 0.13;
      var sp = 9 + rand() * 8;
      shooting.push({
        x: sx, y: sy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 1,
        len: 90 + rand() * 90,
      });
    }

    /* ---------- input ---------- */
    beginBtn.addEventListener("click", beginExperience);

    if (soundBtn) {
      soundBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        sound.setOn(!sound.on);
        soundBtn.setAttribute("aria-pressed", sound.on ? "true" : "false");
      });
    }

    if (finaleBtn) {
      finaleBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        fireworkFinale();
      });
    }

    function uiHit(e) {
      return (
        e.target.closest(".begin-btn") ||
        e.target.closest(".finale-btn") ||
        e.target.closest(".hud__sound") ||
        e.target.closest(".letter-btn") ||
        e.target.closest(".letter__card") ||
        e.target.closest(".now-playing")
      );
    }

    function onDown(e) {
      if (uiHit(e) || !started) return;
      var pt = e.touches ? e.touches[0] : e;
      pointer.x = pt.clientX;
      pointer.y = pt.clientY;
      pointer.on = true;
      pointer.has = true;
      addRipple(pt.clientX, pt.clientY);
      addBurst(pt.clientX, pt.clientY, false);
      tapCount++;
      if (tapCount >= 3 && hudHint) hudHint.classList.add("is-gone");
      if (tapCount >= 7 && letterSecret) letterSecret.classList.add("is-visible");
      if (tapCount % 4 === 0) launchFirework(pt.clientX, pt.clientY);
      if (sound.on) sound.heartbeat();
    }

    function onMove(e) {
      var pt = e.touches ? e.touches[0] : e;
      pointer.x = pt.clientX;
      pointer.y = pt.clientY;
      pointer.has = true;
      if (started) pointer.on = true;
      if (cursorGlow && !MOBILE) {
        cursorGlow.style.transform =
          "translate(" + pt.clientX + "px," + pt.clientY + "px)";
        cursorGlow.style.opacity = "1";
      }
    }

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", function () {
      pointer.on = false;
    });

    /* ---------- render loop ---------- */
    function frame(ts) {
      now = ts || performance.now();
      dt = Math.min(50, now - (lastNow || now));
      lastNow = now;

      galaxyAngle += dt * 0.00026;
      heartAngle = Math.sin(now * 0.00028) * 0.62;

      // pointer parallax
      var tpx = pointer.has ? pointer.x : width / 2;
      var tpy = pointer.has ? pointer.y : height / 2;
      px += (tpx - width / 2 - px) * 0.04;
      py += (tpy - height / 2 - py) * 0.04;

      maybeShoot();

      // heartbeat envelope + audio trigger
      if (beating) {
        beatPhase += dt / sound.beatMs;
        var fl = Math.floor(beatPhase);
        if (fl !== beatCount) {
          beatCount = fl;
          if (sound.on) sound.heartbeat();
        }
        var bp = beatPhase - fl;
        var a1 = Math.exp(-Math.pow((bp - 0.0) / 0.055, 2));
        var a2 = 0.7 * Math.exp(-Math.pow((bp - 0.17) / 0.05, 2));
        beatEnvNow = Math.min(1, a1 + a2);
      }

      // ---- background: trail fade + nebula ----
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,3,15,0.26)";
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "screen";
      var nb = now * 0.00012;
      for (var b = 0; b < 3; b++) {
        var bx = width * (0.3 + Math.sin(nb + b * 2.1) * 0.25) + px * 0.05;
        var by = height * (0.32 + b * 0.2) + Math.cos(nb * 1.2 + b) * 50 + py * 0.05;
        var rg = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(width, height) * 0.42);
        var hue = b === 0 ? "255,60,130" : b === 1 ? "150,60,220" : "70,110,255";
        rg.addColorStop(0, "rgba(" + hue + "," + (0.07 - b * 0.012) + ")");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, width, height);
      }

      // ---- far stars ----
      ctx.globalCompositeOperation = "lighter";
      for (var s = 0; s < farStars.length; s++) {
        var fst = farStars[s];
        var twf = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now * 0.001 * fst.sp + fst.ph));
        ctx.fillStyle = "rgba(255,235,248," + twf * (0.2 + fst.depth * 0.45) + ")";
        ctx.beginPath();
        ctx.arc(
          fst.x + px * fst.depth * 0.05,
          fst.y + py * fst.depth * 0.05,
          fst.r * twf,
          0, TAU
        );
        ctx.fill();
      }

      // shooting stars
      for (var i = shooting.length; i--;) {
        var sh = shooting[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.012;
        if (sh.life <= 0 || sh.x > width + 120 || sh.y > height + 120) {
          shooting.splice(i, 1); continue;
        }
        var m = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy) || 1;
        var grad = ctx.createLinearGradient(
          sh.x, sh.y, sh.x - (sh.vx / m) * sh.len, sh.y - (sh.vy / m) * sh.len
        );
        grad.addColorStop(0, "rgba(255,240,250," + sh.life * 0.9 + ")");
        grad.addColorStop(1, "rgba(255,180,210,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - (sh.vx / m) * sh.len, sh.y - (sh.vy / m) * sh.len);
        ctx.stroke();
      }

      // ---- heart body (weight) ----
      if (phase === PHASE.HEART || phase === PHASE.PLAY) drawHeartBody();

      // ---- particles ----
      var sincePhase = now - phaseAt;
      var k = 0.052 + 0.13 * Math.exp(-sincePhase / 650);
      var pr = MOBILE ? 95 : 135;
      var doPush = interactive && pointer.on;

      ctx.globalCompositeOperation = "lighter";
      for (var pI = 0; pI < P.length; pI++) {
        var p = P[pI];
        var t2 = targetFor(p);

        if (doPush) {
          var dx = p.x - pointer.x;
          var dy = p.y - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < pr * pr) {
            var d = Math.sqrt(d2) || 1;
            var f = (1 - d / pr) * 6;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= 0.84;
        p.vy *= 0.84;
        p.x += p.vx;
        p.y += p.vy;
        p.x += (t2.x - p.x) * k;
        p.y += (t2.y - p.y) * k;
        p.cs += (t2.s - p.cs) * 0.12;
        p.ca += (t2.a - p.ca) * 0.06;

        p.tw += dt * 0.001 * p.tws;
        var tw = 0.78 + 0.22 * Math.sin(p.tw);
        var size = p.base * p.cs * 2.6;
        var alpha = p.ca * tw * 0.82;
        if (alpha <= 0.01 || size <= 0.05) continue;
        ctx.globalAlpha = alpha;
        ctx.drawImage(SPRITES[p.spr], p.x - size, p.y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;

      // ---- floaters (ambient rising hearts) ----
      ctx.globalCompositeOperation = "source-over";
      if (started && floaters.length < (MOBILE ? 7 : 13) && rand() > 0.965) {
        floaters.push({
          x: rand() * width, y: height + 20,
          vy: -(0.25 + rand() * 0.55), vx: (rand() - 0.5) * 0.3,
          size: 6 + rand() * 10, hue: 320 + rand() * 40,
          sway: rand() * TAU, swaySp: 0.5 + rand(),
        });
      }
      for (i = floaters.length; i--;) {
        var fl2 = floaters[i];
        fl2.y += fl2.vy;
        fl2.sway += 0.01 * fl2.swaySp;
        fl2.x += fl2.vx + Math.sin(fl2.sway) * 0.3;
        if (fl2.y < -24) { floaters.splice(i, 1); continue; }
        var fa = Math.min(1, (height - fl2.y) / height) * 0.4;
        ctx.save();
        ctx.translate(fl2.x, fl2.y);
        ctx.rotate(Math.sin(fl2.sway) * 0.25);
        drawMiniHeart(0, 0, fl2.size, fl2.hue, fa);
        ctx.restore();
      }

      // ---- ripples ----
      for (i = ripples.length; i--;) {
        var rp = ripples[i];
        rp.life -= 0.025; rp.r += 3;
        if (rp.life <= 0) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = "rgba(255,150,195," + rp.life * 0.35 + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, TAU);
        ctx.stroke();
      }

      // ---- bursts ----
      for (i = bursts.length; i--;) {
        var hs = bursts[i];
        var alive = false;
        for (var h = 0; h < hs.length; h++) {
          var ht = hs[h];
          ht.life -= 0.016;
          if (ht.life <= 0) continue;
          alive = true;
          ht.x += ht.vx; ht.y += ht.vy;
          ht.vy += 0.035; ht.vx *= 0.985;
          ht.rot += ht.spin;
          ctx.save();
          ctx.translate(ht.x, ht.y);
          ctx.rotate(ht.rot);
          drawMiniHeart(0, 0, ht.size, ht.hue, ht.life);
          ctx.restore();
        }
        if (!alive) bursts.splice(i, 1);
      }

      // ---- fireworks ----
      ctx.globalCompositeOperation = "lighter";
      for (i = fireworks.length; i--;) {
        var parts = fireworks[i];
        var fwAlive = false;
        for (var pp = 0; pp < parts.length; pp++) {
          var fp = parts[pp];
          fp.life -= fp.decay;
          if (fp.life <= 0) continue;
          fwAlive = true;
          fp.x += fp.vx; fp.y += fp.vy;
          fp.vy += 0.03; fp.vx *= 0.98;
          var fsz = fp.size * (1 + fp.life) * 3;
          ctx.globalAlpha = fp.life * 0.9;
          ctx.drawImage(SPRITES[fp.spr], fp.x - fsz, fp.y - fsz, fsz * 2, fsz * 2);
        }
        ctx.globalAlpha = 1;
        if (!fwAlive) fireworks.splice(i, 1);
      }

      ctx.globalCompositeOperation = "source-over";
      raf(frame);
    }

    /* ---------- boot ---------- */
    buildSprites();
    resize();
    buildParticles();
    window.addEventListener("resize", resize);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(buildName);
    }

    raf(frame);

    // music is set up last and isolated, so it can never block the visuals
    try { setupMusic(); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
