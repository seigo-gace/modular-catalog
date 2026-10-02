#!/usr/bin/env node
import process from 'node:process';
import { processAdmissionQueueOnce } from '../src/runtime-admission-queue.js';

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
if (!flags['work-root']) throw new Error('Missing --work-root');
const result = await processAdmissionQueueOnce({ workRoot: flags['work-root'], requestId: flags['request-id'] ?? null });
console.log(JSON.stringify(result));
