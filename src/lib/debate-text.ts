import { Profanity } from "@2toad/profanity";
import type { DebateWithDebaters, RoundRow } from "./database.types";

// Text filter for what debaters write: custom prompts and rounds. Shared by
// the client lib (debates.ts) and the SSR fetchers (debates-server.ts).
//
// The DB-side handle check (`handle_is_clean`) strips spaces and then
// substring-matches, which is right for handles and wrong for prose — "but
// the", "document" and "author" all trip it. Prose gets the word-boundary
// package instead.
//
// ponytail: this runs in the app, not in Postgres — the RPCs accept whatever a
// hand-rolled request sends. That is why every read path also goes through
// cleanDebate / cleanRound: bad text can get stored, but never rendered. Move
// the check into the database (or behind an API route) when reporting and
// moderation land.

const filter = new Profanity();

// A civic debate has to be able to say these; the stock list blocks them.
filter.removeWords([
  "sex", "nazi", "porn", "porno", "pornography", "breasts", "penis", "vagina",
  "anal", "anus", "rectum", "semen", "orgasm", "viagra", "bestiality", "lust",
  "sadist", "masochist", "bloody", "damn", "crap", "pawn", "butt", "bum",
  "balls", "snatch", "screwing", "pissed", "cox", "willy",
]);

export function hasProfanity(text: string): boolean {
  return filter.exists(text);
}

// Topic questions are editorial; only a user-written prompt needs the filter.
export function cleanDebate(d: DebateWithDebaters): DebateWithDebaters {
  return d.topic_id ? d : { ...d, prompt: filter.censor(d.prompt) };
}

export function cleanRound(r: RoundRow): RoundRow {
  return { ...r, content: filter.censor(r.content) };
}
