import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : e.name.endsWith(".tsx")
        ? [join(dir, e.name)]
        : [],
  );
}
test("patient view trees never render raw text outside a Text component", () => {
  const problems: string[] = [];
  for (const file of files(
    fileURLToPath(new URL("../src/features", import.meta.url)),
  )) {
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) {
        const parent = node.parent;
        if (ts.isJsxElement(parent)) {
          const tag = parent.openingElement.tagName.getText(ast);
          const raw = node.getFullText(ast);
          if (
            !["Text", "NativeText"].includes(tag) &&
            (raw.trim().length > 0 || (!raw.includes("\n") && raw.length > 0))
          )
            problems.push(
              `${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1} raw text under ${tag}`,
            );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.deepEqual(problems, []);
});
