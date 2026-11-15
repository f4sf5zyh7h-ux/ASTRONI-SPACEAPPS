// On-screen commentary with voice.
// 1. If a recorded line exists at public/audio/<id>.mp3 it is played through a radio filter.
// 2. Otherwise the browser speaks it, using the most natural voice available
//    (Edge "Natural" neural voices > Google voices > anything English).
// Captions always show, so voice is a bonus.

import recorded from 'virtual:audio-list';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voiceOn = true;
try { voiceOn = localStorage.getItem('astroni.voice') !== 'off'; } catch {}

/** Higher score = more human-sounding. */
function scoreVoice(v) {
  let s = 0;
  if (!/^en/i.test(v.lang)) return -1;
  if (/natural/i.test(v.name)) s += 100; // Edge neural voices, e.g. "Microsoft Ryan Online (Natural)"
  if (/online/i.test(v.name)) s += 40;
  if (/google/i.test(v.name)) s += 30; // Chrome's network voices
  if (/en-GB/i.test(v.lang)) s += 10;
  if (/ryan|guy|davis|christopher|eric|uk english male/i.test(v.name)) s += 5;
  if (/david|zira|mark/i.test(v.name) && !/natural/i.test(v.name)) s -= 20; // old robotic Windows voices
  return s;
}

/** Captions keep the written form; the voice gets words it can say (no spelled-out letters or symbols). */
const SAY = [
  [/AURORA-(\d+)/g, 'Aurora $1'], [/AURORA/g, 'Aurora'], [/ASTRONI/g, 'Astroni'],
  [/O₂/g, 'oxygen'], [/Δv/g, 'delta-v'], [/km\/s/g, 'kilometres per second'], [/m\/s/g, 'metres per second'],
  [/\bkm\b/g, 'kilometres'], [/\bkW\b/g, 'kilowatts'], [/°C/g, ' degrees'], [/\$(\d+)M/g, '$1 million dollars'],
  [/\bRCS\b/g, 'R C S'], [/\bEVA\b/g, 'spacewalk'], [/…/g, '...'],
];
const spoken = (text) => SAY.reduce((s, [re, to]) => s.replace(re, to), text);

let bestVoice = null;
function refreshVoices() {
  const voices = synth?.getVoices() ?? [];
  bestVoice = voices.filter((v) => scoreVoice(v) >= 0).sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}
if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
}

// ---- Radio sound (Web Audio) ----
let ctx;
function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Short two-tone radio beep, like a mission-control mic key. */
function radioBeep() {
  try {
    const a = audioCtx();
    const t = a.currentTime;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    g.gain.setValueAtTime(0.08, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    g.connect(a.destination);
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1250, t);
    o.frequency.setValueAtTime(1650, t + 0.08);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.21);
  } catch {}
}

/** Play a recorded clip through a band-pass "radio" filter. Resolves false if the file is missing. */
function playRecorded(id, onStart) {
  return new Promise((resolve) => {
    const el = new Audio(`${import.meta.env.BASE_URL}audio/${id}.mp3`);
    el.addEventListener('error', () => resolve(null), { once: true });
    el.addEventListener('canplaythrough', () => {
      try {
        const a = audioCtx();
        const src = a.createMediaElementSource(el);
        const hp = a.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        const lp = a.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3400; // telephone/radio band
        src.connect(hp).connect(lp).connect(a.destination);
      } catch {}
      onStart();
      el.play().catch(() => {});
      resolve(el);
    }, { once: true });
  });
}

export function createNarrator(ui) {
  const box = document.createElement('div');
  box.className = 'caption';
  box.innerHTML = '<div class="caption-who"></div><div class="caption-text"></div>';
  ui.appendChild(box);

  let clip = null;
  // Is a line still being spoken? `token` makes sure a cancelled line's late
  // "ended" event can't clear the flag for the line that replaced it.
  let busy = false;
  let token = 0;
  let safety;
  const done = (t) => {
    if (t !== token) return;
    busy = false;
    clearTimeout(safety);
  };
  const stopAll = () => {
    token++;
    busy = false;
    clearTimeout(safety);
    synth?.cancel();
    clip?.pause();
    clip = null;
  };

  const toggle = document.createElement('button');
  toggle.className = 'voice-toggle';
  const paint = () => (toggle.textContent = voiceOn ? '🔊 Voice on' : '🔇 Voice off');
  paint();
  toggle.onclick = () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem('astroni.voice', voiceOn ? 'on' : 'off'); } catch {}
    if (!voiceOn) stopAll();
    paint();
  };
  ui.appendChild(toggle);

  const speak = (text, who, t) => {
    if (!synth || t !== token) return done(t);
    const u = new SpeechSynthesisUtterance(spoken(text));
    // Chrome stops long utterances after ~15 s unless nudged; keep it going.
    const keepAlive = setInterval(() => { if (synth.speaking) { synth.pause(); synth.resume(); } }, 10000);
    u.onend = () => { clearInterval(keepAlive); done(t); };
    u.onerror = () => { clearInterval(keepAlive); done(t); };
    synth.resume(); // a paused/stuck queue would swallow the line
    if (bestVoice) u.voice = bestVoice;
    // Natural voices sound best untouched; only nudge the robotic ones.
    const natural = bestVoice && /natural|google/i.test(bestVoice.name);
    u.rate = natural ? 1.0 : 0.95;
    u.pitch = natural ? 1.0 : who === 'Mission Control' ? 0.9 : 1.0;
    synth.speak(u);
  };

  return {
    /** Show a caption and voice it. `id` = optional recorded clip name (public/audio/<id>.mp3). */
    async say(text, who = 'Mission Control', id = null) {
      box.querySelector('.caption-who').textContent = who;
      box.querySelector('.caption-text').textContent = text;
      box.classList.remove('show');
      void box.offsetWidth; // restart the fade-in
      box.classList.add('show');
      if (!voiceOn) return;
      stopAll();
      const t = token;
      busy = true;
      // Never wait forever if the browser drops the "ended" event: ~110 ms per character + slack.
      safety = setTimeout(() => done(t), 3000 + text.length * 110);
      radioBeep();
      if (id && recorded.includes(id)) {
        const c = await playRecorded(id, () => {});
        if (t !== token) return c?.pause();
        if (c) {
          clip = c;
          c.addEventListener('ended', () => done(t), { once: true });
          return;
        }
      }
      setTimeout(() => speak(text, who, t), 220); // after the beep
    },
    /** True while the current line is still being spoken. */
    isSpeaking: () => busy,
    hide() {
      box.classList.remove('show');
    },
    stop: stopAll,
    /** Name of the voice in use, for the settings hint. */
    voiceName: () => bestVoice?.name ?? 'none',
  };
}
