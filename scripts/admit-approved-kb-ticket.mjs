#!/usr/bin/env node
import process from 'node:process';
import { executeRuntimeAdmissionFile } from '../src/runtime-admission.js';

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
if (!flags.ticket) throw new Error('Missing --ticket');
const root = flags.root ?? process.cwd();
const result = await executeRuntimeAdmissionFile(root, flags.ticket);
console.log(JSON.stringify(result));
