// 管理后台会话：HMAC 签名的 HttpOnly Cookie。
// 签名密钥使用 SESSION_SECRET（Cloudflare Secret），不落盘、不入库。

import { hmacSha256Hex, constantTimeEqual } from './crypto.js';

export const SESSION_COOKIE_NAME = 'admin_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export async function createSession(env, now = Date.now()) {
  const iat = now;
  const exp = now + SESSION_TTL_MS;
  const body = `${iat}.${exp}`;
  const signature = await hmacSha256Hex(env.SESSION_SECRET, body);
  return `${body}.${signature}`;
}

export async function verifySession(env, token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [iat, exp, signature] = parts;
  if (!/^\d+$/.test(iat) || !/^\d+$/.test(exp)) return false;
  const expected = await hmacSha256Hex(env.SESSION_SECRET, `${iat}.${exp}`);
  if (!constantTimeEqual(expected, signature)) return false;
  return Date.now() <= Number(exp);
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function isAdmin(request, env) {
  const token = getCookie(request, SESSION_COOKIE_NAME);
  return verifySession(env, token);
}

export function sessionCookie(value, { maxAgeMs = SESSION_TTL_MS, clear = false } = {}) {
  const base = `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict`;
  if (clear) return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
  return `${base}; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}
