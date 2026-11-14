// On-screen commentary with optional browser speech (Web Speech API).
// Speech is a bonus: if the browser has no voices the captions still work.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voiceOn = true;
try { voiceOn = localStorage.getItem('astroni.voice') !== 'off'; } catch {}

function pickVoice() {
  const voices = synth?.getVoices() ?? [];
  return voices.find((v) => /en-GB/i.test(v.lang) && /male|george|ryan/i.test(v.name))
    ?? voices.find((v) => /en-(GB|US)/i.test(v.lang))
    ?? null;
}

export function createNarrator(ui) {
  const box = document.createElement('div');
  box.className = 'caption';
  box.innerHTML = '<div class="caption-who"></div><div class="caption-text"></div>';
  ui.appendChild(box);

  const toggle = document.createElement('button');
  toggle.className = 'voice-toggle';
  const paint = () => (toggle.textContent = voiceOn ? '🔊 Voice on' : '🔇 Voice off');
  paint();
  toggle.onclick = () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem('astroni.voice', voiceOn ? 'on' : 'off'); } catch {}
    if (!voiceOn) synth?.cancel();
    paint();
  };
  ui.appendChild(toggle);

  return {
    say(text, who = 'Mission Control') {
      box.querySelector('.caption-who').textContent = who;
      box.querySelector('.caption-text').textContent = text;
      box.classList.remove('show');
      void box.offsetWidth; // restart the fade-in animation
      box.classList.add('show');
      if (voiceOn && synth) {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = 1.02;
        u.pitch = who === 'Mission Control' ? 0.9 : 1.05;
        synth.speak(u);
      }
    },
    hide() {
      box.classList.remove('show');
    },
    stop() {
      synth?.cancel();
    },
  };
}
