"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../../source/index.js');
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/2**32;};}

test('1000 randomized dependency closures terminate and contain reachable nodes only',()=>{
 const r=rng(0xC0FFEE);
 for(let iter=0;iter<1000;iter++){
  const n=3+Math.floor(r()*12), names=Array.from({length:n},(_,i)=>`f${i}.js`), graph={};
  for(const a of names){graph[a]=names.filter(()=>r()<0.18);}
  const root=names[Math.floor(r()*n)];
  const out=s.crossFileDependencyTrace({graph,roots:[root]}).closure;
  assert.equal(out[0],root); assert.equal(new Set(out).size,out.length);
  const reachable=new Set([root]), q=[root]; while(q.length){for(const b of graph[q.shift()]||[])if(!reachable.has(b)){reachable.add(b);q.push(b);}}
  assert.deepEqual(new Set(out),reachable);
 }
});

test('1000 randomized synchronized patchsets never report READY with a missing required edit',()=>{
 const r=rng(0xBAD5EED);
 for(let iter=0;iter<1000;iter++){
  const files=Array.from({length:2+Math.floor(r()*7)},(_,i)=>`f${i}.js`);
  const plan={changes:files.map(file=>({file}))};
  const edits=files.filter(()=>r()>0.22).map(file=>({file,after:`TOKEN_${file}`}));
  const out=s.synchronizedPatchsetGenerator({plan,edits});
  const actuallyMissing=files.filter(f=>!edits.some(e=>e.file===f));
  assert.deepEqual(out.missing,actuallyMissing);
  assert.equal(out.status,actuallyMissing.length?'BLOCKED':'READY');
 }
});

test('1000 clean semantic diffs within allowed file scope never false-reject',()=>{
 const r=rng(0x12345678);
 for(let iter=0;iter<1000;iter++){
  const files=Array.from({length:1+Math.floor(r()*8)},(_,i)=>`src/f${i}.js`);
  const changes=files.map(file=>({file,before:'const API_CONTRACT=1;',after:'const API_CONTRACT=1;\nconst x=2;'}));
  const out=s.semanticDiffReview({changes,allowedFiles:files,allowedSymbols:[],protectedContracts:['API_CONTRACT']});
  assert.equal(out.status,'PASS');
 }
});
