const ASSETS = /* RETREAT_ASSETS */ {};
const COOKIE = '__Host-v1-retreat-session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

function response(body, status = 200, headers = {}) {
  return new Response(body, {status, headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-store, max-age=0',
    'cdn-cache-control': 'no-store',
    'cloudflare-cdn-cache-control': 'no-store',
    'vary': 'Cookie',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow',
    ...headers,
  }});
}

function loginPage(error = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#dfdbd0"><title>Fall 2026 Retreat</title><style>
:root{--paper:#dfdbd0;--ink:#103b29;--surface:#eeeae0;--error:#84372c;--display:Georgia,serif;--body:ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font:16px/1.5 var(--body);padding:24px}main{width:100%;max-width:380px}h1{font:700 clamp(42px,10vw,64px)/1 var(--display);letter-spacing:-.04em;margin:0 0 24px}p{margin:0 0 24px}label{display:block;margin-bottom:8px;font-weight:600}input,button{font:inherit;min-height:48px;border:1px solid var(--ink);border-radius:4px;width:100%;padding:12px 16px}input{background:var(--surface);color:var(--ink)}button{margin-top:16px;background:var(--ink);color:var(--surface);cursor:pointer}button:active{transform:translateY(1px)}:focus-visible{outline:3px solid var(--ink);outline-offset:4px}.error{color:var(--error);margin:16px 0 0;min-height:24px}.tree{width:48px;height:48px;margin-bottom:24px}</style></head><body><main><svg class="tree" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 5 6h-3l5 7h-6v5h-2v-5H5l5-7H7z"/></svg><h1>Fall 2026<br>Retreat</h1><p>Enter the retreat password.</p><form method="post" action="/__retreat/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" ${error?'aria-invalid="true" aria-describedby="login-error"':''}><button type="submit">Come on in</button>${error?'<p id="login-error" class="error" role="alert">That password didn’t work. Try again.</p>':''}</form></main></body></html>`;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function fromBase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid signature');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0));
}
async function signingKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(env.RETREAT_SESSION_SECRET + '\0' + env.RETREAT_PASSWORD));
  return crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
async function passwordMatches(actual, expected) {
  const [a,b] = await Promise.all([actual,expected].map(value => crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const x=new Uint8Array(a), y=new Uint8Array(b);let difference=0;
  for(let i=0;i<x.length;i++)difference|=x[i]^y[i];
  return difference===0;
}
async function newSession(env) {
  const expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
  const nonce=base64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload=expires+'.'+nonce;
  const signature=await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload));
  return payload+'.'+base64url(new Uint8Array(signature));
}
async function authenticated(request, env) {
  const token=(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||token.length>200)return false;
  const parts=token.split('.');
  if(parts.length!==3||!/^\d{10,12}$/.test(parts[0])||!/^[A-Za-z0-9_-]{22}$/.test(parts[1]))return false;
  const now=Math.floor(Date.now()/1000),expires=Number(parts[0]);
  if(expires<=now||expires>now+SESSION_SECONDS)return false;
  try{return await crypto.subtle.verify('HMAC',await signingKey(env),fromBase64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));}catch{return false;}
}

export default {
  async fetch(request, env) {
    if(!env.RETREAT_PASSWORD||!env.RETREAT_SESSION_SECRET)return response('Retreat temporarily unavailable.',503);
    const url=new URL(request.url);
    if(request.method==='POST'&&(url.pathname==='/__retreat/login'||url.pathname==='/__retreat/logout')) {
      if(request.headers.get('origin')!==url.origin)return response('Request not allowed.',403);
      if(url.pathname==='/__retreat/logout')return response(null,303,{'location':'/','set-cookie':`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`});
      if(Number(request.headers.get('content-length'))>4096)return response('Request too large.',413);
      const body=await request.text();
      if(body.length>4096)return response('Request too large.',413);
      const submitted=new URLSearchParams(body).get('password')||'';
      if(!submitted||submitted.length>256||!await passwordMatches(submitted,env.RETREAT_PASSWORD))return response(loginPage(true),401);
      const token=await newSession(env);
      return response(null,303,{'location':'/','set-cookie':`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`});
    }
    if(request.method!=='GET'&&request.method!=='HEAD')return response('Method not allowed.',405,{'allow':'GET, HEAD'});
    if(!await authenticated(request,env)) {
      if(url.pathname==='/'||url.pathname==='/index.html')return response(request.method==='HEAD'?null:loginPage());
      return response(request.method==='HEAD'?null:'Password required.',401,{'content-type':'text/plain; charset=utf-8'});
    }
    const path=url.pathname==='/'?'/index.html':url.pathname;
    const asset=ASSETS[path];
    if(!asset)return response('Not found.',404,{'content-type':'text/plain; charset=utf-8'});
    const bytes=request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),value=>value.charCodeAt(0));
    return response(bytes,200,{'content-type':asset.type});
  },
};
