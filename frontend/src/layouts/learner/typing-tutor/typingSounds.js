// Keyboard feedback tones for the typing tutor.
//
// Everything is synthesised with the Web Audio API rather than loaded from
// files, so practice still sounds right on a slow school connection and nothing
// has to be downloaded or cached. The context is created on the learner's first
// keystroke because browsers refuse to start audio before a real interaction.

const STORAGE_KEY = "educlub-typing-sound";

let audioContext = null;
let muted = readMuted();

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    // Private browsing can refuse storage entirely. Sound on is the better
    // default, and losing the preference is not worth failing a keystroke over.
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
  } catch {
    // Preference is not persisted; the session still honours the toggle.
  }
  return muted;
}

function context() {
  if (muted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  // Browsers suspend the context when a tab is backgrounded.
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

/**
 * One short shaped tone. The envelope matters more than the pitch: a hard start
 * or stop clicks unpleasantly through cheap laptop speakers, so every tone
 * ramps in and out.
 */
function tone({ frequency, duration = 0.06, volume = 0.08, type = "sine", delay = 0 }) {
  const ctx = context();
  if (!ctx) return;

  const startAt = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

// A correct keystroke: quiet and high, so a whole paragraph of them stays
// pleasant rather than turning into a drum solo.
export function playKeyTick() {
  tone({ frequency: 880, duration: 0.045, volume: 0.05, type: "sine" });
}

// A wrong keystroke: low and short. Noticeable without being a punishment.
export function playError() {
  tone({ frequency: 180, duration: 0.12, volume: 0.09, type: "square" });
}

// Finishing a word keeps a young learner's momentum going.
export function playWordComplete() {
  tone({ frequency: 1046, duration: 0.05, volume: 0.045, type: "triangle" });
}

// Passing an activity: a rising three-note phrase.
export function playSuccess() {
  [523, 659, 784].forEach((frequency, index) => {
    tone({ frequency, duration: 0.16, volume: 0.07, type: "triangle", delay: index * 0.1 });
  });
}

// Finishing without passing: two flat notes, so the learner hears that the
// attempt was saved without hearing it as a failure.
export function playAttemptSaved() {
  [440, 392].forEach((frequency, index) => {
    tone({ frequency, duration: 0.14, volume: 0.06, type: "sine", delay: index * 0.12 });
  });
}
