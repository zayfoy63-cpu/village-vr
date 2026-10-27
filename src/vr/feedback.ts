// Retours immédiats : petits sons synthétisés (aucun fichier audio) et vibrations des manettes.

import { xrStore } from '../scene/xr';
import { VR_CONFIG } from './config';
import { useVR, type Hand } from './store';

export type FeedbackKind = 'hover' | 'click' | 'grab' | 'drop' | 'error' | 'event' | 'thud';

let ctx: AudioContext | null = null;

const TONES: Record<FeedbackKind, { f: number[]; type: OscillatorType; dur: number; gain: number }> = {
  hover: { f: [880], type: 'sine', dur: 0.04, gain: 0.35 },
  click: { f: [660, 990], type: 'triangle', dur: 0.07, gain: 0.6 },
  grab: { f: [440, 520], type: 'triangle', dur: 0.08, gain: 0.6 },
  drop: { f: [330, 220], type: 'sine', dur: 0.12, gain: 0.8 },
  error: { f: [180, 150], type: 'square', dur: 0.14, gain: 0.35 },
  event: { f: [523, 659, 784], type: 'sine', dur: 0.12, gain: 0.7 },
  // Plateau posé sur la table : petit « toc » de bois, grave et sec
  thud: { f: [150, 92], type: 'triangle', dur: 0.07, gain: 1 },
};

/** Son discret (ignoré si l'audio est indisponible ou coupé dans les paramètres) */
export function sfx(kind: FeedbackKind) {
  if (!useVR.getState().prefs.sound) return;
  try {
    ctx ??= new AudioContext();
    const spec = TONES[kind];
    const t0 = ctx.currentTime;
    spec.f.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = t0 + i * spec.dur * 0.8;
      o.type = spec.type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(VR_CONFIG.feedback.volume * spec.gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + spec.dur + 0.02);
    });
  } catch {
    // audio indisponible
  }
}

/** Vibration d'une manette (la main donnée, sinon la main dominante) */
export function haptic(kind: FeedbackKind, hand?: Hand | 'none') {
  try {
    const [intensity, ms] = VR_CONFIG.feedback.haptics[kind];
    const target = hand && hand !== 'none' ? hand : useVR.getState().prefs.dominant;
    for (const s of xrStore.getState().inputSourceStates) {
      const src = s.inputSource;
      if (src.handedness !== target || !src.gamepad) continue;
      const pad = src.gamepad as Gamepad & { hapticActuators?: { pulse?: (v: number, d: number) => void }[] };
      pad.hapticActuators?.[0]?.pulse?.(intensity, ms);
      void (pad as { vibrationActuator?: { playEffect?: (t: string, o: unknown) => void } }).vibrationActuator?.playEffect?.('dual-rumble', {
        duration: ms,
        strongMagnitude: intensity,
        weakMagnitude: intensity,
      });
    }
  } catch {
    // vibration indisponible
  }
}

/** Main à l'origine d'un événement pointeur (si le pointeur vient d'une manette ou d'une main) */
export function handOf(e: object): Hand | undefined {
  const st = (e as { pointerState?: unknown }).pointerState as { inputSource?: { handedness?: string }; xrInputSource?: { handedness?: string } } | undefined;
  const h = st?.inputSource?.handedness ?? st?.xrInputSource?.handedness;
  return h === 'left' || h === 'right' ? h : undefined;
}

/** Son + vibration d'une interaction */
export function feedback(kind: FeedbackKind, e?: object) {
  sfx(kind);
  haptic(kind, e ? handOf(e) : undefined);
}
