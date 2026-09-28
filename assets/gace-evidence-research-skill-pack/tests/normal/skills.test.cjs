"use strict";const test=require('node:test');const a=require('node:assert/strict');const s=require('../../source/index.js');
test('query plan is deterministic unique',()=>a.deepEqual(s.planQueries({claim:'x',terms:['official','official']}).queries,['x','x official']));
test('authority ranks primary above community',()=>a.equal(s.evaluateSourceAuthority({sources:[{id:'c',tier:'community'},{id:'p',tier:'primary'}]}).sources[0].id,'p'));
test('freshness distinguishes stale and unknown',()=>{const r=s.checkFreshness({sources:[{id:'a',publishedAt:'2026-09-20'},{id:'b'}],now:'2026-09-28',maxAgeDays:30}).results;a.equal(r[0].status,'FRESH');a.equal(r[1].status,'UNKNOWN');});
test('claim evidence map and gap semantics',()=>{const claims=[{id:'c1'},{id:'c2'}],m=s.mapClaimsToEvidence({claims,evidence:[{id:'e',claimIds:['c1']}]});a.deepEqual(s.detectEvidenceGaps({claims,mapping:m.mapping}).gaps[0],{claimId:'c2',reason:'NO_EVIDENCE_FOUND_NOT_PROOF_OF_ABSENCE'});});
test('contradiction detected',()=>a.equal(s.detectContradictorySources({statements:[{claimId:'c',sourceId:'a',value:1},{claimId:'c',sourceId:'b',value:2}]}).conflicts.length,1));
test('citation verification fails unsupported',()=>a.deepEqual(s.verifyCitations({claims:[{id:'c'}],citations:[{claimId:'c',resolves:true,supportsClaim:false}]}).invalid,['c']));
test('scope rejects out of scope',()=>a.deepEqual(s.scopeEvidence({evidence:[{id:'a',scope:'jp'},{id:'b',scope:'us'}],scope:'jp'}).rejected,['b']));
test('merge dedupes canonical keys',()=>a.equal(s.mergeEvidenceResults({primary:[{id:'a',canonicalKey:'k'}],external:[{id:'b',canonicalKey:'k'}]}).duplicates,1));
