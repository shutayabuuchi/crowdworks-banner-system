/* ===== Config ===== */
const API_BASE = window.APP_CONFIG?.API_BASE || window.location.origin || 'http://localhost:8000';

/* ===== Demo Data ===== */
const DEMO_JOBS = [
  {
    job_id: 'demo-001',
    title: '【急募】ECサイト用バナー制作（728×90・300×250 各3パターン）',
    reward: '¥15,000〜¥25,000', deadline: '2026-05-20',
    client_name: '山田商事株式会社', url: '#', processed: true,
    banners: [{ count: 3 }],
    requirements: ['Photoshop', 'Illustrator', 'バナーデザイン経験'],
    description: 'ECサイトのリニューアルに伴い、バナー広告の制作をお願いします。\n対象商品：化粧品・スキンケア\nターゲット：20〜40代女性\n納期：受注後5日以内',
    attachments: [],
  },
  {
    job_id: 'demo-002',
    title: 'LP用ヘッダーバナー制作（1920×600）モダンなデザインで',
    reward: '¥8,000〜¥12,000', deadline: '2026-05-18',
    client_name: 'テックスタートアップ合同会社', url: '#', processed: false,
    banners: [],
    requirements: ['Figma', 'Webデザイン'],
    description: 'SaaSサービスのランディングページ用ヘッダーバナーです。\nブランドカラー：ブルー系\nキャッチコピーあり（別途提供）',
    attachments: [],
  },
  {
    job_id: 'demo-003',
    title: 'SNS広告バナー一式（Facebook・Instagram・Twitter 各2サイズ）',
    reward: '¥20,000〜¥35,000', deadline: '2026-05-25',
    client_name: 'デジタルマーケ株式会社', url: '#', processed: true,
    banners: [{ count: 6 }],
    requirements: ['SNS広告', 'Photoshop', 'アニメーション可'],
    description: '食品ブランドのSNS広告バナー一式。\n静止画のみ（アニメーションは任意）\n素材は支給します。',
    attachments: [],
  },
  {
    job_id: 'demo-004',
    title: 'クリスマスキャンペーン用バナー（複数サイズ・差し替えあり）',
    reward: '¥30,000〜¥50,000', deadline: '2026-06-01',
    client_name: 'リテール企業A社', url: '#', processed: false,
    banners: [],
    requirements: ['Illustrator', 'バナーデザイン', '修正対応可'],
    description: 'クリスマスシーズンに向けたキャンペーンバナーの制作です。\n全6サイズ×3パターン＝18点\n修正は3回まで対応可能な方を希望。',
    attachments: [],
  },
];

/* ===== State ===== */
const state = {
  jobs: [],
  filteredJobs: [],
  selectedJobIds: new Set(),
  selectedJob: null,
  analyzedJob: null,
  banners: [],
  allBanners: [],
  selectedBanner: null,
  applicationText: null,
  currentTab: 'jobs',
  demoMode: false,
  jobFilter: 'all',
  jobSearch: '',
  bannerFilter: 'all',
  bulkRunning: false,
  bulkCancelRequested: false,
  bulkCurrentJobId: null,
  bulkCurrentStep: '',
  bulkController: null,
};

/* ===== API ===== */
async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const merged = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (opts.body && typeof opts.body === 'object') merged.body = JSON.stringify(opts.body);
  const res = await fetch(url, merged);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.detail || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

const fetchJobs       = ()          => apiFetch('/jobs/');
const fetchJob        = id          => apiFetch(`/jobs/${id}`);
const scrapeJobs      = ()          => apiFetch('/jobs/scrape', { method: 'POST' });
const analyzeJob      = (id, opts = {})   => apiFetch(`/jobs/${id}/analyze`, { method: 'POST', ...opts });
const generatePrompts = (body, opts = {}) => apiFetch('/prompts/generate', { method: 'POST', body, ...opts });
const generateBanners = (jobId, opts = {}) => apiFetch('/banners/generate', { method: 'POST', body: { job_id: jobId }, ...opts });
const fetchBanners    = jobId       => apiFetch(`/banners/${jobId}`);
const updateBannerStatus = (id, s)  => apiFetch(`/banners/${id}/status`, { method: 'PATCH', body: { status: s } });
const generateAppText = body        => apiFetch('/application_texts/generate', { method: 'POST', body });

/* ===== Toast ===== */
function showToast(type, title, message = '', duration = 4000) {
  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  };
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><div><div class="toast-title">${esc(title)}</div>${message ? `<div class="toast-message">${esc(message)}</div>` : ''}</div>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 250); }, duration);
}

/* ===== Button loading helper ===== */
function btnLoading(btn, on, text) {
  if (on) {
    if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text || '処理中...'}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig || btn.innerHTML;
    delete btn.dataset.orig;
    btn.disabled = false;
  }
}

/* ===== Tab ===== */
function switchTab(name) {
  state.currentTab = name;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
  document.querySelectorAll('.tab-panels').forEach(el => el.classList.toggle('active', el.id === `tab-${name}`));
  const titles = { jobs: 'ジョブ一覧', banners: 'バナー管理', applications: '応募文生成' };
  document.getElementById('topBarTitle').textContent = titles[name] || '';
}

/* ===== Jobs ===== */
async function loadJobs() {
  const listEl = document.getElementById('jobList');
  listEl.innerHTML = `<div class="loading-state"><span class="spinner spinner-lg"></span><span class="loading-text">読み込み中...</span></div>`;
  try {
    const jobs = await fetchJobs();
    state.jobs = jobs;
    state.selectedJobIds = new Set([...state.selectedJobIds].filter(id => jobs.some(j => j.job_id === id)));
    state.demoMode = false;
    document.getElementById('demoBanner').style.display = 'none';
  } catch (_) {
    state.jobs = DEMO_JOBS;
    state.demoMode = true;
    document.getElementById('demoBanner').style.display = 'flex';
  }
  applyJobFilter();
  updateStats(state.jobs);
  updateBulkActions();
  document.getElementById('navJobCount').textContent = state.jobs.length;
}

function applyJobFilter() {
  const q = state.jobSearch.toLowerCase();
  const f = state.jobFilter;

  state.filteredJobs = state.jobs.filter(j => {
    const matchSearch = !q || j.title.toLowerCase().includes(q) || (j.client_name || '').toLowerCase().includes(q);
    const bannerCount = getBannerCount(j);
    const matchFilter =
      f === 'all'       ? true :
      f === 'pending'   ? !j.processed :
      f === 'processed' ? j.processed :
      f === 'banners'   ? bannerCount > 0 : true;
    return matchSearch && matchFilter;
  });

  updateFilterCounts();
  renderJobList(state.filteredJobs);
}

function updateFilterCounts() {
  const jobs = state.jobs;
  document.getElementById('filterAllCount').textContent       = jobs.length;
  document.getElementById('filterPendingCount').textContent   = jobs.filter(j => !j.processed).length;
  document.getElementById('filterProcessedCount').textContent = jobs.filter(j => j.processed).length;
  document.getElementById('filterBannerCount').textContent    = jobs.filter(j => getBannerCount(j) > 0).length;
}

function updateStats(jobs) {
  const bannerJobs = jobs.filter(j => getBannerCount(j) > 0).length;
  document.getElementById('statTotal').textContent     = jobs.length;
  document.getElementById('statProcessed').textContent = jobs.filter(j => j.processed).length;
  document.getElementById('statBanners').textContent   = bannerJobs;
}

function getBannerCount(job) {
  if (!Array.isArray(job?.banners)) return 0;
  if (job.banners.length === 1 && typeof job.banners[0]?.count === 'number') {
    return job.banners[0].count;
  }
  return job.banners.length;
}

function renderJobList(jobs) {
  const el = document.getElementById('jobList');
  if (!jobs || jobs.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg></div>
        <div class="empty-title">${state.jobSearch ? '該当する案件がありません' : 'ジョブがありません'}</div>
        <div class="empty-desc">${state.jobSearch ? '検索条件を変えてお試しください。' : '「スクレイプ開始」から案件を取得してください。'}</div>
      </div>`;
    return;
  }

  el.innerHTML = jobs.map(job => {
    const bannerCount = getBannerCount(job);
    const jobUrl = job.url && job.url !== '#' ? job.url : '';
    const checked = state.selectedJobIds.has(job.job_id) ? 'checked' : '';
    const isGenerating = state.bulkCurrentJobId === job.job_id;
    const cardClasses = [
      'job-card',
      state.selectedJob?.job_id === job.job_id ? 'selected' : '',
      checked ? 'queued' : '',
      isGenerating ? 'generating' : '',
    ].filter(Boolean).join(' ');
    return `
      <div class="${cardClasses}" role="button" tabindex="0" aria-label="${esc(job.title)}の詳細を開く" onclick="openJobDetail('${job.job_id}')" onkeydown="handleJobCardKey(event, '${job.job_id}')">
        <label class="job-select" onclick="event.stopPropagation();" title="一括生成に含める">
          <input type="checkbox" ${checked} ${state.bulkRunning ? 'disabled' : ''} onchange="toggleJobSelection('${job.job_id}', this.checked)">
          <span></span>
        </label>
        <div class="job-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M3 9h18M9 21V9"/></svg>
        </div>
        <div class="job-card-body">
          <div class="job-card-title" title="${esc(job.title)}">${esc(job.title)}</div>
          <div class="job-card-meta">
            <span class="meta-item">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg>
              ${esc(job.reward)}
            </span>
            ${job.deadline ? `<span class="meta-item"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>${esc(job.deadline)}</span>` : ''}
            ${job.client_name ? `<span class="meta-item">${esc(job.client_name)}</span>` : ''}
            ${jobUrl ? `<a class="meta-item job-url-link" href="${esc(jobUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" title="${esc(jobUrl)}">
              <svg viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
              <span>${esc(jobUrl)}</span>
            </a>` : ''}
          </div>
        </div>
        <div class="job-card-actions">
          ${isGenerating ? `<span class="job-generating-badge"><span class="spinner"></span>${esc(state.bulkCurrentStep || '生成中')}</span>` : ''}
          <span class="badge ${job.processed ? 'badge-processed' : 'badge-pending'}">${job.processed ? '処理済み' : '未処理'}</span>
          ${bannerCount > 0 ? `<span class="badge badge-new">${bannerCount} バナー</span>` : ''}
        </div>
      </div>`;
  }).join('');
  updateBulkActions();
}

function handleJobCardKey(event, jobId) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openJobDetail(jobId);
}

function selectJob(jobId) {
  state.selectedJob = state.jobs.find(j => j.job_id === jobId) || null;
  renderJobList(state.filteredJobs);
}

async function openJobDetail(jobId) {
  try {
    const job = await fetchJob(jobId);
    state.selectedJob = job;
  } catch (_) {
    state.selectedJob = state.jobs.find(j => j.job_id === jobId) || null;
  }
  renderJobList(state.filteredJobs);
  if (state.selectedJob) showDetailPanel(state.selectedJob);
}

function showDetailPanel(job) {
  document.getElementById('detailTitle').textContent  = job.title;
  document.getElementById('detailReward').textContent  = job.reward || '—';
  document.getElementById('detailDeadline').textContent = job.deadline || '—';
  document.getElementById('detailClient').textContent  = job.client_name || '—';
  document.getElementById('detailUrl').innerHTML       = job.url && job.url !== '#'
    ? `<a href="${esc(job.url)}" target="_blank" rel="noopener">${esc(job.url)}</a>`
    : '<span class="text-muted">—</span>';
  document.getElementById('detailDesc').textContent    = job.description || '説明なし';

  const reqEl = document.getElementById('detailRequirements');
  reqEl.innerHTML = job.requirements?.length
    ? job.requirements.map(r => `<span class="tag tag-gray">${esc(r)}</span>`).join('')
    : '<span class="text-muted">なし</span>';

  const attEl = document.getElementById('detailAttachments');
  attEl.innerHTML = job.attachments?.length
    ? job.attachments.map(a => `<span class="tag"><a href="${esc(a.file_url)}" target="_blank" style="color:inherit">${esc(a.file_name)}</a></span>`).join('')
    : '<span class="text-muted">なし</span>';

  ['step-analyze','step-prompts','step-banners'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('done','active');
    el.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12zm-.5-9.5a.5.5 0 011 0v3.79l2.146 2.147a.5.5 0 01-.707.707L7.646 8.854A.5.5 0 017.5 8.5V4.5z"/></svg>`;
  });

  document.getElementById('overlay').classList.add('show');
  document.getElementById('detailPanel').classList.add('open');
}

function closeDetailPanel() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('detailPanel').classList.remove('open');
}

function toggleJobSelection(jobId, checked) {
  if (checked) {
    state.selectedJobIds.add(jobId);
  } else {
    state.selectedJobIds.delete(jobId);
  }
  updateBulkActions();
  renderJobList(state.filteredJobs);
}

function toggleVisibleJobs(checked) {
  state.filteredJobs.forEach(job => {
    if (checked) state.selectedJobIds.add(job.job_id);
    else state.selectedJobIds.delete(job.job_id);
  });
  updateBulkActions();
  renderJobList(state.filteredJobs);
}

function updateBulkActions() {
  const count = state.selectedJobIds.size;
  const countEl = document.getElementById('selectedJobCount');
  const btn = document.getElementById('btnBulkGenerate');
  const cancelBtn = document.getElementById('btnBulkCancel');
  const progress = document.getElementById('bulkProgress');
  const progressText = document.getElementById('bulkProgressText');
  const selectVisible = document.getElementById('selectVisibleJobs');
  if (countEl) countEl.textContent = count;
  if (btn) btn.disabled = count === 0 || state.bulkRunning;
  if (cancelBtn) cancelBtn.style.display = state.bulkRunning ? 'inline-flex' : 'none';
  if (progress) progress.style.display = state.bulkRunning ? 'inline-flex' : 'none';
  if (progressText) progressText.textContent = state.bulkCurrentStep || '生成中...';
  if (selectVisible) {
    selectVisible.disabled = state.bulkRunning;
    const visibleIds = state.filteredJobs.map(job => job.job_id);
    const selectedVisible = visibleIds.filter(id => state.selectedJobIds.has(id)).length;
    selectVisible.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    selectVisible.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
  }
}

function setBulkProgress(jobId, step) {
  state.bulkCurrentJobId = jobId;
  state.bulkCurrentStep = step;
  updateBulkActions();
  renderJobList(state.filteredJobs);
}

function cancelBulkPipeline() {
  if (!state.bulkRunning) return;
  state.bulkCancelRequested = true;
  state.bulkCurrentStep = 'キャンセル中...';
  if (state.bulkController) state.bulkController.abort();
  updateBulkActions();
  renderJobList(state.filteredJobs);
  showToast('warning', 'キャンセルします', '現在の通信を止めて、一括生成を終了します。');
}

async function startScrape() {
  const btn = document.getElementById('btnScrape');
  btnLoading(btn, true, 'スクレイプ中...');
  try {
    await scrapeJobs();
    showToast('info', 'スクレイプ開始', 'バックグラウンドで案件を取得中です。');
    setTimeout(loadJobs, 5000);
    setTimeout(loadJobs, 15000);
  } catch (e) {
    showToast('error', 'スクレイプエラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

/* ===== Pipeline ===== */
async function runFullPipeline(jobId) {
  const btn = document.getElementById('btnRunPipeline');
  btnLoading(btn, true, '分析中...');

  const stepDone = id => {
    const el = document.getElementById(id);
    el.classList.remove('active'); el.classList.add('done');
    el.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  };
  const stepActive = id => document.getElementById(id).classList.add('active');

  try {
    stepActive('step-analyze');
    showToast('info', 'ステップ 1/3', 'Claude で案件を分析中...');
    const analyzed = await analyzeJob(jobId);
    state.analyzedJob = analyzed;
    stepDone('step-analyze');

    stepActive('step-prompts');
    btnLoading(btn, true, 'プロンプト生成中...');
    showToast('info', 'ステップ 2/3', 'Gemini でプロンプトを生成中...');
    await generatePrompts(analyzed);
    stepDone('step-prompts');

    stepActive('step-banners');
    btnLoading(btn, true, 'バナー生成中...');
    showToast('info', 'ステップ 3/3', 'DALL-E 3 でバナーを生成中...');
    const banners = await generateBanners(jobId);
    state.banners = banners;
    stepDone('step-banners');

    showToast('success', '完了！', `${banners.length} 枚のバナーが生成されました。`);
    closeDetailPanel();
    switchTab('banners');
    await loadJobs();
    await loadAllBanners();
  } catch (e) {
    showToast('error', 'パイプラインエラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

async function runBulkPipeline() {
  const ids = [...state.selectedJobIds].filter(id => state.jobs.some(job => job.job_id === id));
  if (ids.length === 0) {
    showToast('warning', '案件を選択してください');
    return;
  }

  const btn = document.getElementById('btnBulkGenerate');
  state.bulkRunning = true;
  state.bulkCancelRequested = false;
  state.bulkCurrentJobId = null;
  state.bulkCurrentStep = `0/${ids.length} 生成準備中...`;
  btnLoading(btn, true, `0/${ids.length} 生成中...`);
  updateBulkActions();
  renderJobList(state.filteredJobs);
  const failures = [];
  let completed = 0;
  let canceled = false;

  for (let i = 0; i < ids.length; i++) {
    if (state.bulkCancelRequested) {
      canceled = true;
      break;
    }

    const jobId = ids[i];
    const job = state.jobs.find(j => j.job_id === jobId);
    state.bulkController = new AbortController();
    btnLoading(btn, true, `${i + 1}/${ids.length} 生成中...`);
    showToast('info', `一括生成 ${i + 1}/${ids.length}`, job?.title || jobId, 2500);
    try {
      setBulkProgress(jobId, `${i + 1}/${ids.length} 分析中`);
      const analyzed = await analyzeJob(jobId, { signal: state.bulkController.signal });

      if (state.bulkCancelRequested) {
        canceled = true;
        break;
      }

      setBulkProgress(jobId, `${i + 1}/${ids.length} プロンプト生成中`);
      await generatePrompts(analyzed, { signal: state.bulkController.signal });

      if (state.bulkCancelRequested) {
        canceled = true;
        break;
      }

      setBulkProgress(jobId, `${i + 1}/${ids.length} バナー生成中`);
      await generateBanners(jobId, { signal: state.bulkController.signal });
      state.selectedJobIds.delete(jobId);
      completed++;
    } catch (e) {
      if (e.name === 'AbortError' || state.bulkCancelRequested) {
        canceled = true;
        break;
      }
      failures.push(`${job?.title || jobId}: ${e.message}`);
    } finally {
      state.bulkController = null;
    }
  }

  state.bulkRunning = false;
  state.bulkCancelRequested = false;
  state.bulkCurrentJobId = null;
  state.bulkCurrentStep = '';
  state.bulkController = null;
  btnLoading(btn, false);
  await loadJobs();
  await loadAllBanners();

  if (canceled) {
    showToast('warning', '一括生成をキャンセルしました', `${completed}件完了しました。`, 7000);
  } else if (failures.length) {
    showToast('warning', '一括生成が一部失敗しました', `${completed}件完了 / ${failures.length}件失敗`, 7000);
    console.warn('Bulk generation failures:', failures);
  } else {
    showToast('success', '一括生成完了', `${completed}件のバナー生成まで完了しました。`);
    switchTab('banners');
    await loadAllBanners();
  }
}

/* ===== Banners ===== */
function populateBannerJobSelect() {
  const sel = document.getElementById('bannerJobSelect');
  if (!sel) return;
  sel.innerHTML = `<option value="">-- ジョブを選択 --</option>` +
    state.jobs.map(j => `<option value="${j.job_id}">${esc(j.title.substring(0,60))}</option>`).join('');
}

async function loadAllBanners() {
  const grid = document.getElementById('bannerGrid');
  grid.innerHTML = `<div class="loading-state"><span class="spinner spinner-lg"></span><span class="loading-text">バナーを読み込み中...</span></div>`;
  try {
    const groups = await Promise.all(state.jobs.map(async job => {
      const banners = await fetchBanners(job.job_id);
      return { job, banners: banners.map(b => ({ ...b, job_title: job.title, job_url: job.url })) };
    }));
    state.allBanners = groups.flatMap(group => group.banners);
    state.bannerFilter = 'all';
    document.querySelectorAll('[data-bfilter]').forEach(b => b.classList.toggle('active', b.dataset.bfilter === 'all'));
    renderBannerGroups(groups);
  } catch (e) {
    showToast('error', 'バナー取得エラー', e.message);
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">エラー</div><div class="empty-desc">${esc(e.message)}</div></div>`;
  }
}

async function loadBannersForJob(jobId) {
  const grid = document.getElementById('bannerGrid');
  if (!jobId) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg></div><div class="empty-title">ジョブを選択してください</div></div>`;
    return;
  }
  grid.innerHTML = `<div class="loading-state"><span class="spinner spinner-lg"></span><span class="loading-text">バナーを読み込み中...</span></div>`;
  try {
    const banners = await fetchBanners(jobId);
    state.allBanners = banners;
    state.bannerFilter = 'all';
    document.querySelectorAll('[data-bfilter]').forEach(b => b.classList.toggle('active', b.dataset.bfilter === 'all'));
    renderBannerGrid(banners, jobId);
  } catch (e) {
    showToast('error', 'バナー取得エラー', e.message);
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">エラー</div><div class="empty-desc">${esc(e.message)}</div></div>`;
  }
}

function applyBannerFilter() {
  const f = state.bannerFilter;
  const groups = state.jobs.map(job => ({
    job,
    banners: state.allBanners.filter(b => b.job_id === job.job_id && (f === 'all' || b.status === f)),
  }));
  renderBannerGroups(groups);
}

function renderBannerGroups(groups) {
  const grid = document.getElementById('bannerGrid');
  const visibleGroups = groups.filter(group => group.banners.length > 0);
  if (visibleGroups.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg></div>
        <div class="empty-title">バナーがまだありません</div>
        <div class="empty-desc">案件一覧で生成したバナーが、案件ごとにここへ表示されます。</div>
      </div>`;
    return;
  }

  grid.innerHTML = visibleGroups.map(group => `
    <section class="banner-job-section">
      <div class="banner-job-header">
        <div>
          <div class="banner-job-title">${esc(group.job.title)}</div>
          <div class="banner-job-meta">${esc(group.job.reward || '—')} ${group.job.client_name ? `・ ${esc(group.job.client_name)}` : ''}</div>
        </div>
        ${group.job.url ? `<a class="btn btn-ghost btn-sm" href="${esc(group.job.url)}" target="_blank" rel="noopener">案件を見る</a>` : ''}
      </div>
      <div class="banner-grid">${group.banners.map(b => renderBannerCard(b)).join('')}</div>
    </section>
  `).join('');
}

function renderBannerGrid(banners, jobId) {
  const grid = document.getElementById('bannerGrid');
  if (!banners || banners.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg></div>
        <div class="empty-title">バナーがありません</div>
        <div class="empty-desc">このジョブのバナーはまだ生成されていません。</div>
        ${jobId ? `<button class="btn btn-primary" onclick="runGenerateBannersOnly('${jobId}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
          バナーを今すぐ生成
        </button>` : ''}
      </div>`;
    return;
  }
  grid.innerHTML = `<div class="banner-grid">${banners.map(b => renderBannerCard(b)).join('')}</div>`;
}

function renderBannerCard(banner) {
  const statusBadge = {
    generated: '<span class="badge badge-generated">生成済み</span>',
    approved:  '<span class="badge badge-approved">承認済み</span>',
    rejected:  '<span class="badge badge-rejected">却下</span>',
  }[banner.status] || '<span class="badge badge-generated">生成済み</span>';

  return `
    <div class="banner-card${state.selectedBanner?.banner_id === banner.banner_id ? ' selected-banner' : ''}" id="bcard-${banner.banner_id}">
      <div class="banner-image-wrap" onclick="openImageModal('${esc(banner.image_url)}')">
        ${banner.image_url
          ? `<img src="${esc(banner.image_url)}" alt="Banner" loading="lazy"
              onerror="this.parentElement.innerHTML='<div class=\\'banner-image-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909\\'/></svg><span>読み込み失敗</span></div>'">`
          : `<div class="banner-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909"/></svg></div>`
        }
        <div class="banner-zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0zM10.5 7.5v6m3-3h-6"/></svg></div>
      </div>
      <div class="banner-footer">
        <div>
          <div class="banner-taste">${esc(banner.design_taste || '—')}</div>
          <div style="margin-top:3px">${statusBadge}</div>
        </div>
        <div class="banner-actions">
          <button class="btn btn-success btn-sm" onclick="approveBanner('${banner.banner_id}')">承認</button>
          <button class="btn btn-danger btn-sm" onclick="rejectBanner('${banner.banner_id}')">却下</button>
          <button class="btn btn-ghost btn-sm" onclick="selectBannerForApp('${banner.banner_id}')" title="応募文へ">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 000 2h3a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
            応募文
          </button>
        </div>
      </div>
    </div>`;
}

async function approveBanner(id) {
  try {
    await updateBannerStatus(id, 'approved');
    showToast('success', '承認しました');
    await loadAllBanners();
  } catch (e) { showToast('error', 'エラー', e.message); }
}

async function rejectBanner(id) {
  try {
    await updateBannerStatus(id, 'rejected');
    showToast('info', '却下しました');
    await loadAllBanners();
  } catch (e) { showToast('error', 'エラー', e.message); }
}

function selectBannerForApp(bannerId) {
  state.selectedBanner = state.allBanners.find(b => b.banner_id === bannerId) || null;
  showToast('info', '応募文タブへ移動', 'バナーを選択しました。');
  switchTab('applications');
  populateAppTab();
}

async function runGenerateBannersOnly(jobId) {
  const btn = event.target.closest('button');
  if (btn) btnLoading(btn, true, '生成中...');
  try {
    showToast('info', 'バナー生成中', 'DALL-E 3 でバナーを生成中...');
    const banners = await generateBanners(jobId);
    state.allBanners = banners;
    await loadAllBanners();
    showToast('success', '完了', `${banners.length} 枚のバナーが生成されました。`);
  } catch (e) {
    showToast('error', 'エラー', e.message);
    if (btn) btnLoading(btn, false);
  }
}

/* ===== Image Modal ===== */
function openImageModal(url) {
  if (!url || url === '#') return;
  document.getElementById('imgModalImg').src = url;
  document.getElementById('imgModal').classList.add('open');
}
function closeImageModal() { document.getElementById('imgModal').classList.remove('open'); }

/* ===== Applications ===== */
function populateAppTab() {
  const jobSel = document.getElementById('appJobSelect');
  jobSel.innerHTML = `<option value="">-- ジョブを選択 --</option>` +
    state.jobs.map(j => `<option value="${j.job_id}"${state.selectedJob?.job_id === j.job_id ? ' selected' : ''}>${esc(j.title.substring(0,60))}</option>`).join('');

  const bSel = document.getElementById('appBannerSelect');
  bSel.innerHTML = state.allBanners.length
    ? `<option value="">-- バナーを選択 --</option>` + state.allBanners.map(b =>
        `<option value="${b.banner_id}"${state.selectedBanner?.banner_id === b.banner_id ? ' selected' : ''}>${b.design_taste} (${b.status})</option>`).join('')
    : `<option value="">バナーがありません</option>`;

  updateBannerPreview();
}

async function loadBannersForAppTab(jobId) {
  if (!jobId) return;
  state.selectedJob = state.jobs.find(j => j.job_id === jobId) || state.selectedJob;
  try {
    const banners = await fetchBanners(jobId);
    state.allBanners = banners;
    const sel = document.getElementById('appBannerSelect');
    sel.innerHTML = banners.length
      ? `<option value="">-- バナーを選択 --</option>` + banners.map(b =>
          `<option value="${b.banner_id}">${b.design_taste} (${b.status})</option>`).join('')
      : `<option value="">バナーがありません</option>`;
    updateBannerPreview();
  } catch (e) { showToast('error', 'バナー取得エラー', e.message); }
}

function updateBannerPreview() {
  const bannerId = document.getElementById('appBannerSelect').value;
  const banner = state.allBanners.find(b => b.banner_id === bannerId);
  const previewWrap = document.getElementById('appBannerPreview');
  const previewImg  = document.getElementById('appBannerPreviewImg');
  if (banner?.image_url) {
    previewImg.src = banner.image_url;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
  }
}

async function generateApplicationText() {
  const jobId    = document.getElementById('appJobSelect').value;
  const bannerId = document.getElementById('appBannerSelect').value;
  if (!jobId || !bannerId) {
    showToast('warning', '選択が必要です', 'ジョブとバナーを両方選んでください。');
    return;
  }
  const banner = state.allBanners.find(b => b.banner_id === bannerId);
  const job    = state.jobs.find(j => j.job_id === jobId);
  const btn    = document.getElementById('btnGenAppText');
  btnLoading(btn, true, '生成中...');

  try {
    let analyzed = state.analyzedJob;
    if (!analyzed || analyzed.job_id !== jobId) {
      try { analyzed = await analyzeJob(jobId); state.analyzedJob = analyzed; } catch (_) {}
    }
    const result = await generateAppText({
      job_id: jobId, selected_banner_id: bannerId,
      job_details: {
        title: job?.title || '', reward: job?.reward || '',
        target_audience: analyzed?.target_audience || '',
        purpose: analyzed?.purpose || '',
        banner_size: analyzed?.banner_size || '',
        key_phrases: analyzed?.key_phrases || [],
      },
      banner_details: { design_taste: banner?.design_taste || '', banner_id: bannerId },
    });
    state.applicationText = result;
    document.getElementById('appTextContent').textContent = result.text_content;
    document.getElementById('appTextContainer').style.display = 'block';
    document.getElementById('appTextEmpty').style.display = 'none';
    showToast('success', '応募文を生成しました', 'コピーしてクラウドワークスに貼り付けてください。');
  } catch (e) {
    showToast('error', '生成エラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

function copyAppText() {
  const text = document.getElementById('appTextContent').textContent;
  navigator.clipboard.writeText(text)
    .then(() => showToast('success', 'コピーしました'))
    .catch(() => showToast('error', 'コピー失敗', 'ブラウザの権限を確認してください。'));
}

/* ===== Utility ===== */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {

  // Tab nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      switchTab(tab);
      if (tab === 'banners') {
        loadAllBanners();
      } else if (tab === 'applications') {
        populateAppTab();
      }
    });
  });

  // Top bar buttons
  document.getElementById('btnScrape').addEventListener('click', startScrape);
  document.getElementById('btnRefresh').addEventListener('click', loadJobs);
  document.getElementById('btnBulkGenerate').addEventListener('click', runBulkPipeline);
  document.getElementById('btnBulkCancel').addEventListener('click', cancelBulkPipeline);
  document.getElementById('selectVisibleJobs').addEventListener('change', e => toggleVisibleJobs(e.target.checked));

  // Detail panel
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetailPanel);
  document.getElementById('btnCloseDetail2').addEventListener('click', closeDetailPanel);
  document.getElementById('overlay').addEventListener('click', closeDetailPanel);
  document.getElementById('btnRunPipeline').addEventListener('click', () => {
    if (state.selectedJob) runFullPipeline(state.selectedJob.job_id);
  });

  // Job search
  const searchInput = document.getElementById('jobSearch');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', e => {
    state.jobSearch = e.target.value;
    searchClear.style.display = state.jobSearch ? 'flex' : 'none';
    applyJobFilter();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.jobSearch = '';
    searchClear.style.display = 'none';
    applyJobFilter();
  });

  // Job filter pills
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.jobFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
      applyJobFilter();
    });
  });

  // Banner job select (legacy, when present)
  const bannerJobSelect = document.getElementById('bannerJobSelect');
  if (bannerJobSelect) bannerJobSelect.addEventListener('change', e => loadBannersForJob(e.target.value));

  // Banner filter pills
  document.querySelectorAll('[data-bfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bannerFilter = btn.dataset.bfilter;
      document.querySelectorAll('[data-bfilter]').forEach(b => b.classList.toggle('active', b === btn));
      applyBannerFilter();
    });
  });

  // App tab
  document.getElementById('appJobSelect').addEventListener('change', e => loadBannersForAppTab(e.target.value));
  document.getElementById('appBannerSelect').addEventListener('change', updateBannerPreview);
  document.getElementById('btnGenAppText').addEventListener('click', generateApplicationText);
  document.getElementById('btnCopyAppText').addEventListener('click', copyAppText);

  // Image modal
  document.getElementById('imgModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeImageModal(); });
  document.getElementById('imgModalClose').addEventListener('click', closeImageModal);

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetailPanel(); closeImageModal(); }
  });

  // Boot
  switchTab('jobs');
  loadJobs();
});
