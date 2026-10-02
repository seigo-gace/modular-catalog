#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildAdmissionTicket, validateFactoryResult, validateGptReview } from '../src/chat-control-plane.js';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    flags[value.slice(2)] = argv[i + 1];
    i += 1;
  }
  return flags;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

const flags = parseArgs(process.argv.slice(2));
for (const key of ['review', 'result', 'output']) {
  if (!flags[key]) throw new Error(`Missing --${key}`);
}

const result = validateFactoryResult(await readJson(flags.result));
const review = validateGptReview(await readJson(flags.review), result);
const ticket = buildAdmissionTicket(review, result, { queuedAt: process.env.GACE_QUEUED_AT || new Date().toISOString() });

if (!ticket) {
  console.log(JSON.stringify({ admission_allowed: false, decision: review.decision, request_id: review.request_id }));
  process.exit(0);
}

const output = path.resolve(flags.output);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(ticket, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ admission_allowed: true, ticket }));
