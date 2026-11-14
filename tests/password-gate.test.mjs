import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
const origin='https://retreat.example.com';
const env={RETREAT_PASSWORD:'test-password-only',RETREAT_SESSION_SECRET:'test-session-signing-key-only'};
const request=(path='/',options={})=>new Request(origin+path,options);
async function login(password=env.RETREAT_PASSWORD,originHeader=origin){
  return worker.fetch(request('/__retreat/login',{method:'POST',headers:{origin:originHeader,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})}),env);
}
async function session(){const r=await login();assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];}

test('anonymous visitors see only the password form; photos, scripts, and styles are protected',async()=>{
  const page=await worker.fetch(request(),env);assert.equal(page.status,200);const html=await page.text();
  assert.match(html,/type="password"/);assert.doesNotMatch(html,/4769|Brookwood|retreat-two|test-password-only/);
  for(const path of ['/assets/retreat-two-1.jpg','/assets/grass-river.jpg','/assets/v1-michigan.png','/style.css','/app.js','/navigation.js']){
    const r=await worker.fetch(request(path),env);assert.equal(r.status,401,path);assert.equal(await r.text(),'Password required.');
  }
});
test('missing runtime secrets fail closed',async()=>{
  for(const configuration of [{},{RETREAT_PASSWORD:env.RETREAT_PASSWORD}])assert.equal((await worker.fetch(request(),configuration)).status,503);
});
test('incorrect and blank passwords do not set sessions',async()=>{
  for(const password of ['wrong','',env.RETREAT_PASSWORD+' ']){const r=await login(password);assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);assert.match(await r.text(),/aria-invalid="true"/);}
});
test('login rejects cross-origin POSTs',async()=>{assert.equal((await login(env.RETREAT_PASSWORD,'https://other.example.com')).status,403)});
test('correct password creates a signed HttpOnly Secure SameSite session, without including the password',async()=>{
  const r=await login();assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/');const c=r.headers.get('set-cookie');
  for(const flag of ['__Host-v1-retreat-session=','Path=/','Secure','HttpOnly','SameSite=Lax','Max-Age=604800'])assert.ok(c.includes(flag));
  assert.ok(!c.includes(env.RETREAT_PASSWORD));
});
test('valid sessions return the complete page and exact original photo bytes with no-store headers',async()=>{
  const cookie=await session();const page=await worker.fetch(request('/',{headers:{cookie}}),env);assert.equal(page.status,200);const html=await page.text();
  assert.match(html,/<h1>Fall 2026<br>Retreat<\/h1>/);assert.match(html,/id="menu-toggle"/);assert.doesNotMatch(html,/photos\.app\.goo\.gl/);
  for(const path of ['/assets/retreat-two-1.jpg','/assets/grass-river.jpg','/assets/glacial-hills.jpg','/assets/shorts-pub.jpg','/assets/shanty-creek.png','/assets/mackinac-bridge.jpg']){
    const r=await worker.fetch(request(path,{headers:{cookie}}),env);assert.equal(r.status,200,path);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()),readFileSync(new URL('../site'+path,import.meta.url)));
    assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('cdn-cache-control'),'no-store');
  }
});
test('forged, expired, and password-rotated sessions cannot view photos',async()=>{
  const cookie=await session();
  for(const badCookie of ['__Host-v1-retreat-session=anything',cookie.slice(0,-8)+'ABCDEFGH',cookie.replace(/=\d+\./,'=1000000000.')]){
    assert.equal((await worker.fetch(request('/assets/retreat-two-1.jpg',{headers:{cookie:badCookie}}),env)).status,401);
  }
  assert.equal((await worker.fetch(request('/assets/retreat-two-1.jpg',{headers:{cookie}}),{...env,RETREAT_PASSWORD:'changed'})).status,401);
});
test('logout clears the session; methods and unknown authenticated paths are bounded',async()=>{
  const r=await worker.fetch(request('/__retreat/logout',{method:'POST',headers:{origin}}),env);assert.equal(r.status,303);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await worker.fetch(request('/__retreat/logout',{method:'POST',headers:{origin:'https://other.example.com'}}),env)).status,403);
  assert.equal((await worker.fetch(request('/',{method:'PUT'}),env)).status,405);
  const cookie=await session();assert.equal((await worker.fetch(request('/not-found',{headers:{cookie}}),env)).status,404);
  const head=await worker.fetch(request('/',{method:'HEAD',headers:{cookie}}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
});
