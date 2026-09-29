const t=require('node:test'),a=require('node:assert/strict'),s=require('../../source');t('reports uncovered files',()=>a.equal(s.run({changed_files:['a'],mapping:{}}).status,'PARTIAL'));
