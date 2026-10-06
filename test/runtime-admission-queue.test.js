import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAdmissionBundle, listAdmissionRequestIds, RUNTIME_ADMISSION_CONTROL } from '../src/runtime-admission-queue.js';

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function content(value) {
  return { encoding: 'base64', content: Buffer.from(JSON.stringify(value), 'utf8').toString('base64') };
}

test('admission queue discovery accepts only safe JSON request ids from the fixed control branch', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return responseJson([
      { type: 'file', name: 'req-20261003-reuse-quality-005.json' },
      { type: 'file', name: '../escape.json' },
      { type: 'dir', name: 'req-directory.json' },
      { type: 'file', name: 'notes.txt' }
    ]);
  };
  assert.deepEqual(await listAdmissionRequestIds(fetchImpl), ['req-20261003-reuse-quality-005']);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].includes(encodeURIComponent(RUNTIME_ADMISSION_CONTROL.control_branch)), true);
});

test('fetchAdmissionBundle reads ticket review and Factory result from fixed GitHub control paths', async () => {
  const id = 'req-20261003-reuse-quality-005';
  const requested = [];
  const records = {
    'admission-queue': { kind: 'ticket', request_id: id },
    reviews: { kind: 'review', request_id: id },
    results: { kind: 'result', request_id: id }
  };
  const fetchImpl = async (url) => {
    requested.push(url);
    const key = Object.keys(records).find((name) => url.includes(`.gace-control/${name}/`));
    if (!key) return responseJson({ message: 'not found' }, 404);
    return responseJson(content(records[key]));
  };
  const bundle = await fetchAdmissionBundle(id, fetchImpl);
  assert.equal(bundle.ticket.kind, 'ticket');
  assert.equal(bundle.review.kind, 'review');
  assert.equal(bundle.result.kind, 'result');
  assert.equal(requested.length, 3);
  assert.equal(requested.every((url) => url.includes(encodeURIComponent(RUNTIME_ADMISSION_CONTROL.control_branch))), true);
});

test('fetchAdmissionBundle rejects unsafe request identifiers before network access', async () => {
  let called = false;
  await assert.rejects(
    () => fetchAdmissionBundle('../escape', async () => { called = true; return responseJson({}); }),
    (error) => error?.code === 'RUNTIME_ADMISSION_QUEUE_REQUEST_INVALID'
  );
  assert.equal(called, false);
});
