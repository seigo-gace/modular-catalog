"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('returns UNKNOWN without evidence',()=>{a.equal(run({}).status,'UNKNOWN');});
