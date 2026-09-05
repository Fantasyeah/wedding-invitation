// 赴约登记簿管理后台逻辑。
// 名单数据仅能通过鉴权后的 /api/admin/rsvps 获取。
(function () {
  'use strict';

  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const loginMsg = document.getElementById('login-msg');
  const loginBtn = document.getElementById('login-btn');
  const statsEl = document.getElementById('stats');
  const rsvpBody = document.getElementById('rsvp-body');
  const emptyTip = document.getElementById('empty-tip');
  const dashMsg = document.getElementById('dash-msg');

  let allRsvps = [];
  let currentFilter = 'all';

  function setLoginMsg(text, isError) {
    loginMsg.textContent = text || '';
    loginMsg.classList.toggle('error', !!isError);
  }
  function setDashMsg(text, isError) {
    dashMsg.textContent = text || '';
    dashMsg.classList.toggle('error', !!isError);
  }
  function setLoginBusy(busy) {
    loginBtn.disabled = busy;
    loginBtn.textContent = busy ? '验证中……' : '进入后台';
  }

  function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
  }
  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
  }

  const ATTENDANCE_LABEL = { attending: '参加', declined: '无法参加' };
  const ACC_LABEL = { yes: '需要', no: '不需要' };

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function renderStats(stats) {
    const s = stats || {};
    const num = (v) => (v == null ? 0 : v);
    const cards = [
      { label: '答复总数', value: num(s.total) },
      { label: '出席（组）', value: num(s.attending_parties) },
      { label: '出席（人）', value: num(s.attending_guests) },
      { label: '无法参加', value: num(s.declined) },
      { label: '住宿（组）', value: num(s.accommodation_parties) },
      { label: '住宿（人）', value: num(s.accommodation_guests) }
    ];
    statsEl.innerHTML = cards.map((c) => `<div class="stat"><b>${c.value}</b><span>${c.label}</span></div>`).join('');
  }

  function matchesFilter(rsvp) {
    if (currentFilter === 'attending') return rsvp.attendance === 'attending';
    if (currentFilter === 'declined') return rsvp.attendance === 'declined';
    if (currentFilter === 'accommodation') return rsvp.needs_accommodation === 'yes';
    return true;
  }

  function renderList() {
    const rows = allRsvps.filter(matchesFilter);
    emptyTip.hidden = rows.length > 0;
    rsvpBody.innerHTML = rows.map((r) => {
      const attendanceTag = `<span class="tag ${r.attendance}">${ATTENDANCE_LABEL[r.attendance] || r.attendance}</span>`;
      const partySize = r.attendance === 'attending' ? r.party_size : '—';
      const acc = ACC_LABEL[r.needs_accommodation] || r.needs_accommodation;
      return `<tr>
        <td>${escapeHtml(r.guest_name)}</td>
        <td>${attendanceTag}</td>
        <td>${partySize}</td>
        <td>${acc}</td>
        <td>${escapeHtml(r.phone || '')}</td>
        <td class="muted">${escapeHtml(r.message || '')}</td>
        <td class="muted">${formatTime(r.updated_at)}</td>
      </tr>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function csvCell(value) {
    const s = String(value ?? '');
    return '"' + s.replaceAll('"', '""') + '"';
  }

  function exportCsv() {
    const header = ['姓名', '是否参加', '出席人数', '是否需要住宿', '联系电话', '留言', '更新时间'];
    const lines = [header.join(',')];
    for (const r of allRsvps) {
      const row = [
        r.guest_name,
        ATTENDANCE_LABEL[r.attendance] || r.attendance,
        r.attendance === 'attending' ? r.party_size : 0,
        ACC_LABEL[r.needs_accommodation] || r.needs_accommodation,
        r.phone || '',
        r.message || '',
        formatTime(r.updated_at)
      ];
      lines.push(row.map(csvCell).join(','));
    }
    const csv = '﻿' + lines.join('\r\n'); // UTF-8 BOM，保证 Excel 中文正常
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `赴约登记_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadDashboard() {
    setDashMsg('加载中……');
    try {
      const res = await fetch('/api/admin/rsvps');
      if (res.status === 401) {
        showLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { showLogin(); return; }
        setDashMsg(data.error || '加载失败', true);
        return;
      }
      allRsvps = data.rsvps || [];
      renderStats(data.stats);
      renderList();
      showDashboard();
      setDashMsg(`共 ${allRsvps.length} 条记录`);
    } catch {
      setDashMsg('网络异常，请稍后重试', true);
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('password').value;
    setLoginBusy(true);
    setLoginMsg('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setLoginMsg('登录成功');
        await loadDashboard();
      } else {
        setLoginMsg(data.error || '登录失败', true);
      }
    } catch {
      setLoginMsg('网络异常，请稍后重试', true);
    } finally {
      setLoginBusy(false);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
    allRsvps = [];
    showLogin();
    setLoginMsg('已退出登录');
  });

  document.getElementById('refresh-btn').addEventListener('click', loadDashboard);
  document.getElementById('export-btn').addEventListener('click', exportCsv);

  document.querySelectorAll('.filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('active', b === btn));
      renderList();
    });
  });

  loadDashboard();
})();
