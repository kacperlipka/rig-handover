import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countByStatus } from '../src/digest/count.js';
import type { DigestRow } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk with counts', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
    expect(html).toContain('/digest/2026-10-28');
    expect(html).toContain('ok:');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});

describe('countByStatus', () => {
  it('counts jobs by their lastStatus', () => {
    const rows: DigestRow[] = [
      {
        job: 'job1',
        owner: 'owner1',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T00:00:00+01:00',
        lastAt: '2026-10-28T00:00:00+01:00',
      },
      {
        job: 'job2',
        owner: 'owner2',
        runs: 2,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'error',
        firstAt: '2026-10-28T00:00:00+01:00',
        lastAt: '2026-10-28T00:01:00+01:00',
      },
      {
        job: 'job3',
        owner: 'owner3',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'error',
        firstAt: '2026-10-28T00:00:00+01:00',
        lastAt: '2026-10-28T00:00:00+01:00',
      },
      {
        job: 'job4',
        owner: 'owner4',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T00:00:00+01:00',
        lastAt: '2026-10-28T00:00:00+01:00',
      },
    ];

    const counts = countByStatus(rows);
    expect(counts).toEqual({ ok: 2, retry: 1, fail: 1 });
  });
});
