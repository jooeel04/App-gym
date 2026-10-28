// Aviso de fin de descanso: pitidos y vibración (según lo elegido en Ajustes).
// iOS solo deja sonar audio creado tras un toque del usuario, así que el contexto
// de audio se prepara (unlockAudio) al anotar la serie que inicia el descanso.

import type { RestAlert } from "./preferences";

let audio: AudioContext | null = null;

export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

export function restFinishedAlert(mode: RestAlert = "both") {
  if (mode === "off") return;
  if (mode !== "sound" && "vibrate" in navigator) navigator.vibrate([250, 120, 250, 120, 400]);
  if (mode === "vibrate" || !audio) return;
  [0, 0.25, 0.5].forEach((delay, i) => {
    const osc = audio!.createOscillator(), gain = audio!.createGain();
    const t = audio!.currentTime + delay;
    osc.frequency.value = i === 2 ? 1180 : 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}
