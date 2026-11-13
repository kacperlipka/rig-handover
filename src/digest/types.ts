// The digest contract: what reading one night's run log yields. Implementation is issue #2;
// the page, the JSON and the board link (plan § 2) all build against these types only.

/** Status of one line in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from all of its lines. Exactly one row per distinct `job`. */
export type DigestRow = {
  /** The line's `job`, verbatim (e.g. `lane/sync`). */
  job: string;
  /** `owner` of the job's last line. `null` is kept as a row; views render it as `—`. */
  owner: string | null;
  /** Number of lines for this job (every attempt counts, retries included). */
  runs: number;
  /** Number of this job's lines with status `retry`. */
  retries: number;
  /** Status of the job's last line, in file order. */
  lastStatus: RunStatus;
  /**
   * `error` of the job's most recent line that had one, even if a later line is `ok`
   * (so a job that retried then recovered still shows why). `null` if no line had one.
   */
  lastError: string | null;
  /** `at` of the job's first line, the log's string verbatim, offset kept. Never UTC. */
  firstAt: string;
  /** `at` of the job's last line, the log's string verbatim, offset kept. Never UTC. */
  lastAt: string;
};

/**
 * A night that has a file. An empty (or all-bad) file is `{ rows: [], badLines: n }`:
 * the page renders "nothing ran", not 404.
 */
export type NightDigest = {
  /** One row per job, sorted by `job` (plain string order). The reader sorts, so page and JSON agree. */
  rows: DigestRow[];
  /**
   * Non-blank lines that are not a valid entry (bad JSON; missing or ill-typed `at`, `job`,
   * `status` or `owner`; unknown status). Counted, never thrown; they add no row.
   */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`; `night` is `YYYY-MM-DD`.
 * Returns `null` when there is no file for that night (or `night` isn't `YYYY-MM-DD`):
 * the routes answer 404. Never throws for content; only for I/O errors other than "not found".
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
