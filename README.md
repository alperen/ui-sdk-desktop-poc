# UI SDK Desktop POC

This project implements the same desktop file browser twice in React and TypeScript. One version uses UI SDK primitives for selection, editing, and window interactions. The other implements those behaviors in plain React. Both support keyboard navigation, multi-selection, inline renaming, and list, grid, and column views.

## Run locally

The project uses Node.js 24 and pnpm 12.4.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

| Implementation | Development path | Source |
| --- | --- | --- |
| UI SDK | `/` or `/src/ui-sdk/` | [UI SDK source](src/ui-sdk/) |
| Plain React | `/src/plain-react/` | [Plain React source](src/plain-react/) |

## Checks and builds

| Command | Purpose |
| --- | --- |
| `pnpm validate` | Run linting, type checks, tests, and the production build. |
| `pnpm test` | Run the hook test and Chromium tests for both implementations. |
| `pnpm build` | Type-check and build both applications into `dist/`. |
| `pnpm preview` | Serve the production build locally. |
| `pnpm lint` / `pnpm lint:fix` | Report lint issues or apply available fixes. |
| `pnpm format:check` / `pnpm format` | Check formatting or format files. |

## Benchmarks

The benchmark reports compare rendering, memoization, and memory use across five runs. [Performance report](benchmarks/index.html) · [Interactive compiler comparison](benchmarks/compiler-results/report.html)

## Directory conventions

Both implementations use kebab-case for file and directory names. Match each component filename to its exported name, for example `FileListView` in `file-list-view.tsx`. Biome checks JavaScript and TypeScript filenames during linting.

| Location | Contents |
| --- | --- |
| Implementation root | Application entry points, `app.tsx`, agent registration, and global styles. |
| `components/<component>/` | A React component and its visual parts, such as `components/window/view-layout-control.tsx`. |
| `primitives/<behavior>/` | Interaction behavior, its controller, and related React parts such as `file-list-parts.tsx`. |
| `contexts/` | A React context, its provider, and its access hook together in a `*-context` file. |
| `hooks/` | Application state and operations, such as `use-rename-items.ts`. |
| `models/` | Data types shared across layers, such as `file-entry.ts`. |
| `tests/` | Behavior tests in `*.test.tsx` and compile-time type checks in `*.types.tsx`. |
