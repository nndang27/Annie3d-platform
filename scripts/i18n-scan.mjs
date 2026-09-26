// Finds user-visible text written directly in the UI code instead of going through t().
// Used by the i18n guard test (packages/i18n) and on its own: `node scripts/i18n-scan.mjs`.
//
// It parses TSX/TS with the TypeScript compiler and reports:
// - JSX text with a letter in it (`<p>Saved</p>`);
// - string literals and template literals in JSX expressions (`{'Saved'}`, `{ok ? 'Yes' : 'No'}`);
// - literal values of text attributes (`aria-label`, `title`, `placeholder`, `alt`, `label`);
// - the first argument of text sinks: toast(), confirm(), alert(), prompt().
// A line can opt out with `// i18n-ignore` (brand names, sample content, developer tools).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SCAN_DIRS = ['apps/web/src/client', 'packages/ui/src'];
const TEXT_ATTRS = new Set([
  'aria-label',
  'title',
  'placeholder',
  'alt',
  'label',
  'aria-description',
  'aria-roledescription',
]);
const SINKS = new Set(['toast', 'confirm', 'alert', 'prompt']);
const LETTER = /\p{L}{2,}/u;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(tsx|ts)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts'))
      out.push(p);
  }
  return out;
}

const textOf = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    ? n.text
    : ts.isTemplateExpression(n)
      ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ')
      : null;

/** String literals reachable as the value of an expression (through ?:, ||, ??, parentheses). */
function literals(n) {
  if (!n) return [];
  const t = textOf(n);
  if (t !== null) return [[n, t]];
  if (ts.isConditionalExpression(n)) return [...literals(n.whenTrue), ...literals(n.whenFalse)];
  if (ts.isParenthesizedExpression(n)) return literals(n.expression);
  if (
    ts.isBinaryExpression(n) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(
      n.operatorToken.kind,
    )
  )
    return [...literals(n.left), ...literals(n.right)];
  return [];
}

export function scanFile(path) {
  const src = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(
    path,
    src,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines = src.split('\n');
  const found = [];
  const add = (node, text, kind) => {
    if (!LETTER.test(text)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line;
    if (/i18n-ignore/.test(lines[line]) || /i18n-ignore/.test(lines[line - 1] ?? '')) return;
    found.push({ file: relative(ROOT, path), line: line + 1, kind, text: text.trim().replace(/\s+/g, ' ') });
  };
  const visit = (n) => {
    if (ts.isJsxText(n)) add(n, n.text, 'jsx-text');
    else if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent))
      for (const [node, t] of literals(n.expression)) add(node, t, 'jsx-expr');
    else if (ts.isJsxAttribute(n) && TEXT_ATTRS.has(n.name.getText()) && n.initializer) {
      const init = n.initializer;
      const vals = ts.isStringLiteral(init)
        ? [[init, init.text]]
        : ts.isJsxExpression(init)
          ? literals(init.expression)
          : [];
      for (const [node, t] of vals) add(node, t, `attr:${n.name.getText()}`);
    } else if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : '';
      if (SINKS.has(name)) for (const [node, t] of literals(n.arguments[0])) add(node, t, `call:${name}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

export function scan(dirs = SCAN_DIRS) {
  return dirs.flatMap((d) => files(join(ROOT, d))).flatMap(scanFile);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = scan(process.argv.slice(2).length ? process.argv.slice(2) : SCAN_DIRS);
  const byFile = new Map();
  for (const f of all) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  for (const [file, list] of byFile) {
    console.log(`\n${file} (${list.length})`);
    for (const f of list) console.log(`  ${f.line} ${f.kind}: ${f.text.slice(0, 90)}`);
  }
  console.log(`\n${all.length} hard-coded strings in ${byFile.size} files`);
}
