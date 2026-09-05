// 少量 JSON 响应辅助函数。

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
