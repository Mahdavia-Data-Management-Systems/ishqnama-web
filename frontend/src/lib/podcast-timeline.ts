import { MASCOTS, PODCAST_AUDIO_ORIGIN, type MascotExpression, type MascotId } from "@/config/podcast";

/**
 * The timeline file `scripts/diarize_podcast.py` writes beside a recording and the onboarding
 * skill reviews: who speaks when, with which expression, and what they say. The bubble plays
 * the recording against it: the speaking mascot glows and shows the turn's expression, the
 * other listens.
 */
export interface PodcastTurn {
  speaker: MascotId;
  fromMs: number;
  toMs: number;
  /** What the speaker shows; the listener is implied, so `listening` is never in the file. */
  expression: Exclude<MascotExpression, "listening">;
  text: string;
}

export interface PodcastTimeline {
  version: 1;
  /** The recording's file name, in the same folder as the timeline. */
  audio: string;
  /** The topic, as the bubble heads it; in the recording's own script. */
  title?: string;
  /** One line under the title. */
  caption?: string;
  durationMs: number;
  language: string;
  speakers: Partial<Record<MascotId, { cluster: number; medianPitchHz: number; speechMs: number }>>;
  turns: PodcastTurn[];
}

export interface MascotState {
  expression: MascotExpression;
  speaking: boolean;
}

const TURN_EXPRESSIONS: ReadonlySet<string> = new Set(["speaking", "laughing", "thoughtful"]);
const MASCOT_IDS: ReadonlySet<string> = new Set(MASCOTS.map((m) => m.id));

/** The timeline from its JSON, or a thrown Error naming the first thing wrong with it. */
export function parseTimeline(json: unknown): PodcastTimeline {
  const t = json as Partial<PodcastTimeline> & Record<string, unknown>;
  if (!t || typeof t !== "object") throw new Error("timeline is not an object");
  if (t.version !== 1) throw new Error(`timeline version ${String(t.version)} is not 1`);
  if (typeof t.audio !== "string" || !t.audio) throw new Error("timeline names no audio");
  if (typeof t.durationMs !== "number") throw new Error("timeline has no durationMs");
  if (!t.speakers || typeof t.speakers !== "object") throw new Error("timeline has no speakers");
  if (!Array.isArray(t.turns)) throw new Error("timeline has no turns");

  const speakers = t.speakers as PodcastTimeline["speakers"];
  for (const id of Object.keys(speakers)) {
    if (!MASCOT_IDS.has(id)) throw new Error(`unknown speaker ${id}`);
  }
  let lastEnd = 0;
  const turns = (t.turns as unknown[]).map((raw, i) => {
    const turn = raw as Partial<PodcastTurn>;
    if (typeof turn.speaker !== "string" || !(turn.speaker in speakers)) throw new Error(`turn ${i}: unknown speaker ${String(turn.speaker)}`);
    if (typeof turn.expression !== "string" || !TURN_EXPRESSIONS.has(turn.expression)) throw new Error(`turn ${i}: unknown expression ${String(turn.expression)}`);
    if (typeof turn.fromMs !== "number" || typeof turn.toMs !== "number" || turn.toMs <= turn.fromMs) throw new Error(`turn ${i}: bad times`);
    if (turn.fromMs < lastEnd) throw new Error(`turn ${i}: overlaps the turn before it`);
    lastEnd = turn.toMs;
    return {
      speaker: turn.speaker as MascotId,
      fromMs: turn.fromMs,
      toMs: turn.toMs,
      expression: turn.expression as PodcastTurn["expression"],
      text: typeof turn.text === "string" ? turn.text : "",
    };
  });

  return {
    version: 1,
    audio: t.audio,
    ...(typeof t.title === "string" && t.title.trim() ? { title: t.title.trim() } : {}),
    ...(typeof t.caption === "string" && t.caption.trim() ? { caption: t.caption.trim() } : {}),
    durationMs: t.durationMs,
    language: typeof t.language === "string" ? t.language : "",
    speakers,
    turns,
  };
}

/** The turn under a moment of the recording, or null in a pause. */
export function turnAt(timeline: PodcastTimeline, ms: number): PodcastTurn | null {
  for (const turn of timeline.turns) {
    if (ms < turn.fromMs) return null;
    if (ms < turn.toMs) return turn;
  }
  return null;
}

/**
 * What each mascot shows at a moment, in cast order: the speaker its turn's expression, every
 * other mascot listening. A one-voice episode names one speaker, so the other mascot is absent.
 */
export function mascotStates(timeline: PodcastTimeline, ms: number): Partial<Record<MascotId, MascotState>> {
  const turn = turnAt(timeline, ms);
  const states: Partial<Record<MascotId, MascotState>> = {};
  for (const mascot of MASCOTS) {
    if (!(mascot.id in timeline.speakers)) continue;
    const speaking = turn?.speaker === mascot.id;
    states[mascot.id] = { expression: speaking && turn ? turn.expression : "listening", speaking };
  }
  return states;
}

/**
 * Where an episode's files are: its timeline, and the folder its `audio` is in. The episode is
 * a path under `/podcasts/` with no extension or version, e.g. `articles/nooreimaan/naskh/naskh`
 * (every recording about an essay sits in a folder named after the essay's slug), and
 * the version picks the released timeline, `naskh.timeline.v1.json`. Released files are served
 * under a one-year immutable cache header and never change, so a corrected timeline is the next
 * version, and whatever names an episode has to name its version too.
 */
export function episodeUrls(episode: string, version: number, origin: string = PODCAST_AUDIO_ORIGIN): { timeline: string; folder: string } {
  if (!/^[\w-]+(\/[\w-]+)*$/.test(episode)) throw new Error(`not an episode path: ${episode}`);
  if (!Number.isInteger(version) || version < 1) throw new Error(`not a timeline version: ${version}`);
  const base = `${origin.replace(/\/$/, "")}/podcasts/`;
  const folder = episode.includes("/") ? `${base}${episode.slice(0, episode.lastIndexOf("/") + 1)}` : base;
  return { timeline: `${base}${episode}.timeline.v${version}.json`, folder };
}

/** A recording's length as a clock reads it: "1:37", "19:48", "1:02:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * Where a released file under `/podcasts/` is served from, by its path there: a reflection's
 * thumbnail, `images/zoya-talking.v1.webp`, is shared art in `/podcasts/images/`, versioned because
 * the bucket serves it as immutable, so recordings drawn alike reuse one cached file.
 */
export function podcastFileUrl(path: string, origin: string = PODCAST_AUDIO_ORIGIN): string {
  if (!/^[\w-]+(\/[\w-]+)*(\.[\w-]+)+$/.test(path)) throw new Error(`not a released file under /podcasts/: ${path}`);
  return `${origin.replace(/\/$/, "")}/podcasts/${path}`;
}

/**
 * The episode and version an essay reflection's `url` names, for `episodeUrls`/`useEpisode`:
 * `articles/nooreimaan/naskh/naskh.timeline.v1.json` is `{ episode: "articles/nooreimaan/naskh/naskh",
 * version: 1 }`. The same pattern the API checks the essays against at startup.
 */
export function reflectionEpisode(url: string): { episode: string; version: number } {
  const match = /^((?:[a-z0-9_-]+\/)*[a-z0-9_-]+)\.timeline\.v([1-9][0-9]*)\.json$/.exec(url);
  if (!match) throw new Error(`not a released timeline: ${url}`);
  return { episode: match[1], version: Number(match[2]) };
}
