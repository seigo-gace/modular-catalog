import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function loadControlIndex(root = process.cwd()) {
  return JSON.parse(await fs.readFile(path.join(root, 'control/index.json'), 'utf8'));
}

export async function selectControlSections(root = process.cwd(), tasks = []) {
  const index = await loadControlIndex(root);
  const selected = new Set(index.always);
  for (const task of tasks) {
    for (const file of index.tasks[task] ?? []) selected.add(file);
  }
  return [...selected];
}

export async function verifyControl(root = process.cwd()) {
  const manifestPath = path.join(root, 'control/manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const content = await fs.readFile(path.join(root, relative));
    const actual = sha256(content);
    if (actual !== expected) {
      throw new Error(`Control hash mismatch: ${relative}`);
    }
  }
  return { valid: true, fileCount: Object.keys(manifest.files).length };
}
