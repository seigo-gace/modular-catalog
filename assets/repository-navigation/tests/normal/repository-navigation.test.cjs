"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('ranks matching repository files',()=>{const r=run({query:'auth token',files:[{path:'src/auth/token.js',tags:['auth']},{path:'src/ui.js'}]});a.equal(r.status,'FOUND');a.equal(r.candidates[0].path,'src/auth/token.js');});
