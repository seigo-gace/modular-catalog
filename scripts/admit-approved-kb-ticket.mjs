#!/usr/bin/env node
import process from 'node:process';
import { executeRuntimeAdmissionFiles } from '../src/runtime-admission.js';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    flags[key] = argv[i + 1];
    i += 1;
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
for (const key of ['ticket', 'review', 'result']) {
  if (!flags[key]) throw new Error(`Missing --${key}`);
}
const root = flags.root ?? process.cwd();
const output = await executeRuntimeAdmissionFiles(root, {
  ticketFile: flags.ticket,
  reviewFile: flags.review,
  resultFile: flags.result
});
console.log(JSON.stringify(output));
