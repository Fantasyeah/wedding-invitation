const fallbackConfig = {
  groom: '新郎姓名',
  bride: '新娘姓名',
  weddingDate: '',
  dateDot: '日期待确认',
  dateCn: '请填写婚礼日期（星期）',
  calendarMonth: 'MON',
  calendarDay: '--',
  calendarYear: 'YEAR',
  venue: '请填写婚礼场地名称与地址',
  venueShort: '婚礼场地',
  navigationUrl: '',
  message: '春去秋来，我们决定举办一场婚礼。诚挚邀请你，来见证这一份丰收般的幸福。',
  dressCode: '盛装赴约，带上快乐与祝福',
  seasonLine: '良辰吉日 · 天气晴',
  publicTransit: '请填写公共交通说明',
  driving: '请填写自驾与停车说明',
  questMessage: '婚礼当日，一封闪闪发光的邀请函已经送达。我们也准备好邀请你了。',
  blessing: '春风暖，遇良辰。\n喝满你们的喜酒，听完一年的花。\n我们相逢这一天，把最好的故事变成回忆。',
  schedule: [
    { label: '签到', time: '待确认', description: '领取今日任务，与老朋友相见' },
    { label: '仪式', time: '待确认', description: '见证拥抱、誓言与交换戒指' },
    { label: '喜宴', time: '待确认', description: '共享一场丰盛的宴席' },
    { label: '合影', time: '待确认', description: '保存这一份快乐存档' }
  ]
};

let weddingConfig = fallbackConfig;

function renderConfig(config) {
  weddingConfig = { ...fallbackConfig, ...config };
  const values = {
    coupleAmp: `${weddingConfig.groom} & ${weddingConfig.bride}`,
    dateDot: weddingConfig.dateDot,
    dateCn: weddingConfig.dateCn,
    venue: weddingConfig.venue,
    venueShort: weddingConfig.venueShort,
    message: weddingConfig.message,
    dressCode: weddingConfig.dressCode,
    seasonLine: weddingConfig.seasonLine,
    publicTransit: weddingConfig.publicTransit,
    driving: weddingConfig.driving,
    questMessage: weddingConfig.questMessage,
    blessing: weddingConfig.blessing
  };

  document.querySelectorAll('[data-content]').forEach((element) => {
    const key = element.dataset.content;
    if (key in values) {
      if (key === 'blessing') element.innerHTML = String(values[key]).replaceAll('\n', '<br>');
      else element.textContent = values[key];
    }
    if (key === 'navigationLink') {
      if (weddingConfig.navigationUrl) {
        element.href = weddingConfig.navigationUrl;
        element.textContent = '打开地图导航';
      } else {
        element.removeAttribute('href');
        element.textContent = '地图链接待填写';
      }
    }
  });

  document.querySelector('[data-content="calendarMonth"]').textContent = weddingConfig.calendarMonth;
  document.querySelector('[data-content="calendarDay"]').textContent = weddingConfig.calendarDay;
  document.querySelector('[data-content="calendarYear"]').textContent = weddingConfig.calendarYear;

  const scheduleGrid = document.querySelector('[data-content="schedule"]');
  scheduleGrid.replaceChildren();
  weddingConfig.schedule.forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'schedule-item';
    article.innerHTML = `<span class="schedule-index">${String(index + 1).padStart(2, '0')}</span><b>${item.label}<small>${item.time}</small></b><p>${item.description}</p>`;
    scheduleGrid.append(article);
  });

  const target = weddingConfig.weddingDate ? new Date(weddingConfig.weddingDate) : null;
  const days = target && !Number.isNaN(target.getTime()) ? Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000)) : '--';
  document.querySelector('#days-count').textContent = String(days);
}

document.querySelectorAll('[data-scroll]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealElements = document.querySelectorAll('.reveal:not(.is-visible)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }), { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

const music = document.querySelector('#wedding-music');
const musicButton = document.querySelector('#music-toggle');
const audioStatus = document.querySelector('#audio-status');
music.volume = 0.2;
musicButton.addEventListener('click', async () => {
  if (music.paused) {
    try {
      await music.play();
      musicButton.classList.add('playing');
      musicButton.setAttribute('aria-pressed', 'true');
      musicButton.setAttribute('aria-label', '暂停背景音乐');
      audioStatus.textContent = '背景音乐正在播放';
    } catch (_) {
      audioStatus.textContent = '浏览器暂未允许播放背景音乐，请检查静音设置后重试';
    }
  } else {
    music.pause();
    musicButton.classList.remove('playing');
    musicButton.setAttribute('aria-pressed', 'false');
    musicButton.setAttribute('aria-label', '播放背景音乐');
    audioStatus.textContent = '背景音乐已暂停';
  }
});

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type === 'wedding-config') renderConfig(event.data.config);
  if (event.data?.type === 'scroll-top') window.scrollTo({ top: 0, behavior: 'auto' });
});

renderConfig(fallbackConfig);
window.parent.postMessage({ type: 'stardew-invitation-ready' }, '*');
