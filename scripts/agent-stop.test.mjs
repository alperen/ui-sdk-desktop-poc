import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('Stop hook validates changes, reports failures, and avoids retry loops', () => {
  const directory = mkdtempSync(join(tmpdir(), 'desktop-stop-'));

  try {
    writeFileSync(join(directory, 'git'), '#!/bin/sh\nprintf "%s" "$TEST_CHANGES"\n', { mode: 0o755 });
    writeFileSync(join(directory, 'pnpm'), '#!/bin/sh\necho validation-output\nexit "$TEST_STATUS"\n', { mode: 0o755 });

    const run = (input, changes = ' M src/App.tsx', status = '0') => {
      const result = spawnSync(process.execPath, ['scripts/agent-stop.mjs'], {
        input,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          TEST_CHANGES: changes,
          TEST_STATUS: status,
        },
      });

      assert.equal(result.status, 0, result.stderr);

      return JSON.parse(result.stdout);
    };

    const event = JSON.stringify({ hook_event_name: 'Stop' });

    assert.deepEqual(run(event), {});
    assert.deepEqual(run(event, '', '1'), {});

    const failure = run(event, ' M src/App.tsx', '1');

    assert.equal(failure.decision, 'block');
    assert.match(failure.reason, /validation-output/);
    assert.equal(run('invalid-json').decision, 'block');
    assert.equal(run('{}').decision, 'block');
    assert.match(run(JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }), undefined, '1').systemMessage, /unverified/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
