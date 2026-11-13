import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// A temp runs dir holding the given files; runs/ itself is read-only.
function runsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (o: object) => JSON.stringify(o);

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('is null for a night with no file, or a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../x')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as no rows', () => {
    const dir = runsDir({ '2026-11-01.jsonl': '' });
    expect(readNight(dir, '2026-11-01')).toEqual({ rows: [], badLines: 0 });
  });

  it('counts retries, keeps owner null, skips blank lines and counts bad ones', () => {
    const dir = runsDir({
      '2026-11-02.jsonl': [
        line({ at: '2026-11-02T01:00:00+01:00', job: 'b', status: 'retry', owner: 'rook', error: 'e1' }),
        '',
        line({ at: '2026-11-02T01:01:00+01:00', job: 'b', status: 'retry', owner: 'rook', error: 'e2' }),
        line({ at: '2026-11-02T01:02:00+01:00', job: 'b', status: 'ok', owner: null }),
        line({ at: '2026-11-02T02:00:00+01:00', job: 'a', status: 'fail', owner: null }),
        line({ at: '2026-11-02T03:00:00+01:00', job: 'a', status: 'done', owner: 'x' }),
        line({ at: '2026-11-02T03:00:00+01:00', job: 'a', status: 'ok' }),
        line({ at: 1, job: 'a', status: 'ok', owner: 'x' }),
        '{not json',
        '   ',
        '',
      ].join('\n'),
    });
    expect(readNight(dir, '2026-11-02')).toEqual({
      badLines: 4,
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: null,
          firstAt: '2026-11-02T02:00:00+01:00',
          lastAt: '2026-11-02T02:00:00+01:00',
        },
        {
          job: 'b',
          owner: null,
          runs: 3,
          retries: 2,
          lastStatus: 'ok',
          lastError: 'e2',
          firstAt: '2026-11-02T01:00:00+01:00',
          lastAt: '2026-11-02T01:02:00+01:00',
        },
      ],
    });
  });
});
