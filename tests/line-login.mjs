import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';

async function load(path, imports = {}, suffix = '') {
  let source = (await readFile(new URL('../' + path, import.meta.url), 'utf8')).replace('import "server-only";', '');
  for (const [specifier, url] of Object.entries(imports)) source = source.replaceAll('from "' + specifier + '"', 'from ' + JSON.stringify(url));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const url = 'data:text/javascript;base64,' + Buffer.from(code + '\n//' + suffix).toString('base64');
  return { url, ...await import(url) };
}
const channel = 'test-channel', subject = 'U' + 'a'.repeat(32), now = Math.floor(Date.now() / 1000);
const pair = await generateKeyPair('ES256'), second = await generateKeyPair('ES256');
const publicKey = { ...await exportJWK(pair.publicKey), kid: 'key-one', alg: 'ES256', use: 'sig' };
const secondKey = { ...await exportJWK(second.publicKey), kid: 'key-two', alg: 'ES256', use: 'sig' };
const claims = { iss: 'https://access.line.me', aud: channel, sub: subject, iat: now, exp: now + 3600, name: 'Member', picture: 'https://example.com/member.jpg' };
const sign = (payload = claims, key = pair.privateKey, kid = 'key-one') => new SignJWT(payload).setProtectedHeader({ alg: 'ES256', kid }).sign(key);
let keyCalls = 0, onlineCalls = 0, keyFailure = false, onlineRejected = false, keySet = [publicKey];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const address = String(url);
  if (address === 'https://api.line.me/oauth2/v2.1/certs') {
    keyCalls++;
    if (keyFailure) throw new Error('key service unavailable');
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ keys: keySet });
  }
  if (address === 'https://api.line.me/oauth2/v2.1/verify' && options.method === 'POST') {
    onlineCalls++;
    assert.equal(options.body.get('client_id'), channel);
    return onlineRejected ? Response.json({ error: 'invalid_token' }, { status: 400 }) : Response.json({ ...claims });
  }
  throw new Error('Unexpected request: ' + address);
};
try {
  const id = await load('lib/line/id-token.ts', { jose: import.meta.resolve('jose') });
  const identity = await load('lib/line/verify-member-identity.ts', { './id-token': id.url });
  const token = await sign();
  id.prepareLineIdToken(token);
  const results = await Promise.all(Array.from({ length: 8 }, () => id.verifyLineIdToken(token, channel)));
  assert.equal(keyCalls, 1, 'Concurrent validation shares the public key request');
  assert.ok(results.every(result => result?.sub === subject));
  assert.equal((await identity.verifyMemberIdentity({ idToken: token }, channel)).name, 'Member');
  assert.equal(onlineCalls, 0, 'Valid ES256 skips the online verification round trip');
  const started = performance.now();
  for (let i = 0; i < 100; i++) assert.equal((await id.verifyLineIdToken(token, channel)).sub, subject);
  const validationMs = (performance.now() - started) / 100;
  assert.equal(keyCalls, 1, 'Only public keys remain cached');
  assert.ok(validationMs < 100, 'Warm signature verification is under 100 ms on the test machine');

  const invalid = [
    await sign(claims, second.privateKey),
    await sign({ ...claims, exp: now - 1 }),
    await sign({ ...claims, aud: 'another-channel' }),
    await sign({ ...claims, aud: [channel, 'another-channel'] }),
    await sign({ ...claims, iss: 'https://untrusted.example' }),
    await sign({ ...claims, sub: 'not-a-line-id' }),
    await sign({ ...claims, iat: now + 120 }),
    await sign({ ...claims, exp: now }),
    await sign(Object.fromEntries(Object.entries(claims).filter(([key]) => key !== 'exp'))),
    await sign(Object.fromEntries(Object.entries(claims).filter(([key]) => key !== 'iat'))),
    'not.a.token',
    Buffer.from('{"alg":"none"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.',
  ];
  for (const rejected of invalid) {
    assert.equal(await id.verifyLineIdToken(rejected, channel), null);
    assert.equal(await identity.verifyMemberIdentity({ idToken: rejected }, channel), null);
  }
  assert.equal(onlineCalls, 0, 'Bad signatures and claims cannot fall through to online ID verification');
  const hsToken = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('test-secret-with-at-least-32-characters'));
  assert.equal(await id.verifyLineIdToken(hsToken, channel), undefined);
  assert.equal((await identity.verifyMemberIdentity({ idToken: hsToken }, channel)).sub, subject);
  assert.equal(onlineCalls, 1, 'HS256 uses LINE verification, not an unverified decoded payload');
  onlineRejected = true;
  assert.equal(await identity.verifyMemberIdentity({ idToken: hsToken }, channel), null, 'Settled identity is not cached');
  onlineRejected = false;

  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 31000;
    keySet = [publicKey, secondKey];
    assert.equal((await id.verifyLineIdToken(await sign(claims, second.privateKey, 'key-two'), channel)).sub, subject);
    assert.equal(keyCalls, 2, 'A rotated signing key refreshes JWKS after the cooldown');
  } finally { Date.now = realNow; }
  keyFailure = true;
  const unavailable = await load('lib/line/id-token.ts', { jose: import.meta.resolve('jose') }, 'unavailable');
  assert.equal(await unavailable.verifyLineIdToken(token, channel), undefined);
  const fallback = await load('lib/line/verify-member-identity.ts', { './id-token': unavailable.url }, 'fallback');
  assert.equal((await fallback.verifyMemberIdentity({ idToken: token }, channel)).sub, subject, 'Key-service failure uses trusted online verification');
  onlineRejected = true;
  assert.equal(await fallback.verifyMemberIdentity({ idToken: token }, channel), null, 'A failed key fetch never authorizes by itself');

  const { shouldInitializeLine } = await load('lib/line/login-flow.ts');
  const entry = { signedOut: false, connectRequested: false, liffCallback: false, pendingTransfer: false, inClient: false };
  assert.equal(shouldInitializeLine(entry), false);
  for (const field of ['inClient', 'connectRequested', 'liffCallback', 'pendingTransfer']) assert.equal(shouldInitializeLine({ ...entry, [field]: true }), true);
  assert.equal(shouldInitializeLine({ ...entry, inClient: true, signedOut: true }), false);
  assert.equal(shouldInitializeLine({ ...entry, inClient: true, signedOut: true, connectRequested: true }), true);

  // Exercise the real lookup handler with a signed token and a controlled DB.
  // Membership and balance must be read afresh even when signing keys are warm.
  const stub = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const context = await load('lib/line/shop-context.ts', { '../single-flight': (await load('lib/single-flight.ts')).url });
  const afterTasks = [];
  let reads = [], memberPoints = 120, memberStatus = 'active';
  globalThis.__lineLoginDb = { from(table) {
    const filters = {}, builder = {
      select() { return builder; }, eq(key, value) { filters[key] = value; return builder; },
      single() { return builder; }, maybeSingle() { return builder; },
      async then(resolve) {
        reads.push(table);
        if (table === 'members') {
          assert.deepEqual(filters, { owner_id: 'shop', line_user_id: subject });
          resolve({ error: null, data: { id: 'member', status: memberStatus, points: memberPoints, name: 'Member', level: 'Gold', member_code: 'TM-TEST', line_display_name: 'Old name', line_picture_url: null } });
        } else resolve({ error: null, data: table === 'public_shop_profiles' ? { owner_id: 'shop' } : { login_channel_id: channel, liff_id: 'test-liff' } });
      },
    }; return builder;
  }};
  globalThis.__lineLoginAfter = task => afterTasks.push(task);
  const route = await load('app/api/line/member/route.ts', {
    '@/lib/line/id-token': id.url,
    '@/lib/line/verify-member-identity': identity.url,
    '@/lib/line/shop-context': context.url,
    '@supabase/supabase-js': stub('export const createClient=()=>globalThis.__lineLoginDb;'),
    'next/server': stub('export const after=task=>globalThis.__lineLoginAfter(task);'),
  });
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, savedKey = process.env.SUPABASE_SECRET_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid'; process.env.SUPABASE_SECRET_KEY = 'test-only';
  try {
    const request = body => new Request('https://shop.example/api/line/member', { method: 'POST', body: JSON.stringify(body) });
    const lookup = () => route.POST(request({ action: 'lookup', idToken: token }));
    const response = await lookup();
    assert.equal(response.status, 200); assert.equal((await response.json()).member.points, 120);
    assert.match(response.headers.get('Server-Timing'), /shop;dur=.*identity;dur=.*member;dur=.*total;dur=/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(afterTasks.length, 1, 'Profile write is scheduled after responding');
    memberPoints = 777;
    assert.equal((await (await lookup()).json()).member.points, 777, 'Warm keys do not reuse an old member balance');
    memberStatus = 'inactive'; assert.equal((await lookup()).status, 403, 'Disabled membership is rejected on the next lookup');
    reads = [];
    assert.equal((await route.POST(request({ action: 'lookup', idToken: invalid[0] }))).status, 401);
    assert.ok(!reads.includes('members'), 'Invalid signature cannot reach member data');
    reads = [];
    assert.equal((await route.POST(request(null))).status, 400);
    assert.equal((await route.POST(request({ action: 'lookup' }))).status, 401);
    assert.equal((await route.POST(request({ idToken: 'x'.repeat(9000) }))).status, 413);
    assert.equal(reads.length, 0, 'Invalid requests are rejected before DB reads');
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = savedKey;
    delete globalThis.__lineLoginDb; delete globalThis.__lineLoginAfter;
  }
  console.log(`PASS: signed LINE token validation, claims/signature rejection, shared keys, key rotation, trusted fallback, no settled identity cache, automatic LIFF entry and logout. Warm validation average ${validationMs.toFixed(2)} ms (local test, not end-to-end LINE login).`);
} finally { globalThis.fetch = realFetch; }
