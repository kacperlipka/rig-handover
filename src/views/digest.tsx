import type { NightDigest } from '../digest/types.js';

function renderMissing(value: string | null | undefined): string {
  return value === null || value === undefined ? '—' : value;
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  return (
    <>
      <h1>digest {night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          {digest.badLines} line{digest.badLines === 1 ? '' : 's'} could not be read
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const shouldWarn = row.retries >= 3 || row.lastStatus === 'fail';
              return (
                <tr class={shouldWarn ? 'warn' : ''}>
                  <td>{row.job}</td>
                  <td>{renderMissing(row.owner)}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{renderMissing(row.lastError)}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
