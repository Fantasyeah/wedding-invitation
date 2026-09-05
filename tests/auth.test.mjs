import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, verifySession } from '../functions/_lib/auth.js';
import { hmacSha256Hex } from '../functions/_lib/crypto.js';

const env = { SESSION_SECRET: 'test-secret' };

test('会话：创建后可验证通过', async () => {
  const token = await createSession(env);
  assert.equal(await verifySession(env, token), true);
});

test('会话：签名被篡改则无效', async () => {
  const token = await createSession(env);
  const parts = token.split('.');
  parts[2] = '0'.repeat(parts[2].length);
  assert.equal(await verifySession(env, parts.join('.')), false);
});

test('会话：格式错误则无效', async () => {
  assert.equal(await verifySession(env, 'not-a-token'), false);
  assert.equal(await verifySession(env, ''), false);
});

test('会话：已过期则无效', async () => {
  const now = Date.now();
  const iat = now - 2 * 24 * 60 * 60 * 1000;
  const exp = now - 24 * 60 * 60 * 1000;
  const signature = await hmacSha256Hex(env.SESSION_SECRET, `${iat}.${exp}`);
  assert.equal(await verifySession(env, `${iat}.${exp}.${signature}`), false);
});

test('会话：不同密钥签名则无效', async () => {
  const token = await createSession(env);
  assert.equal(await verifySession({ SESSION_SECRET: 'other-secret' }, token), false);
});
