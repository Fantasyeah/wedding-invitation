// 赴约登记接口：
//   POST /api/rsvp            首次登记；带 id + editToken 时更新原记录
//   GET  /api/rsvp?id=&token= 宾客凭修改令牌读取自己的答复

import { validateRsvp } from '../_lib/validate.js';
import { sha256Hex, randomToken, constantTimeEqual } from '../_lib/crypto.js';
import { checkAndRecord } from '../_lib/rate-limit.js';
import { json, readJson, clientIp } from '../_lib/http.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 分钟
const LIMIT = 10; // 15 分钟内最多 10 次

function publicRsvp(row) {
  return {
    id: row.id,
    guest_name: row.guest_name,
    attendance: row.attendance,
    party_size: row.party_size,
    needs_accommodation: row.needs_accommodation,
    phone: row.phone,
    message: row.message,
    updated_at: row.updated_at
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return json({ error: '请求格式错误' }, 400);

  const ip = clientIp(request);
  if (!(await checkAndRecord(env, 'rsvp', ip, LIMIT, WINDOW_MS))) {
    return json({ error: '提交过于频繁，请稍后再试' }, 429);
  }

  const { ok, value, errors } = validateRsvp(body);
  if (!ok) return json({ error: '信息填写有误', fields: errors }, 422);

  const now = new Date().toISOString();
  const existingId = typeof body.id === 'string' ? body.id.trim() : '';
  const editToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';

  // 带 id + 修改令牌 -> 更新原记录
  if (existingId && editToken) {
    const existing = await env.DB.prepare('SELECT * FROM rsvps WHERE id = ?').bind(existingId).first();
    if (!existing) return json({ error: '未找到该登记' }, 404);
    if (!constantTimeEqual(existing.edit_token_hash, await sha256Hex(editToken))) {
      return json({ error: '修改凭证无效' }, 403);
    }
    await env.DB.prepare(
      `UPDATE rsvps
         SET guest_name = ?, attendance = ?, party_size = ?, needs_accommodation = ?,
             phone = ?, message = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      value.guest_name, value.attendance, value.party_size,
      value.needs_accommodation, value.phone, value.message, now, existingId
    ).run();
    return json({ ok: true, id: existingId, editToken, updated: true });
  }

  // 首次登记
  const id = crypto.randomUUID();
  const newToken = randomToken(32);
  const tokenHash = await sha256Hex(newToken);
  await env.DB.prepare(
    `INSERT INTO rsvps
       (id, guest_name, attendance, party_size, needs_accommodation, phone, message,
        edit_token_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, value.guest_name, value.attendance, value.party_size,
    value.needs_accommodation, value.phone, value.message, tokenHash, now, now
  ).run();
  return json({ ok: true, id, editToken: newToken, updated: false }, 201);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  if (!id || !token) return json({ error: '缺少参数' }, 400);

  const row = await env.DB.prepare('SELECT * FROM rsvps WHERE id = ?').bind(id).first();
  if (!row) return json({ error: '未找到该登记' }, 404);
  if (!constantTimeEqual(row.edit_token_hash, await sha256Hex(token))) {
    return json({ error: '修改凭证无效' }, 403);
  }
  return json({ ok: true, rsvp: publicRsvp(row) });
}
