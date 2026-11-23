import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
export const compilerVersion =
  require("babel-plugin-react-compiler/package.json").version;

// Identify cache variables by their React runtime import, including renamed bindings.
function observeCacheGuards({ types: t }) {
  return {
    name: "measure-generated-react-cache-guards",
    post(file) {
      file.path.scope.crawl();
      const caches = new Set();
      file.path.traverse({
        VariableDeclarator(p) {
          const { id, init } = p.node;
          if (
            !t.isIdentifier(id) ||
            !t.isCallExpression(init) ||
            !t.isIdentifier(init.callee)
          )
            return;
          const runtime = p.scope.getBinding(init.callee.name)?.path;
          if (
            runtime?.isImportSpecifier() &&
            runtime.node.imported.name === "c" &&
            runtime.parent.source?.value === "react/compiler-runtime"
          ) {
            const binding = p.scope.getBinding(id.name);
            assert.ok(binding, "Unbound React compiler cache");
            caches.add(binding.identifier);
          }
        },
      });

      let sites = 0;
      file.path.traverse({
        IfStatement(p) {
          const body = p.node.consequent;
          if (!t.isBlockStatement(body)) return;
          const storesCache = body.body.some((statement) => {
            if (
              !t.isExpressionStatement(statement) ||
              !t.isAssignmentExpression(statement.expression)
            )
              return false;
            const left = statement.expression.left;
            return (
              t.isMemberExpression(left) &&
              t.isIdentifier(left.object) &&
              caches.has(p.scope.getBinding(left.object.name)?.identifier)
            );
          });
          if (!storesCache) return;

          const start = t.callExpression(
            t.memberExpression(
              t.identifier("performance"),
              t.identifier("now"),
            ),
            [],
          );
          const probe = t.memberExpression(
            t.memberExpression(
              t.identifier("window"),
              t.identifier("desktopProfile"),
            ),
            t.identifier("cacheGuard"),
          );
          p.node.test = t.callExpression(probe, [start, p.node.test]);
          sites++;
        },
      });
      this.opts.record(file.opts.filename, sites);
    },
  };
}

export function compilerAudit(diagnostic) {
  const functions = [];
  const guards = {};
  return {
    name: "verify-desktop-compiler",
    api: {
      reactBabel(options) {
        const compiler = options.plugins.find(
          (p) => Array.isArray(p) && p[0] === "babel-plugin-react-compiler",
        );
        if (!compiler) return;
        compiler[1].logger = {
          logEvent(filename, event) {
            if (
              ![
                "CompileSuccess",
                "CompileError",
                "CompileSkip",
                "PipelineError",
              ].includes(event.kind)
            )
              return;
            const file = path.relative(process.cwd(), filename);
            const row = {
              file,
              line: event.fnLoc?.start.line,
              kind: event.kind,
            };
            if (event.kind === "CompileSuccess")
              functions.push({
                ...row,
                name: event.fnName,
                blocks: event.memoBlocks,
                slots: event.memoSlots,
              });
            else
              functions.push({
                ...row,
                reason: event.detail?.reason ?? event.reason ?? event.data,
              });
          },
        };
        if (diagnostic)
          options.plugins.push([
            observeCacheGuards,
            {
              record(file, count) {
                guards[path.relative(process.cwd(), file)] = count;
              },
            },
          ]);
      },
    },
    generateBundle(_, bundle) {
      const modules = Object.values(bundle).flatMap((chunk) =>
        Object.keys(chunk.modules ?? {}),
      );
      assert.ok(
        modules.some((id) =>
          id.endsWith("/react-compiler-runtime.production.js"),
        ),
        "Compiler runtime missing from production output",
      );
      for (const prefix of ["src/ui-sdk/", "src/plain-react/"]) {
        const compiled = functions.filter(
          (f) => f.file.startsWith(prefix) && f.blocks > 0,
        );
        assert.ok(compiled.length > 0, "No compiled components in " + prefix);
        if (diagnostic) {
          for (const file of new Set(compiled.map((f) => f.file))) {
            const blocks = compiled
              .filter((f) => f.file === file)
              .reduce((n, f) => n + f.blocks, 0);
            assert.equal(
              guards[file],
              blocks,
              "Generated cache guard coverage: " + file,
            );
          }
        }
      }
      functions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
      this.emitFile({
        type: "asset",
        fileName: "desktop-compiler.json",
        source: JSON.stringify({
          version: compilerVersion,
          target: "19",
          mode: "infer",
          functions,
          guards,
        }),
      });
    },
  };
}
