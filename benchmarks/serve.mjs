import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, loadEnv, preview } from "vite";
import { compilerAudit, compilerVersion } from "./compiler.mjs";

const directory = mkdtempSync(path.join(tmpdir(), "desktop-render-"));
const probes = readFileSync(new URL("./probes.js", import.meta.url), "utf8");
const compilerEnabled = loadEnv("benchmark", ".", "DESKTOP_REACT_COMPILER").DESKTOP_REACT_COMPILER === "1";

function replaceOnce(source, from, to) {
  assert.equal(source.split(from).length, 2, `Benchmark hook changed: ${from}`);
  return source.replace(from, () => to);
}

function instrument(kind) {
  const diagnostic = kind === "detail";
  const profile = kind !== "regular";
  const touched = new Set();

  return {
    name: "desktop-benchmark",
    enforce: "pre",
    transformIndexHtml() {
      const tags = profile
        ? [{ tag: "script", children: probes, injectTo: "head-prepend" }]
        : [];
      tags.push({
        tag: "meta",
        attrs: {
          name: "desktop-react-compiler",
          content: compilerEnabled ? compilerVersion : "off",
        },
      });
      return tags;
    },
    transform: {
      order: "pre",
      handler(code, id) {
        const seed = id.endsWith("/src/ui-sdk/hooks/use-items.ts")
          ? "initialEntries"
          : id.endsWith("/src/plain-react/hooks/use-items.ts")
            ? "seed"
            : null;
        if (seed) {
          touched.add(seed);
          const marker = "export function useItems(";
          return replaceOnce(
            code,
            marker,
            `
          if (new URLSearchParams(location.search).get("size") === "100") {
            for (let i = 1; i <= 96; i++) {
              ${seed}.push({ id: "bench-" + i, name: "Photo " + i + ".jpg", kind: "file", parentId: "photos" });
            }
          }
          ${marker}`,
          );
        }

        if (profile && /\/src\/(?:plain-react|ui-sdk)\/main\.tsx$/.test(id)) {
          touched.add(
            id.includes("/src/plain-react/") ? "react-entry" : "sdk-entry",
          );
          return (
            'import { Profiler } from "react";\n' +
            replaceOnce(
              code,
              "<App />",
              '<Profiler id="desktop" onRender={window.desktopProfile.onRender}><App /></Profiler>',
            )
          );
        }

        if (!diagnostic) return;

        if (
          compilerEnabled &&
          id.endsWith("/react/cjs/react-compiler-runtime.production.js")
        ) {
          touched.add("compiler-cache");
          return replaceOnce(
            code,
            "ReactSharedInternals.H.useMemoCache(size)",
            "window.desktopProfile.useMemoCache(ReactSharedInternals.H, size)",
          );
        }

        // Distinguish the application's components from the SDK primitives with the same names.
        if (/\/src\/(?:plain-react|ui-sdk)\/components\/item\/item\.tsx$/.test(id))
          return code + '\nItem.displayName = "App.Item";';
        if (
          /\/src\/(?:plain-react|ui-sdk)\/components\/window\/window\.tsx$/.test(id)
        )
          return code + '\nWindow.displayName = "App.Window";';

        if (id.endsWith("/react/cjs/react.production.js")) {
          touched.add("hooks");
          code = replaceOnce(
            code,
            "ReactSharedInternals.H.useMemo(create, deps)",
            "window.desktopProfile.useMemo(ReactSharedInternals.H, create, deps)",
          );
          return replaceOnce(
            code,
            "ReactSharedInternals.H.useCallback(callback, deps)",
            "window.desktopProfile.useCallback(ReactSharedInternals.H, callback, deps)",
          );
        }

        if (!id.endsWith("/react-dom/cjs/react-dom-profiling.profiling.js"))
          return;
        touched.add("renderer");

        for (const result of ["nextRenderLanes", "children"]) {
          code = replaceOnce(
            code,
            result + " = Component(props, secondArg);",
            result +
              " = window.desktopProfile.invoke(workInProgress, Component, props, secondArg);",
          );
        }
        for (const fn of ["Component", "shallowEqual"]) {
          code = replaceOnce(
            code,
            fn + "(prevProps, nextProps) &&",
            "window.desktopProfile.compare(" +
              fn +
              ", prevProps, nextProps) &&",
          );
        }

        const callbackEnd =
          "return prevState[0];\n  hook.memoizedState = [callback, deps];";
        return replaceOnce(
          code,
          callbackEnd,
          "{ window.desktopProfile.callback.hits++; return prevState[0]; }\n  hook.memoizedState = [callback, deps];",
        );
      },
    },
    buildEnd(error) {
      if (error) return;
      const expected = ["initialEntries", "seed"];
      if (profile) expected.push("react-entry", "sdk-entry");
      if (diagnostic) expected.push("hooks", "renderer");
      if (diagnostic && compilerEnabled) expected.push("compiler-cache");
      assert.deepEqual([...touched].sort(), expected.sort());
    },
  };
}

for (const [index, kind] of ["time", "detail", "regular"].entries()) {
  const outDir = path.join(directory, kind);
  const profiling = kind !== "regular";
  const port = (compilerEnabled ? 4188 : 4185) + index;
  await build({
    plugins: [
      instrument(kind),
      compilerEnabled && compilerAudit(kind === "detail"),
    ],
    resolve: {
      alias: profiling ? { "react-dom/client": "react-dom/profiling" } : {},
    },
    build: {
      outDir,
      manifest: false,
      minify: kind === "detail" ? false : "esbuild",
    },
    logLevel: "warn",
  });

  await preview({
    build: { outDir },
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    logLevel: "warn",
  });
  console.log(`${kind}: http://127.0.0.1:${port}`);
}
