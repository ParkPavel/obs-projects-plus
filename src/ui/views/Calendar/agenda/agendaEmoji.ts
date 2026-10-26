// w4-p05 (audit F10, P11a) — the agenda's emoji, and the ones saved broken.
//
// The picker's source had been saved once as UTF-8 read back as Windows-1251,
// so every emoji in it was a run of Cyrillic letters and signs, and a list
// given such an icon stored that run in the settings. The literals are
// repaired (two repeats replaced); a stored broken value is shown as the emoji
// it was, and anything else as stored.

import { undoCp1251Reading } from "src/lib/text/cp1251";

export const AGENDA_EMOJIS: readonly string[] = [
  "🔥", "⭐", "💪", "🎯", "⚡", "💎", "🏆", "👑",
  "📋", "📝", "✅", "❌", "⏰", "📅", "🔔", "💡",
  "🚀", "🎉", "🎊", "🎈", "🎁", "🧭", "🔮", "🌟",
  "📌", "📍", "🔗", "⚙️", "🛠️", "🔧", "🧩", "💬",
  "📧", "📬", "📪", "📫", "📮", "📤", "📥", "📦",
  "🎨", "🎭", "🎪", "🎬", "🎵", "🎸", "🎹", "🎤",
];

/** A stored emoji icon as it is shown: the repaired emoji, or the value as stored. */
export function agendaEmoji(value: string): string {
  const repaired = undoCp1251Reading(value);
  return repaired !== null && !/[\u0400-\u04ff]/.test(repaired) ? repaired : value;
}
