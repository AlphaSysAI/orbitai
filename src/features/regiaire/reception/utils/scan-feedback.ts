/** Retour sonore terrain (Web Audio API). */

function playTone(frequency: number, durationMs: number, type: OscillatorType = "sine") {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      void ctx.close();
    }, durationMs);
  } catch {
    // Audio non disponible — ignoré
  }
}

export function playScanSuccess() {
  playTone(880, 120);
  setTimeout(() => playTone(1175, 100), 90);
}

export function playScanError() {
  playTone(220, 200, "square");
}

export function playScanWarning() {
  playTone(440, 150);
}
