# Lefthook

This repo uses Lefthook 2.2.2 for pre-commit tests and agent Stop hooks.

After installing dependencies, run `pnpm exec lefthook install` to install Git hooks and generate `.codex/hooks.json` and `.claude/settings.json`. The `prepare` script also installs hooks. Restart an existing agent session after installation and confirm its project hooks are enabled.

`lefthook.yml` is the source of truth. Use `pnpm validate` to run lint, type checking, tests, and the production build. Validation does not auto-fix files. Pre-commit runs tests.

The Stop hook reads its event from stdin and emits only JSON. When the working tree has changes, it runs validation and asks the agent to continue if validation fails. It allows the automatic retry to finish with an explicit unverified warning to prevent an endless loop. This is a feedback gate, not a guarantee that validation passed. Validation times out after eight minutes. Tests are in `scripts/agent-stop.test.mjs`.

Browser validation remains a separate step described in `AGENTS.md`. The one-minute agent-browser idle timeout is browser cleanup; Lefthook's Stop hook runs repository checks and does not close browser sessions.

Official references:

- [Lefthook installation](https://lefthook.dev/usage/commands/install/)
- [Lefthook AI hooks](https://lefthook.dev/configuration/ai/)
- [Codex hook discovery and Stop events](https://developers.openai.com/codex/hooks)

Consult these references when changing hooks; the AI integration is beta. Keep hook mappings in `lefthook.yml` and regenerate provider files with `pnpm exec lefthook install`.
