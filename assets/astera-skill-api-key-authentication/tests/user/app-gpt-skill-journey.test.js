'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateSkillApiKey } = require('../../code/skill-api-key');

test('アプリGPT Skillは連続利用でき一般Tenant Keyは拒否される', () => {
  const oldSkill = process.env.ASTERA_SKILL_API_KEY; const oldPublic = process.env.ASTERA_API_KEY;
  try {
    process.env.ASTERA_SKILL_API_KEY = 'skill_owner_key_abcdefghijklmnopqrstuvwxyz';
    process.env.ASTERA_API_KEY = 'tenant_admin_key_abcdefghijklmnopqrstuvwxyz';
    for (let index = 0; index < 100; index += 1) assert.equal(authenticateSkillApiKey(process.env.ASTERA_SKILL_API_KEY).id, 'owner-skill-private');
    assert.equal(authenticateSkillApiKey(process.env.ASTERA_API_KEY), null);
  } finally {
    if (oldSkill === undefined) delete process.env.ASTERA_SKILL_API_KEY; else process.env.ASTERA_SKILL_API_KEY = oldSkill;
    if (oldPublic === undefined) delete process.env.ASTERA_API_KEY; else process.env.ASTERA_API_KEY = oldPublic;
  }
});
