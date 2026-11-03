// One volume for every sound Nudged makes: background sound, rundown music, the alarm and the spoken voice.
// The store keeps the setting; sound modules read it here when they play.
let level = 0.6

export const getVolume = () => level
export function setVolumeLevel(v) {
  level = Math.min(1, Math.max(0, v))
}

// Background sound sits well under everything else, so it starts quiet even at full volume.
export const AMBIENT_LEVEL = 0.25
