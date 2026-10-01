const t=require('node:test'),a=require('node:assert/strict'),s=require('../../source');t('valid rollback',()=>a.equal(s.run({before_hash:'a',after_hash:'b',rollback_hash:'a'}).status,'PASS'));
