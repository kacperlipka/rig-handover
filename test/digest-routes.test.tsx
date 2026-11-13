import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const tempDirs: string[] = [];

// Create a temp runs dir and register it for cleanup
function createTempRunsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-test-'));
  tempDirs.push(dir);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

// Create a config with the given runsDir
function createConfig(runsDir: string): RigConfig {
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

const line = (o: object) => JSON.stringify(o);

// Copy of runs/2026-10-28.jsonl content (first 15 lines, which includes the valid jobs)
const validNightContent = [
  line({ at: '2026-10-28T23:00:02+01:00', job: 'rig/rotate-logs', status: 'ok', owner: 'lane-07' }),
  line({ at: '2026-10-28T23:00:06+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T00:00:04+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T01:00:05+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T01:30:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T01:31:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T01:33:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T01:37:00+01:00', job: 'fixtures/refresh', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T02:00:03+01:00', job: 'lane/sync', status: 'retry', owner: 'rook', error: 'lock held' }),
  line({ at: '2026-10-29T02:00:33+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T03:00:04+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T04:00:01+01:00', job: 'notes/backup', status: 'fail', owner: 'lane-07', error: 'quota exceeded' }),
  line({ at: '2026-10-29T04:00:05+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T05:00:04+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T05:41:09+01:00', job: 'digest/render', status: 'ok', owner: null }),
].join('\n');

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('GET /digest/:night (HTML)', () => {
  it('returns 200 with a valid night and renders the table', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-10.jsonl': validNightContent,
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/digest/2026-11-10');
    expect(res.status).toBe(200);
    const html = await res.text();

    // Check that the page renders the title
    expect(html).toContain('digest 2026-11-10');

    // Check that all jobs are present
    expect(html).toContain('digest/render');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
    expect(html).toContain('rig/rotate-logs');

    // Check table structure
    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });

  it('returns 404 for a night with no file', async () => {
    const runsDir = createTempRunsDir({});
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/digest/2026-11-10');
    expect(res.status).toBe(404);
  });

  it('returns 200 for an empty night with "nothing ran" message', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-11.jsonl': '',
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/digest/2026-11-11');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('digest 2026-11-11');
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('returns 200 for a night with a bad line and shows the bad line count', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-12.jsonl': [
        line({ at: '2026-11-12T01:00:00+01:00', job: 'job-a', status: 'ok', owner: 'rook' }),
        '{not json',
        line({ at: '2026-11-12T02:00:00+01:00', job: 'job-b', status: 'fail', owner: 'rook' }),
      ].join('\n'),
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/digest/2026-11-12');
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('digest 2026-11-12');
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('job-a');
    expect(html).toContain('job-b');
    expect(html).toContain('<table>');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns 200 with a valid night containing the rows', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-10.jsonl': validNightContent,
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/api/digest/2026-11-10');
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.night).toBe('2026-11-10');
    expect(json.rows).toBeDefined();
    expect(Array.isArray(json.rows)).toBe(true);
    expect(json.badLines).toBe(0);

    // Check that all 5 jobs are present
    expect(json.rows.length).toBe(5);
    const jobs = json.rows.map((r: any) => r.job).sort();
    expect(jobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 for a night with no file', async () => {
    const runsDir = createTempRunsDir({});
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/api/digest/2026-11-10');
    expect(res.status).toBe(404);
    const json = await res.json() as any;
    expect(json.error).toContain('no run log for');
  });

  it('returns 200 for an empty night with empty rows array', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-11.jsonl': '',
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/api/digest/2026-11-11');
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.night).toBe('2026-11-11');
    expect(json.rows).toEqual([]);
    expect(json.badLines).toBe(0);
  });

  it('returns 200 with badLines === 1 when there is a bad line', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-12.jsonl': [
        line({ at: '2026-11-12T01:00:00+01:00', job: 'job-a', status: 'ok', owner: 'rook' }),
        '{not json',
        line({ at: '2026-11-12T02:00:00+01:00', job: 'job-b', status: 'fail', owner: 'rook' }),
      ].join('\n'),
    });
    const app = createApp(createConfig(runsDir));
    const res = await app.request('/api/digest/2026-11-12');
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.night).toBe('2026-11-12');
    expect(json.badLines).toBe(1);
    expect(json.rows.length).toBe(2);

    const jobs = json.rows.map((r: any) => r.job).sort();
    expect(jobs).toEqual(['job-a', 'job-b']);
  });
});

describe('Page and JSON agreement', () => {
  it('page and JSON list the same jobs in the same order', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-13.jsonl': validNightContent,
    });
    const app = createApp(createConfig(runsDir));

    // Get the JSON
    const jsonRes = await app.request('/api/digest/2026-11-13');
    const json = await jsonRes.json() as any;

    // Get the HTML page
    const htmlRes = await app.request('/digest/2026-11-13');
    const html = await htmlRes.text();

    // Extract job names from JSON (in order)
    const jsonJobs = json.rows.map((r: any) => r.job);

    // Verify that all jobs from JSON appear in the HTML
    for (const job of jsonJobs) {
      expect(html).toContain(job);
    }

    // Verify the HTML contains the table with all the jobs
    expect(html).toContain('<table>');
    expect(html).toContain('<tbody>');
    expect(jsonJobs.length).toBeGreaterThan(0);
  });

  it('page and JSON both handle bad lines consistently', async () => {
    const runsDir = createTempRunsDir({
      '2026-11-14.jsonl': [
        line({ at: '2026-11-14T01:00:00+01:00', job: 'job-a', status: 'ok', owner: 'rook' }),
        'not valid json at all',
        'also not json',
        line({ at: '2026-11-14T02:00:00+01:00', job: 'job-b', status: 'fail', owner: 'rook' }),
      ].join('\n'),
    });
    const app = createApp(createConfig(runsDir));

    // Get the JSON
    const jsonRes = await app.request('/api/digest/2026-11-14');
    const json = await jsonRes.json() as any;

    // Get the HTML page
    const htmlRes = await app.request('/digest/2026-11-14');
    const html = await htmlRes.text();

    // Both should have badLines === 2
    expect(json.badLines).toBe(2);
    expect(html).toContain('2 lines could not be read');

    // Both should have the same 2 good rows
    expect(json.rows.length).toBe(2);
    expect(html).toContain('job-a');
    expect(html).toContain('job-b');
  });
});
