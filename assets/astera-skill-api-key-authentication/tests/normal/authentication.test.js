'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateSkillApiKey, isSkillApiConfigured } = require('../../code/skill-api-key');

function restore(name, value) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }

test('専用Keyだけを認証する', () => {
  const oldSkill = process.env.ASTERA_SKILL_API_KEY; const oldPublic = process.env.ASTERA_API_KEY;
  try {
    process.env.ASTERA_SKILL_API_KEY = 'skill_test_key_abcdefghijklmnopqrstuvwxyz';
    process.env.ASTERA_API_KEY = 'public_test_key_abcdefghijklmnopqrstuvwxyz';
    assert.equal(isSkillApiConfigured(), true);
    assert.equal(authenticateSkillApiKey(process.env.ASTERA_SKILL_API_KEY).unlimited, true);
    assert.equal(authenticateSkillApiKey(process.env.ASTERA_API_KEY), null);
    assert.equal(authenticateSkillApiKey('wrong_test_key_abcdefghijklmnopqrstuvwxyz'), null);
    assert.equal(authenticateSkillApiKey(), null);
  } finally { restore('ASTERA_SKILL_API_KEY', oldSkill); restore('ASTERA_API_KEY', oldPublic); }
});

test('短Key・長Key・公開Key共有を無効にする', () => {
  const oldSkill = process.env.ASTERA_SKILL_API_KEY; const oldPublic = process.env.ASTERA_API_KEY;
  try {
    process.env.ASTERA_SKILL_API_KEY = 'short'; delete process.env.ASTERA_API_KEY;
    assert.equal(isSkillApiConfigured(), false);
    process.env.ASTERA_SKILL_API_KEY = 'x'.repeat(257);
    assert.equal(isSkillApiConfigured(), false);
    process.env.ASTERA_SKILL_API_KEY = 'shared_test_key_abcdefghijklmnopqrstuvwxyz';
    process.env.ASTERA_API_KEY = process.env.ASTERA_SKILL_API_KEY;
    assert.equal(isSkillApiConfigured(), false);
  } finally { restore('ASTERA_SKILL_API_KEY', oldSkill); restore('ASTERA_API_KEY', oldPublic); }
});
