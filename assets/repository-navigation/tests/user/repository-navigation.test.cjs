"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('does not invent a file',()=>{const r=run({query:'payment',files:['src/auth.js']});a.equal(r.status,'NOT_FOUND');a.deepEqual(r.candidates,[]);});
