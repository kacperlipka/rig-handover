import type { DigestRow, RunStatus } from './types.js';

export type StatusCounts = {
  ok: number;
  retry: number;
  fail: number;
};

/**
 * Count jobs by their lastStatus. Pure function, no side effects.
 */
export function countByStatus(rows: DigestRow[]): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) {
    counts[row.lastStatus]++;
  }
  return counts;
}
