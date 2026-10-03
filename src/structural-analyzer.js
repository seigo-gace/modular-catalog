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

function bounded(value, maxLength = 1000) {
  const text = String(value ?? '');
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function stripQuoted(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')) || (text.startsWith('`') && text.endsWith('`')))) return text.slice(1, -1);
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
  return Object.freeze({ kind, ...extra, ...rangeRecord(node) });
}

function returnExpressions(node) {
  return node.findAll({ rule: { kind: 'return_statement' } })
    .slice(0, 20)
    .map((item) => bounded(item.text().replace(/^return\s*/, '').replace(/;\s*$/, '').trim(), 1000))
    .filter(Boolean);
}

function collectFunctions(root) {
  const result = root.findAll({ rule: { kind: 'function_declaration' } }).map((node) => nodeRecord('function', node, {
    name: node.field('name')?.text() ?? null,
    parameters: bounded(node.field('parameters')?.text() ?? '', 1000),
    returns: returnExpressions(node)
  }));

  for (const node of root.findAll({ rule: { kind: 'variable_declarator' } })) {
    const value = node.field('value');
    if (!value || !['arrow_function', 'function_expression', 'generator_function'].includes(value.kind())) continue;
    result.push(nodeRecord('function', node, {
      name: node.field('name')?.text() ?? null,
      parameters: bounded(value.field('parameters')?.text() ?? '', 1000),
      returns: returnExpressions(value)
    }));
  }
  return result;
}

function collectClasses(root) {
  return root.findAll({ rule: { kind: 'class_declaration' } }).map((node) => nodeRecord('class', node, { name: node.field('name')?.text() ?? null }));
}

function collectImports(root) {
  return root.findAll({ rule: { kind: 'import_statement' } }).map((node) => nodeRecord('import', node, {
    source: stripQuoted(node.field('source')?.text() ?? '')
  })).filter((item) => item.source);
}

function requireSource(node) {
  const fn = node.field('function')?.text() ?? '';
  if (fn !== 'require') return null;
  const args = node.field('arguments')?.text() ?? '';
  const match = /^\(\s*(["'`])([^"'`]+)\1\s*\)$/.exec(args.trim());
  return match?.[2] ?? null;
}

function collectRequires(root) {
  return root.findAll({ rule: { kind: 'call_expression' } }).map((node) => {
    const source = requireSource(node);
    return source ? nodeRecord('require', node, { source }) : null;
  }).filter(Boolean);
}

function collectCalls(root) {
  return root.findAll({ rule: { kind: 'call_expression' } }).map((node) => nodeRecord('call', node, {
    target: bounded(node.field('function')?.text() ?? '', 512)
  })).filter((item) => item.target && item.target !== 'require');
}

function exportNamesFromObject(node) {
  const result = [];
  for (const child of node.namedChildren()) {
    if (['shorthand_property_identifier', 'shorthand_property_identifier_pattern'].includes(child.kind())) {
      result.push(child.text());
      continue;
    }
    const key = child.field('key')?.text() ?? child.field('name')?.text();
    if (key) result.push(stripQuoted(key));
  }
  return result.filter(Boolean);
}

function collectCommonJsExports(root) {
  const result = [];
  for (const node of root.findAll({ rule: { kind: 'assignment_expression' } })) {
    const left = node.field('left')?.text() ?? '';
    const right = node.field('right');
    if (left === 'module.exports' && right) {
      if (right.kind() === 'object') {
        for (const name of exportNamesFromObject(right)) result.push(nodeRecord('export', node, { name, export_type: 'commonjs' }));
      } else if (/^[A-Za-z_$][\w$]*$/.test(right.text())) {
        result.push(nodeRecord('export', node, { name: right.text(), export_type: 'commonjs' }));
      }
      continue;
    }
    const direct = /^(?:module\.exports|exports)\.([A-Za-z_$][\w$]*)$/.exec(left);
    if (direct) result.push(nodeRecord('export', node, { name: direct[1], export_type: 'commonjs' }));
  }
  return result;
}

function collectEsmExports(root) {
  const result = [];
  for (const node of root.findAll({ rule: { kind: 'export_statement' } })) {
    let named = false;
    for (const child of node.namedChildren()) {
      if (['function_declaration', 'class_declaration'].includes(child.kind())) {
        const name = child.field('name')?.text();
        if (name) {
          result.push(nodeRecord('export', node, { name, export_type: 'esm' }));
          named = true;
        }
      }
      if (child.kind() === 'export_clause') {
        for (const specifier of child.namedChildren()) {
          const name = specifier.field('alias')?.text() ?? specifier.field('name')?.text() ?? specifier.text();
          if (name) {
            result.push(nodeRecord('export', node, { name: bounded(name, 256), export_type: 'esm' }));
            named = true;
          }
        }
      }
    }
    if (!named) result.push(nodeRecord('export', node, { name: null, export_type: 'esm' }));
  }
  return result;
}

function stableFacts(facts) {
  const unique = new Map();
  for (const fact of facts) {
    const key = JSON.stringify([fact.kind, fact.name ?? null, fact.source ?? null, fact.target ?? null, fact.parameters ?? null, fact.start_line, fact.start_column]);
    if (!unique.has(key)) unique.set(key, fact);
  }
  return [...unique.values()].sort((left, right) =>
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
  if (!language) return Object.freeze({ source_path: normalizedPath, status: 'UNSUPPORTED_LANGUAGE', language: null, facts: [] });

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
        parse_errors: errors.slice(0, 20).map((node) => rangeRecord(node))
      });
    }

    const facts = stableFacts([
      ...collectFunctions(root),
      ...collectClasses(root),
      ...collectImports(root),
      ...collectRequires(root),
      ...collectCalls(root),
      ...collectEsmExports(root),
      ...collectCommonJsExports(root)
    ]);

    return Object.freeze({ source_path: normalizedPath, status: 'ANALYZED', language: String(language), facts });
  } catch (error) {
    throw new CatalogError(`Structural extraction failed for ${normalizedPath}: ${error?.message ?? String(error)}`, 'STRUCTURAL_EXTRACTION_FAILED');
  }
}

export async function analyzeSourceFiles(files) {
  if (!Array.isArray(files)) throw new CatalogError('Structural analyzer files must be an array.', 'STRUCTURAL_INPUT_INVALID');
  const results = [];
  for (const file of [...files].sort((a, b) => String(a?.sourcePath ?? '').localeCompare(String(b?.sourcePath ?? '')))) results.push(await analyzeSourceFile(file));
  return Object.freeze(results);
}
