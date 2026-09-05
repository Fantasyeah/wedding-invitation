// 部署后的健康检查接口。

export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: 'rsvp' }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
