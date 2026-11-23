import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let response = {};

try {
  const event = JSON.parse(readFileSync(0, 'utf8'));

  if (event?.hook_event_name !== 'Stop') {
    throw new Error('Expected a Stop hook event.');
  }

  if (event.stop_hook_active === true) {
    response = {
      systemMessage:
        'Automatic Stop retry finished. Validation is unverified until ' +
        'pnpm validate succeeds; report any remaining failures.',
    };
  } else {
    const changes = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    });

    if (changes.trim()) {
      const result = spawnSync(
        'pnpm',
        ['exec', 'lefthook', 'run', 'validate', '--no-tty', '--colors', 'off'],
        { encoding: 'utf8', timeout: 480_000, maxBuffer: 8 * 1024 * 1024 },
      );

      if (result.error || result.status !== 0) {
        const output = [result.error?.message, result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n');

        response = {
          decision: 'block',
          reason:
            'Repository validation failed. Fix the failure, then run ' +
            `pnpm validate again before claiming completion.\n${output.slice(-6000)}`,
        };
      }
    }
  }
} catch (error) {
  response = {
    decision: 'block',
    reason: `Could not validate the repository: ${error.message}`,
  };
}

console.log(JSON.stringify(response));
