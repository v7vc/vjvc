
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;

  const WAKE = [
    'pointerdown', 'pointerup', 'mousedown',
    'click', 'keydown', 'touchend'
  ];

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  const rnd = n => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // ==========================================
  // ORIGINAL LOFI COMPOSITIONS
  // ==========================================

  const TRACKS = [
    {
      bpm: 76,
      roots: [45, 41, 36, 43],
      chords: [
        [0, 3, 7, 10],
        [0, 4, 7, 11],
        [0, 3, 7, 10],
        [0, 4, 7, 11]
      ],
      pent: [0, 3, 5, 7, 10],
      bass: [0, 4],
      density: 0.43
    },
    {
      bpm: 82,
      roots: [38, 43, 40, 36],
      chords: [
        [0, 3, 7, 10],
        [0, 4, 7, 10],
        [0, 3, 7, 10],
        [0, 4, 7, 11]
      ],
      pent: [0, 2, 3, 7, 10],
      bass: [0, 3, 6],
      density: 0.38
    },
    {
      bpm: 72,
      roots: [41, 36, 43, 38],
      chords: [
        [0, 4, 7, 11],
        [0, 3, 7, 10],
        [0, 4, 7, 11],
        [0, 3, 7, 10]
      ],
      pent: [0, 2, 4, 7, 9],
      bass: [0, 4],
      density: 0.35
    },
    {
      bpm: 80,
      roots: [43, 38, 45, 40],
      chords: [
        [0, 3, 7, 10],
        [0, 4, 7, 11],
        [0, 3, 7, 10],
        [0, 4, 7, 11]
      ],
      pent: [0, 3, 5, 7, 10],
      bass: [0, 4, 6],
      density: 0.4
    }
  ];

  const M = {
    ctx: null,
    master: null,
    bus: null,
    delay: null,
    rev: null,
    noise: null,
    keep: null,

    on: false,
    armed: false,
    vol: 0.1,
    timer: null,
    nextT: 0,
    stepN: 0,
    ti: -1,
    tr: null,

    style: 'lofi',
    key: '',
    text: { label: 'Music' },

    pill: null,
    btn: null,
    range: null,
    slider: null,
    labelEl: null,

    // ========================================
    // AUDIO INITIALIZATION
    // ========================================

    init() {
      if (this.ctx) return true;
      if (!AC) return false;

      const ctx = new AC();
      this.ctx = ctx;

      ctx.onstatechange = () => {
        this.paint();

        if (
          this.on &&
          ctx.state !== 'running' &&
          !document.hidden
        ) {
          this.arm();
        }
      };

      const comp = ctx.createDynamicsCompressor();

      comp.threshold.value = -18;
      comp.ratio.value = 3;
      comp.attack.value = 0.015;
      comp.release.value = 0.3;

      this.master = ctx.createGain();
      this.master.gain.value = 0;

      this.master.connect(comp);
      comp.connect(ctx.destination);

      this.bus = ctx.createGain();
      this.bus.gain.value = 0.8;
      this.bus.connect(this.master);

      // Warm tape delay
      this.delay = ctx.createDelay(1.5);
      this.delay.delayTime.value = 0.32;

      const fb = ctx.createGain();
      fb.gain.value = 0.22;

      const dl = ctx.createBiquadFilter();
      dl.type = 'lowpass';
      dl.frequency.value = 2200;

      const dw = ctx.createGain();
      dw.gain.value = 0.2;

      this.delay.connect(dl);
      dl.connect(fb);
      fb.connect(this.delay);
      dl.connect(dw);
      dw.connect(this.master);

      // Soft reverb
      const len = Math.floor(ctx.sampleRate * 3.8);

      const ir = ctx.createBuffer(2, len, ctx.sampleRate);

      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);

        for (let i = 0; i < len; i++) {
          d[i] =
            (Math.random() * 2 - 1) *
            Math.pow(1 - i / len, 3);
        }
      }

      this.rev = ctx.createConvolver();
      this.rev.buffer = ir;

      const rw = ctx.createGain();
      rw.gain.value = 0.34;

      this.rev.connect(rw);
      rw.connect(this.master);

      // Shared noise buffer
      this.noise = ctx.createBuffer(
        1,
        ctx.sampleRate * 2,
        ctx.sampleRate
      );

      const nd = this.noise.getChannelData(0);

      for (let i = 0; i < nd.length; i++) {
        nd[i] = Math.random() * 2 - 1;
      }

      return true;
    },

    // ========================================
    // SOUND GENERATOR
    // ========================================

    tone(type, f, t, dur, peak, opt = {}) {
      const ctx = this.ctx;

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = type;
      o.frequency.setValueAtTime(f, t);

      if (opt.detune) {
        o.detune.value = opt.detune;
      }

      if (opt.slide) {
        o.frequency.exponentialRampToValueAtTime(
          opt.slide,
          t + dur
        );
      }

      const a = opt.a || 0.02;

      g.gain.setValueAtTime(0.0001, t);

      g.gain.exponentialRampToValueAtTime(
        peak,
        t + a
      );

      if (opt.hold) {
        g.gain.setValueAtTime(
          peak,
          t + dur * opt.hold
        );
      }

      g.gain.exponentialRampToValueAtTime(
        0.0001,
        t + dur
      );

      let node = o;

      if (opt.lp) {
        const f1 = ctx.createBiquadFilter();

        f1.type = 'lowpass';
        f1.frequency.value = opt.lp;

        o.connect(f1);
        node = f1;
      }

      node.connect(g);
      g.connect(this.bus);

      if (opt.send) g.connect(this.delay);
      if (opt.rv) g.connect(this.rev);

      o.start(t);
      o.stop(t + dur + 0.05);
    },

    // ========================================
    // ELECTRIC PIANO
    // ========================================

    piano(note, t, dur = 1.5, volume = 0.05) {
      const f = freq(note);

      this.tone(
        'triangle',
        f,
        t,
        dur,
        volume,
        {
          a: 0.012,
          lp: 2600,
          send: true,
          rv: true
        }
      );

      this.tone(
        'sine',
        f * 2,
        t,
        dur * 0.45,
        volume * 0.17,
        {
          a: 0.006,
          rv: true
        }
      );

      this.tone(
        'sine',
        f * 3,
        t,
        dur * 0.22,
        volume * 0.035,
        {
          a: 0.004
        }
      );
    },

    // ========================================
    // WARM CHORDS
    // ========================================

    chords(t) {
      const tr = this.tr;
      const bar = Math.floor(this.stepN / 8);
      const ci = bar % 4;

      const root = tr.roots[ci];
      const intervals = tr.chords[ci];

      intervals.forEach((x, k) => {
        const note = root + 24 + x;

        this.tone(
          'triangle',
          freq(note),
          t,
          3.5,
          0.026,
          {
            a: 0.65,
            hold: 0.75,
            lp: 1700,
            detune: k % 2 ? 4 : -4,
            rv: true
          }
        );

        this.tone(
          'sine',
          freq(note + 12),
          t,
          3.1,
          0.009,
          {
            a: 0.8,
            hold: 0.7,
            rv: true
          }
        );
      });
    },

    // ========================================
    // BASS
    // ========================================

    bass(t, note) {
      this.tone(
        'sine',
        freq(note),
        t,
        0.75,
        0.15,
        {
          a: 0.035,
          lp: 450
        }
      );

      this.tone(
        'triangle',
        freq(note + 12),
        t,
        0.5,
        0.025,
        {
          a: 0.04,
          lp: 600
        }
      );
    },

    // ========================================
    // LOFI DRUMS
    // ========================================

    kick(t) {
      this.tone(
        'sine',
        95,
        t,
        0.28,
        0.22,
        {
          a: 0.003,
          slide: 42
        }
      );
    },

    snare(t) {
      this.hit(t, 0.14, 0.065, false);

      this.tone(
        'triangle',
        185,
        t,
        0.1,
        0.025,
        { a: 0.004, lp: 700 }
      );
    },

    hat(t, vol = 0.022) {
      this.hit(t, 0.035, vol, true);
    },

    hit(t, dur, peak, hat) {
      const ctx = this.ctx;

      const s = ctx.createBufferSource();
      s.buffer = this.noise;

      const f = ctx.createBiquadFilter();

      f.type = hat ? 'highpass' : 'bandpass';
      f.frequency.value = hat ? 7200 : 1700;

      const g = ctx.createGain();

      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        t + dur
      );

      s.connect(f);
      f.connect(g);
      g.connect(this.bus);

      s.start(t);
      s.stop(t + dur + 0.02);
    },

    // ========================================
    // VINYL TEXTURE
    // ========================================

    vinyl(t) {
      if (Math.random() > 0.16) return;

      this.hit(
        t,
        random(0.008, 0.035),
        random(0.006, 0.013),
        true
      );
    },

    // ========================================
    // ORIGINAL MELODY
    // ========================================

    melody(t, bar, pos) {
      const tr = this.tr;

      const seed = bar * 31 + pos * 17 + this.ti * 113;

      if (rnd(seed) > tr.density) return;

      const ci = bar % 4;
      const root = tr.roots[ci];

      const degree = tr.pent[
        Math.floor(rnd(seed + 1) * tr.pent.length)
      ];

      const octave = rnd(seed + 2) > 0.78 ? 24 : 12;

      const note = root + 36 + octave + degree;

      this.piano(
        note,
        t,
        1.1 + rnd(seed + 3) * 1.3,
        0.037
      );
    },

    // ========================================
    // MAIN LOFI SCHEDULER
    // ========================================

    schedLofi(step, t) {
      const tr = this.tr;

      const bar = Math.floor(step / 8);
      const pos = step % 8;

      const ci = bar % 4;
      const root = tr.roots[ci];

      const beat = 60 / tr.bpm;

      // New chord every bar
      if (pos === 0) {
        this.chords(t);
      }

      // Relaxed kick pattern
      if (pos === 0 || pos === 4) {
        this.kick(t);
      }

      // Soft snare
      if (pos === 2 || pos === 6) {
        this.snare(t);
      }

      // Lazy hi-hats
      if (pos === 1 || pos === 5) {
        this.hat(t, 0.018);
      }

      if (pos === 7 && rnd(bar * 19 + this.ti) > 0.4) {
        this.hat(t, 0.012);
      }

      // Bass
      if (tr.bass.includes(pos)) {
        this.bass(
          t,
          root
        );
      }

      // New melodic phrases
      if ([0, 2, 5, 7].includes(pos)) {
        this.melody(t, bar, pos);
      }

      // Vinyl texture
      this.vinyl(t);

      // Occasional quiet piano accent
      if (pos === 3 && rnd(bar + 29) > 0.65) {
        this.piano(
          root + 48 + pick([3, 7, 10]),
          t + beat * 0.15,
          1.8,
          0.022
        );
      }
    },

    // ========================================
    // TRACK SELECTION
    // ========================================

    pick() {
      let i = this.ti;

      while (i === this.ti) {
        i = Math.floor(Math.random() * TRACKS.length);
      }

      this.ti = i;
      this.tr = TRACKS[i];

      if (this.delay) {
        this.delay.delayTime.setValueAtTime(
          60 / this.tr.bpm * 0.75,
          this.ctx.currentTime
        );
      }
    },

    sched(step, t) {
      if (step % 128 === 0 || !this.tr) {
        this.pick();
      }

      this.schedLofi(step, t);
    },

    // ========================================
    // AUDIO CLOCK
    // ========================================

    pump() {
      if (!this.ctx || !this.on) return;

      while (
        this.nextT <
        this.ctx.currentTime + 0.25
      ) {
        this.sched(this.stepN, this.nextT);

        this.stepN++;

        this.nextT += 60 / this.tr.bpm / 2;
      }
    },

    // ========================================
    // BROWSER AUDIO UNLOCK
    // ========================================

    unlock() {
      const ctx = this.ctx;

      try {
        const src = ctx.createBufferSource();

        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      } catch (e) {}

      try {
        if (navigator.audioSession) {
          navigator.audioSession.type = 'playback';
        }
      } catch (e) {}
    },

    kick() {
      if (!this.ctx) return;

      this.unlock();

      if (this.ctx.state !== 'running') {
        this.ctx.resume();
      }
    },

    // ========================================
    // VOLUME
    // ========================================

    apply() {
      if (!this.ctx) return;

      this.master.gain.setTargetAtTime(
        this.on ? this.vol : 0,
        this.ctx.currentTime,
        0.25
      );
    },

    save() {
      try {
        localStorage.setItem(
          this.key,
          JSON.stringify({
            on: this.on,
            vol: this.vol
          })
        );
      } catch (e) {}
    },

    setOn(v) {
      if (v && !this.init()) {
        this.on = false;
        this.paint();
        return false;
      }

      this.on = !!v;

      if (this.on) {
        this.unlock();

        if (this.ctx.state !== 'running') {
          this.ctx.resume();
        }

        if (!this.timer) {
          this.nextT = this.ctx.currentTime + 0.1;

          this.timer = setInterval(
            () => this.pump(),
            40
          );
        }

      } else if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;

        const c = this.ctx;

        setTimeout(() => {
          if (!this.on && c.state === 'running') {
            c.suspend();
          }
        }, 900);
      }

      this.apply();
      this.save();
      this.paint();

      return true;
    },

    setVol(v) {
      this.vol = Math.min(1, Math.max(0, v));

      this.apply();
      this.save();
      this.paint();
    },

    // ========================================
    // WAKE EVENTS
    // ========================================

    onWake(e) {
      if (
        e &&
        e.target &&
        e.target.closest &&
        e.target.closest('.mu-pill')
      ) return;

      if (!M.on) {
        M.setOn(true);
      } else {
        M.kick();
      }

      setTimeout(() => {
        if (M.ctx && M.ctx.state === 'running') {
          M.disarm();
        }

        M.paint();
      }, 400);
    },

    arm() {
      if (this.armed) return;

      this.armed = true;

      WAKE.forEach(ev => {
        window.addEventListener(ev, this.onWake, true);
      });

      this.paint();
    },

    disarm() {
      if (!this.armed) return;

      this.armed = false;

      WAKE.forEach(ev => {
        window.removeEventListener(ev, this.onWake, true);
      });

      this.paint();
    },

    // ========================================
    // UI PAINT
    // ========================================

    paint() {
      if (!this.pill) return;

      const run = !!(
        this.ctx &&
        this.ctx.state === 'running'
      );

      const on = this.on || this.armed;

      this.pill.classList.toggle('on', on);
      this.pill.classList.toggle('run', on && run);
      this.pill.classList.toggle('wait', on && !run);

      this.btn.setAttribute(
        'aria-pressed',
        on ? 'true' : 'false'
      );

      this.btn.setAttribute(
        'aria-label',
        this.text.label
      );

      this.labelEl.textContent = this.text.label;

      const pv = Math.round(this.vol * 100);

      if (
        document.activeElement !== this.range &&
        Number(this.range.value) !== pv
      ) {
        this.range.value = pv;
      }

      this.range.setAttribute(
        'aria-valuetext',
        this.range.value + '%'
      );

      this.slider.style.setProperty(
        '--v',
        this.range.value
      );
    },

    // ========================================
    // ORIGINAL PLAYER INTERFACE
    // ========================================

    build(mount, before) {
      const pill = document.createElement('div');

      pill.className = 'mu-pill';

      pill.innerHTML =
        '<button type="button" class="mu-btn" aria-pressed="false">' +
        '<span class="mu-eq" aria-hidden="true">' +
        '<i></i><i></i><i></i>' +
        '</span>' +
        '<span class="mu-label"></span>' +
        '</button>' +
        '<div class="mu-vol">' +
        '<div class="mu-slider">' +
        '<div class="mu-fill"></div>' +
        '<input class="mu-range" type="range" min="0" max="100" step="1" value="10" aria-label="Volume">' +
        '</div>' +
        '</div>';

      mount.insertBefore(pill, before || null);

      this.pill = pill;
      this.btn = pill.querySelector('.mu-btn');
      this.labelEl = pill.querySelector('.mu-label');
      this.range = pill.querySelector('.mu-range');
      this.slider = pill.querySelector('.mu-slider');

      this.btn.addEventListener('click', () => {
        if (
          this.on &&
          this.ctx &&
          this.ctx.state !== 'running'
        ) {
          this.kick();

          setTimeout(() => {
            if (this.ctx.state === 'running') {
              this.disarm();
            }

            this.paint();
          }, 400);

          return;
        }

        if (this.on || this.armed) {
          this.disarm();
          this.setOn(false);
        } else {
          this.setOn(true);
        }
      });

      this.range.addEventListener('input', () => {
        this.setVol(Number(this.range.value) / 100);
      });

      this.range.addEventListener('pointerdown', () => {
        this.slider.classList.add('drag');
      });

      ['pointerup', 'pointercancel', 'blur'].forEach(ev => {
        this.range.addEventListener(ev, () => {
          this.slider.classList.remove('drag');
        });
      });
    }
  };

  // ==========================================
  // VISIBILITY MANAGEMENT
  // ==========================================

  document.addEventListener('visibilitychange', () => {
    if (!M.on || !M.ctx) return;

    if (document.hidden) {
      M.ctx.suspend();
    } else {
      M.ctx.resume();

      setTimeout(() => {
        if (M.on && M.ctx.state !== 'running') {
          M.arm();
        }
      }, 400);
    }
  });

  // ==========================================
  // PUBLIC API — SAME AS ORIGINAL
  // ==========================================

  window.Music = {
    init(o) {
      M.style = 'lofi';
      M.key = o.key;

      if (o.text) {
        M.text = o.text;
      }

      M.build(o.mount, o.before);

      let pref = null;

      try {
        pref = JSON.parse(
          localStorage.getItem(M.key) || 'null'
        );
      } catch (e) {}

      M.vol =
        pref && pref.vol >= 0 && pref.vol <= 1
          ? pref.vol
          : 0.1;

      if (!pref || pref.on) {
        M.setOn(true);
        M.arm();

        setTimeout(() => {
          if (M.ctx && M.ctx.state === 'running') {
            M.disarm();
          }

          M.paint();
        }, 700);
      }

      M.paint();
    },

    setText(t) {
      M.text = t;
      M.paint();
    }
  };

})();
