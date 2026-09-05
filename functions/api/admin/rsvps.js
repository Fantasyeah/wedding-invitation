// 管理后台名单接口：仅向已登录访客返回名单数据。

import { isAdmin } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAdmin(request, env))) {
    return json({ error: '未登录' }, 401);
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';

  let sql = 'SELECT * FROM rsvps';
  const params = [];
  if (filter === 'attending') {
    sql += ' WHERE attendance = ?';
    params.push('attending');
  } else if (filter === 'declined') {
    sql += ' WHERE attendance = ?';
    params.push('declined');
  } else if (filter === 'accommodation') {
    sql += ' WHERE needs_accommodation = ?';
    params.push('yes');
  }
  sql += ' ORDER BY updated_at DESC';

  const stmt = env.DB.prepare(sql);
  const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();

  const statsRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN attendance = 'attending' THEN 1 ELSE 0 END) AS attending_parties,
       SUM(CASE WHEN attendance = 'attending' THEN party_size ELSE 0 END) AS attending_guests,
       SUM(CASE WHEN attendance = 'declined' THEN 1 ELSE 0 END) AS declined,
       SUM(CASE WHEN needs_accommodation = 'yes' THEN 1 ELSE 0 END) AS accommodation_parties,
       SUM(CASE WHEN needs_accommodation = 'yes' THEN party_size ELSE 0 END) AS accommodation_guests
     FROM rsvps`
  ).first();

  return json({ ok: true, stats: statsRow || {}, rsvps: results });
}
