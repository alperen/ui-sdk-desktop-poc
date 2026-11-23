# ui-sdk

Follow the [directory conventions](README.md#directory-conventions) when adding or moving files under `src/ui-sdk/` or `src/plain-react/`.

Before using ui-sdk, follow the ui-sdk skill if it is installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`.

To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and read `node_modules/@ui-sdk/react/docs/rendering.md`.

# Code readability

Separate logical groups of statements with a blank line. Prefer early returns to reduce nesting, and name intermediate values when they clarify an expression.

# Verification

For Lefthook configuration, installation, or Stop-hook changes, read `docs/lefthook.md`. Run `pnpm validate` for the automated lint, type, test, and build gate.

For browser validation, use the repo's `.agents/skills/agent-browser/SKILL.md` and load `agent-browser skills get core`.

Create a worktree-scoped session name with `agent-browser session id --scope worktree --prefix desktop-validation` and pass the returned name with `--session <name>` on every browser command, including `close`. This isolates validation from the default session and other browser operations. Concurrent validation tasks in the same worktree must use distinct suffixes on that name. Use agent-browser's own browser rather than attaching with `--auto-connect` or `--cdp`.

Use absolute paths for screenshots and other artifacts: relative paths can resolve against the daemon's working directory rather than the current terminal directory.

Launch validation browsers with `agent-browser --session "$session" --idle-timeout 1m open "$url"` so an abandoned headless session closes after one minute of inactivity. Still close the named session explicitly when validation finishes.

After application code changes, run `pnpm test` and perform exploratory agent-browser testing against the running app. Exercise the intended flows and try to break the latest changes with boundary values, cancellation, repeated actions, and interactions with existing features. Use real keyboard and pointer actions; typing checks must not rely only on `fill()`. For keyboard shortcuts, check initial page-load focus and clicks outside the desktop as well as focused items and inputs.

Before declaring an application change complete, create an independent QA subagent to explore and try to break the latest changes using its own uniquely named agent-browser session. Investigate its findings and repeat affected checks after fixes. Report automated results, exploratory results, the QA subagent's findings, and anything unverified; written tests alone are insufficient.
