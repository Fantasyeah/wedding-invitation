// 管理后台登出：清除会话 Cookie。

import { sessionCookie } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

export function onRequestPost() {
  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookie('', { clear: true })
  });
}
