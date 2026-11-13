import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('generated documentation is identical with reversed directory enumeration', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ppp-site-order-'));
  const preload = path.join(directory, 'reverse-docs-list.mjs');
  try {
    await fs.writeFile(preload, `
      import fs from 'node:fs/promises';
      import path from 'node:path';
      const original = fs.readdir;
      fs.readdir = async (...args) => {
        const entries = await original(...args);
        return path.resolve(args[0]) === ${JSON.stringify(path.join(root, 'docs'))} ? entries.reverse() : entries;
      };
    `);
    const run = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/build-docs-site.mjs', '--check'], {
      cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(run.status, 0, (run.stdout ?? '') + (run.stderr ?? '') + (run.error?.message ?? ''));
  } finally {
    // Only this one owned file and its now-empty directory; no recursive delete.
    await fs.unlink(preload);
    await fs.rmdir(directory);
  }
});
