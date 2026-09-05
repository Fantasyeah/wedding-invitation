// 限流：使用带密钥的 IP 哈希（HMAC-SHA256）作为标识，不在数据库保存原始 IP。
// 表名由固定映射决定，不接受外部输入，无 SQL 注入风险。

import { hmacSha256Hex } from './crypto.js';

const TABLES = {
  rsvp: 'rsvp_rate_limit',
  'admin-login': 'admin_login_failures'
};

async function keyHash(env, kind, keyValue) {
  return hmacSha256Hex(env.SESSION_SECRET, `${kind}:${keyValue}`);
}

function windowStart(now, windowMs) {
  return Math.floor(now / windowMs) * windowMs;
}

// 检查并记录一次（用于 RSVP 提交）：超过 limit 返回 false，否则记录并返回 true。
export async function checkAndRecord(env, kind, keyValue, limit, windowMs, now = Date.now()) {
  const table = TABLES[kind];
  const hash = await keyHash(env, kind, keyValue);
  const start = windowStart(now, windowMs);

  const existing = await env.DB.prepare(
    `SELECT count, window_start FROM ${table} WHERE key_hash = ?`
  ).bind(hash).first();

  if (existing && existing.window_start === start && existing.count >= limit) {
    return false;
  }
  await upsert(env, table, hash, start, existing);
  return true;
}

// 仅检查是否已超限（用于管理登录前判断）。
export async function isLimited(env, kind, keyValue, limit, windowMs, now = Date.now()) {
  const table = TABLES[kind];
  const hash = await keyHash(env, kind, keyValue);
  const start = windowStart(now, windowMs);
  const existing = await env.DB.prepare(
    `SELECT count, window_start FROM ${table} WHERE key_hash = ?`
  ).bind(hash).first();
  return !!(existing && existing.window_start === start && existing.count >= limit);
}

// 记录一次（用于管理登录失败）。
export async function record(env, kind, keyValue, windowMs, now = Date.now()) {
  const table = TABLES[kind];
  const hash = await keyHash(env, kind, keyValue);
  const start = windowStart(now, windowMs);
  const existing = await env.DB.prepare(
    `SELECT count, window_start FROM ${table} WHERE key_hash = ?`
  ).bind(hash).first();
  await upsert(env, table, hash, start, existing);
}

// 重置（登录成功后清除失败计数）。
export async function reset(env, kind, keyValue) {
  const table = TABLES[kind];
  const hash = await keyHash(env, kind, keyValue);
  await env.DB.prepare(`DELETE FROM ${table} WHERE key_hash = ?`).bind(hash).run();
}

async function upsert(env, table, hash, start, existing) {
  if (existing) {
    if (existing.window_start === start) {
      await env.DB.prepare(`UPDATE ${table} SET count = count + 1 WHERE key_hash = ?`).bind(hash).run();
    } else {
      await env.DB.prepare(`UPDATE ${table} SET count = 1, window_start = ? WHERE key_hash = ?`).bind(start, hash).run();
    }
  } else {
    await env.DB.prepare(`INSERT INTO ${table} (key_hash, count, window_start) VALUES (?, 1, ?)`).bind(hash, start).run();
  }
}
