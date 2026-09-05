// 原生赴约登记表单逻辑。
// 提交到同域 /api/rsvp，登记 ID 与修改令牌只保存在宾客浏览器 localStorage。
(function () {
  'use strict';

  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const done = document.getElementById('rsvp-done');
  const statusEl = document.getElementById('rsvp-status');
  const submitBtn = document.getElementById('rsvp-submit');
  const doneSummary = document.getElementById('rsvp-done-summary');
  const editBtn = document.getElementById('rsvp-edit-btn');

  const STORAGE_KEY = 'wedding_rsvp_v1';

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function saveSaved(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
  }

  const attendanceInputs = Array.from(form.querySelectorAll('input[name="attendance"]'));
  const partySelect = form.querySelector('select[name="party_size"]');
  const accSelect = form.querySelector('select[name="needs_accommodation"]');
  const phoneField = form.querySelector('[data-show="accommodation"]');
  const partyBlock = form.querySelector('[data-show="attending"]');

  function selectedAttendance() {
    const checked = attendanceInputs.find((el) => el.checked);
    return checked ? checked.value : null;
  }

  function refreshConditional() {
    const attending = selectedAttendance() === 'attending';
    if (partyBlock) partyBlock.hidden = !attending;
    if (phoneField) phoneField.hidden = !(attending && accSelect && accSelect.value === 'yes');

    form.querySelectorAll('.rsvp-radio').forEach((label) => {
      const input = label.querySelector('input');
      label.classList.toggle('is-checked', !!input.checked);
    });
  }

  attendanceInputs.forEach((el) => el.addEventListener('change', refreshConditional));
  if (accSelect) accSelect.addEventListener('change', refreshConditional);

  function collect() {
    const fd = new FormData(form);
    return {
      guest_name: String(fd.get('guest_name') || ''),
      attendance: String(fd.get('attendance') || ''),
      party_size: String(fd.get('party_size') || ''),
      needs_accommodation: String(fd.get('needs_accommodation') || ''),
      phone: String(fd.get('phone') || ''),
      message: String(fd.get('message') || '')
    };
  }

  function setStatus(message, isError) {
    if (statusEl) {
      statusEl.textContent = message || '';
      statusEl.classList.toggle('is-error', !!isError);
    }
  }

  function setBusy(busy) {
    if (submitBtn) {
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? '正在送往鹈鹕镇……' : submitBtn.dataset.label || '提交赴约登记';
    }
  }

  function fillForm(rsvp) {
    if (!rsvp) return;
    const nameEl = form.elements.guest_name;
    if (nameEl) nameEl.value = rsvp.guest_name || '';
    attendanceInputs.forEach((el) => { el.checked = el.value === rsvp.attendance; });
    if (partySelect && rsvp.party_size) partySelect.value = String(rsvp.party_size);
    if (accSelect && rsvp.needs_accommodation) accSelect.value = rsvp.needs_accommodation;
    if (form.elements.phone) form.elements.phone.value = rsvp.phone || '';
    if (form.elements.message) form.elements.message.value = rsvp.message || '';
    refreshConditional();
  }

  function summaryText(rsvp) {
    const name = rsvp.guest_name || '朋友';
    if (rsvp.attendance === 'declined') return `${name}，感谢告知，期待下次相聚。`;
    const size = Number(rsvp.party_size) || 0;
    const acc = rsvp.needs_accommodation === 'yes' ? '，需要住宿' : '';
    return `${name}，${size} 人出席${acc}。期待婚礼当日见！`;
  }

  function showDone(rsvp) {
    form.hidden = true;
    if (done) {
      done.hidden = false;
      if (doneSummary) doneSummary.textContent = summaryText(rsvp);
    }
  }

  function showForm() {
    if (done) done.hidden = true;
    form.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = collect();
    // 轻量前端校验：姓名与是否参加必填（服务端仍会再次校验）
    if (!payload.guest_name.trim()) {
      setStatus('请填写姓名', true);
      return;
    }
    if (payload.attendance !== 'attending' && payload.attendance !== 'declined') {
      setStatus('请选择是否参加', true);
      return;
    }

    const saved = loadSaved();
    if (saved && saved.id && saved.editToken) {
      payload.id = saved.id;
      payload.editToken = saved.editToken;
    }

    setBusy(true);
    setStatus('');
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        saveSaved({ id: data.id, editToken: data.editToken });
        setStatus('登记成功');
        showDone({
          guest_name: payload.guest_name,
          attendance: payload.attendance,
          party_size: payload.attendance === 'attending' ? payload.party_size : 0,
          needs_accommodation: payload.attendance === 'attending' ? payload.needs_accommodation : 'no'
        });
      } else {
        setStatus(data.error || '提交失败，请稍后再试', true);
      }
    } catch {
      setStatus('网络异常，请检查网络后重试', true);
    } finally {
      setBusy(false);
    }
  });

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      showForm();
      setStatus('你可以修改后重新提交');
    });
  }

  refreshConditional();

  // 初始化：若本地保存过登记，凭令牌拉取原答复并预填
  const saved = loadSaved();
  if (saved && saved.id && saved.editToken) {
    const qs = `id=${encodeURIComponent(saved.id)}&token=${encodeURIComponent(saved.editToken)}`;
    fetch(`/api/rsvp?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data && data.rsvp) {
          fillForm(data.rsvp);
          if (submitBtn) submitBtn.textContent = '更新我的答复';
          submitBtn.dataset.label = '更新我的答复';
          setStatus('已找到你的登记，可修改后重新提交');
        }
      })
      .catch(() => { /* 拉取失败则保持空白表单 */ });
  }
})();
