import assert from "node:assert/strict";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const allowed = new Set(["react", "react-dom", "react-dom/client"]);

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && entry.name === "tests") return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sources(file)
      : /\.(tsx?|css)$/.test(entry.name)
        ? [file]
        : [];
  });
}

test("plain-react runtime imports are React or local files inside plain-react", () => {
  const files = sources(root);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (file.endsWith(".css")) {
      assert.doesNotMatch(source, /@import|url\s*\(/, file);
      continue;
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function check(specifier) {
      if (allowed.has(specifier)) return;
      assert.ok(
        specifier.startsWith("."),
        `${file}: external dependency ${specifier}`,
      );
      const base = path.resolve(path.dirname(file), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.css`].find(
        (candidate) => files.includes(candidate),
      );
      assert.ok(resolved, `${file}: unresolved import ${specifier}`);
      assert.ok(
        realpathSync(resolved).startsWith(realpathSync(root) + path.sep),
        `${file}: import escapes plain-react`,
      );
    }
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      ) {
        assert.ok(ts.isStringLiteral(node.moduleSpecifier));
        check(node.moduleSpecifier.text);
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText(ast) === "require")
      ) {
        assert.ok(
          node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]),
          `${file}: dynamic dependency cannot be audited`,
        );
        check(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
