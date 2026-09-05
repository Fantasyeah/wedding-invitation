// 管理后台登录：校验 ADMIN_PASSWORD，成功签发签名会话 Cookie。
// 失败次数受限流保护（15 分钟 5 次）。

import { createSession, sessionCookie, SESSION_TTL_MS } from '../../_lib/auth.js';
import { constantTimeEqual } from '../../_lib/crypto.js';
import { isLimited, record, reset } from '../../_lib/rate-limit.js';
import { json, readJson, clientIp } from '../../_lib/http.js';

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = clientIp(request);

  if (await isLimited(env, 'admin-login', ip, LIMIT, WINDOW_MS)) {
    return json({ error: '尝试次数过多，请稍后再试' }, 429);
  }

  const adminPassword = env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return json({ error: '服务未配置管理密码' }, 500);
  }

  const body = await readJson(request);
  const password = body && typeof body.password === 'string' ? body.password : '';

  if (!constantTimeEqual(password, adminPassword)) {
    await record(env, 'admin-login', ip, WINDOW_MS);
    return json({ error: '密码错误' }, 401);
  }

  await reset(env, 'admin-login', ip);
  const token = await createSession(env);
  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookie(token, { maxAgeMs: SESSION_TTL_MS })
  });
}
