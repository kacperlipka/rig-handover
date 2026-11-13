import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Entry = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isStatus(v: unknown): v is RunStatus {
  return v === 'ok' || v === 'retry' || v === 'fail';
}

// One line of the log -> an entry, or null if it isn't a valid one.
function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (!('owner' in o) || (owner !== null && typeof owner !== 'string')) return null;
  return { at, job, status, owner, error: typeof error === 'string' ? error : null };
}

// File text, or null if there is no such file. Other I/O errors are thrown.
function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (e === null) {
      badLines++;
      continue;
    }
    const row = byJob.get(e.job);
    if (row === undefined) {
      byJob.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error,
        firstAt: e.at,
        lastAt: e.at,
      });
    } else {
      row.owner = e.owner;
      row.runs++;
      if (e.status === 'retry') row.retries++;
      row.lastStatus = e.status;
      if (e.error !== null) row.lastError = e.error;
      row.lastAt = e.at;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
