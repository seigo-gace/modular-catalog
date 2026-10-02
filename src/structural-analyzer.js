import path from 'node:path';
import { Lang, parseAsync } from '@ast-grep/napi';
import { CatalogError } from './catalog.js';

const LANGUAGE_BY_EXTENSION = Object.freeze({
  '.js': Lang.JavaScript,
  '.mjs': Lang.JavaScript,
  '.cjs': Lang.JavaScript,
  '.ts': Lang.TypeScript,
  '.tsx': Lang.Tsx,
  '.jsx': Lang.Tsx
});

function bounded(value, maxLength = 1200) {
  const text = String(value ?? '');
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function stripQuoted(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')))) {
    return text.slice(1, -1);
  }
  return text;
}

function rangeRecord(node) {
  const range = node.range();
  return Object.freeze({
    start_line: range.start.line + 1,
    start_column: range.start.column + 1,
    end_line: range.end.line + 1,
    end_column: range.end.column + 1
  });
}

function nodeRecord(kind, node, extra = {}) {
  return Object.freeze({
    kind,
    ...extra,
    ...rangeRecord(node)
  });
}

function collectNamed(root, treeKind, recordKind) {
  return root.findAll({ rule: { kind: treeKind } }).map((node) => nodeRecord(recordKind, node, {
    name: node.field('name')?.text() ?? null
  }));
}

function collectImports(root) {
  return root.findAll({ rule: { kind: 'import_statement' } }).map((node) => nodeRecord('import', node, {
    source: stripQuoted(node.field('source')?.text() ?? ''),
    text: bounded(node.text())
  }));
}

function collectCalls(root) {
  return root.findAll({ rule: { kind: 'call_expression' } }).map((node) => nodeRecord('call', node, {
    target: bounded(node.field('function')?.text() ?? '', 512),
    text: bounded(node.text())
  }));
}

function collectExports(root) {
  return root.findAll({ rule: { kind: 'export_statement' } }).map((node) => nodeRecord('export', node, {
    text: bounded(node.text())
  }));
}

function stableFacts(facts) {
  return facts.sort((left, right) =>
    left.start_line - right.start_line
    || left.start_column - right.start_column
    || left.kind.localeCompare(right.kind)
    || String(left.name ?? left.target ?? left.source ?? '').localeCompare(String(right.name ?? right.target ?? right.source ?? ''))
  );
}

export function supportedStructuralLanguage(sourcePath) {
  return LANGUAGE_BY_EXTENSION[path.extname(String(sourcePath ?? '')).toLowerCase()] ?? null;
}

export async function analyzeSourceFile({ sourcePath, content } = {}) {
  const normalizedPath = String(sourcePath ?? '').trim();
  if (!normalizedPath) throw new CatalogError('Structural analyzer sourcePath is required.', 'STRUCTURAL_INPUT_INVALID');
  if (typeof content !== 'string') throw new CatalogError(`Structural analyzer content must be text: ${normalizedPath}`, 'STRUCTURAL_INPUT_INVALID');
  const language = supportedStructuralLanguage(normalizedPath);
  if (!language) {
    return Object.freeze({
      source_path: normalizedPath,
      status: 'UNSUPPORTED_LANGUAGE',
      language: null,
      facts: []
    });
  }

  try {
    const syntax = await parseAsync(language, content);
    const root = syntax.root();
    const errors = root.findAll({ rule: { kind: 'ERROR' } });
    if (errors.length > 0) {
      return Object.freeze({
        source_path: normalizedPath,
        status: 'PARSE_ERROR',
        language: String(language),
        facts: [],
        parse_errors: errors.slice(0, 20).map((node) => ({ text: bounded(node.text(), 500), ...rangeRecord(node) }))
      });
    }

    const facts = stableFacts([
      ...collectNamed(root, 'function_declaration', 'function'),
      ...collectNamed(root, 'generator_function_declaration', 'function'),
      ...collectNamed(root, 'class_declaration', 'class'),
      ...collectImports(root),
      ...collectCalls(root),
      ...collectExports(root)
    ]);

    return Object.freeze({
      source_path: normalizedPath,
      status: 'ANALYZED',
      language: String(language),
      facts
    });
  } catch (error) {
    throw new CatalogError(`Structural extraction failed for ${normalizedPath}: ${error?.message ?? String(error)}`, 'STRUCTURAL_EXTRACTION_FAILED');
  }
}

export async function analyzeSourceFiles(files) {
  if (!Array.isArray(files)) throw new CatalogError('Structural analyzer files must be an array.', 'STRUCTURAL_INPUT_INVALID');
  const results = [];
  for (const file of [...files].sort((a, b) => String(a?.sourcePath ?? '').localeCompare(String(b?.sourcePath ?? '')))) {
    results.push(await analyzeSourceFile(file));
  }
  return Object.freeze(results);
}
