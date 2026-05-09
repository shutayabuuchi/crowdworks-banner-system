/* ===== Configuration ===== */
const API_BASE = window.APP_CONFIG?.API_BASE || window.location.origin || 'http://localhost:8000';

/* ===== Demo Data ===== */
const DEMO_JOBS = [
  {
    job_id: 'demo-001',
    title: '【急募】ECサイト用バナー制作（728×90・300×250 各3パターン）',
    reward: '¥15,000〜¥25,000',
    deadline: '2026-05-20',
    client_name: '山田商事株式会社',
    url: '#',
    processed: true,
    banners: [{ count: 3 }],
    requirements: ['Photoshop', 'Illustrator', 'バナーデザイン経験'],
    description: 'ECサイトのリニューアルに伴い、バナー広告の制作をお願いします。\n対象商品：化粧品・スキンケア\nターゲット：20〜40代女性\n納期：受注後5日以内',
    attachments: []
  },
  {
    job_id: 'demo-002',
    title: 'LP用ヘッダーバナー制作（1920×600）モダンなデザインで',
    reward: '¥8,000〜¥12,000',
    deadline: '2026-05-18',
    client_name: 'テックスタートアップ合同会社',
    url: '#',
    processed: false,
    banners: [],
    requirements: ['Figma', 'Web デザイン'],
    description: 'SaaSサービスのランディングページ用ヘッダーバナーです。\nブランドカラー：ブルー系\nキャッチコピーあり（別途提供）',
    attachments: []
  },
  {
    job_id: 'demo-003',
    title: 'SNS広告バナー一式（Facebook・Instagram・Twitter 各2サイズ）',
    reward: '¥20,000〜¥35,000',
    deadline: '2026-05-25',
    client_name: 'デジタルマーケ株式会社',
    url: '#',
    processed: true,
    banners: [{ count: 6 }],
    requirements: ['SNS広告', 'Photoshop', 'アニメーション可'],
    description: '食品ブランドのSNS広告バナー一式。\n静止画のみ（アニメーションは任意）\n素材は支給します。',
    attachments: []
  },
  {
    job_id: 'demo-004',
    title: 'クリスマスキャンペーン用バナー（複数サイズ、差し替えあり）',
    reward: '¥30,000〜¥50,000',
    deadline: '2026-06-01',
    client_name: 'リテール企業A社',
    url: '#',
    processed: false,
    banners: [],
    requirements: ['Illustrator', 'バナーデザイン', '修正対応可'],
    description: 'クリスマスシーズンに向けたキャンペーンバナーの制作です。\n全6サイズ×3パターン＝18点\n修正は3回まで対応可能な方を希望。',
    attachments: []
  },
];

/* ===== State ===== */
const state = {
  jobs: [],
  selectedJob: null,
  analyzedJob: null,
  prompts: [],
  banners: [],
  selectedBanner: null,
  applicationText: null,
  currentTab: 'jobs',
  demoMode: false,
  loading: {
    jobs: false,
    scrape: false,
    analyze: false,
    prompts: false,
    banners: false,
    appText: false,
  },
};

/* ===== API Helpers ===== */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' },
  };
  const mergedOptions = { ...defaultOptions, ...options };
  if (options.body && typeof options.body === 'object') {
    mergedOptions.body = JSON.stringify(options.body);
  }
  const resp = await fetch(url, mergedOptions);
  if (!resp.ok) {
    let errorMsg = `HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      errorMsg = err.detail || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return resp.json();
}

async function scrapeJobs() {
  return apiFetch('/jobs/scrape', { method: 'POST' });
}

async function fetchJobs() {
  return apiFetch('/jobs/');
}

async function fetchJob(jobId) {
  return apiFetch(`/jobs/${jobId}`);
}

async function analyzeJob(jobId) {
  return apiFetch(`/jobs/${jobId}/analyze`, { method: 'POST' });
}

async function generatePrompts(analyzedJob) {
  return apiFetch('/prompts/generate', { method: 'POST', body: analyzedJob });
}

async function generateBanners(jobId) {
  return apiFetch('/banners/generate', { method: 'POST', body: { job_id: jobId } });
}

async function fetchBanners(jobId) {
  return apiFetch(`/banners/${jobId}`);
}

async function updateBannerStatus(bannerId, status) {
  return apiFetch(`/banners/${bannerId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

async function generateAppText(payload) {
  return apiFetch('/application_texts/generate', { method: 'POST', body: payload });
}

/* ===== Toast Notifications ===== */
function showToast(type, title, message = '', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const id = `toast-${Date.now()}`;

  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = id;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ===== Loading State Helpers ===== */
function setLoading(key, val) {
  state.loading[key] = val;
}

function btnLoading(btnEl, loading, text) {
  if (loading) {
    btnEl.dataset.origText = btnEl.innerHTML;
    btnEl.innerHTML = `<span class="spinner"></span> ${text || '処理中...'}`;
    btnEl.disabled = true;
  } else {
    btnEl.innerHTML = btnEl.dataset.origText || btnEl.innerHTML;
    btnEl.disabled = false;
  }
}

/* ===== Tab Switching ===== */
function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panels').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  updateTopBarTitle(tabName);
}

function updateTopBarTitle(tab) {
  const titles = {
    jobs: 'ジョブ一覧',
    banners: 'バナー生成・管理',
    applications: '応募文生成',
  };
  const el = document.getElementById('topBarTitle');
  if (el) el.textContent = titles[tab] || '';
}

/* ===== Jobs Tab ===== */
async function loadJobs() {
  const listEl = document.getElementById('jobList');
  listEl.innerHTML = `<div class="loading-overlay"><span class="spinner spinner-lg"></span><span class="loading-text">ジョブを読み込んでいます...</span></div>`;

  try {
    const jobs = await fetchJobs();
    state.jobs = jobs;
    state.demoMode = false;
    document.getElementById('demoBanner').style.display = 'none';
    renderJobList(jobs);
    updateStats(jobs);
    updateNavJobCount(jobs.length);
  } catch (e) {
    state.jobs = DEMO_JOBS;
    state.demoMode = true;
    document.getElementById('demoBanner').style.display = 'flex';
    renderJobList(DEMO_JOBS);
    updateStats(DEMO_JOBS);
    updateNavJobCount(DEMO_JOBS.length);
  }
}

function updateNavJobCount(count) {
  const el = document.getElementById('navJobCount');
  if (el) el.textContent = count;
}

function updateStats(jobs) {
  const total = jobs.length;
  const processed = jobs.filter(j => j.processed).length;
  const withBanners = jobs.filter(j => j.banners && j.banners.length > 0).length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statProcessed').textContent = processed;
  document.getElementById('statBanners').textContent = withBanners;
}

function renderJobList(jobs) {
  const listEl = document.getElementById('jobList');
  if (!jobs || jobs.length === 0) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
      <div class="empty-state-title">ジョブがありません</div>
      <div class="empty-state-desc">「スクレイプ開始」ボタンをクリックしてクラウドワークスから案件を取得してください。</div>
    </div>`;
    return;
  }

  listEl.innerHTML = jobs.map(job => {
    const processedBadge = job.processed
      ? `<span class="badge badge-processed">処理済み</span>`
      : `<span class="badge badge-pending">未処理</span>`;
    const bannerCount = job.banners ? (Array.isArray(job.banners) ? job.banners.length : (job.banners[0]?.count || 0)) : 0;
    const bannerBadge = bannerCount > 0 ? `<span class="badge badge-new">${bannerCount} バナー</span>` : '';
    const deadline = job.deadline ? `<span class="job-card-meta-item"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>${job.deadline}</span>` : '';

    return `
      <div class="job-card${state.selectedJob?.job_id === job.job_id ? ' selected' : ''}" onclick="selectJob('${job.job_id}')">
        <div class="job-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M3 9h18M9 21V9"/></svg>
        </div>
        <div class="job-card-body">
          <div class="job-card-title" title="${escHtml(job.title)}">${escHtml(job.title)}</div>
          <div class="job-card-meta">
            <span class="job-card-meta-item">
              <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg>
              ${escHtml(job.reward)}
            </span>
            ${deadline}
            ${job.client_name ? `<span class="job-card-meta-item">${escHtml(job.client_name)}</span>` : ''}
          </div>
        </div>
        <div class="job-card-actions">
          ${processedBadge}
          ${bannerBadge}
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openJobDetail('${job.job_id}')">
            詳細
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function selectJob(jobId) {
  state.selectedJob = state.jobs.find(j => j.job_id === jobId) || null;
  renderJobList(state.jobs);
}

async function openJobDetail(jobId) {
  try {
    const job = await fetchJob(jobId);
    state.selectedJob = job;
    renderJobList(state.jobs);
    showDetailPanel(job);
  } catch (e) {
    showToast('error', 'ジョブ取得エラー', e.message);
  }
}

function showDetailPanel(job) {
  const panel = document.getElementById('detailPanel');
  const overlay = document.getElementById('overlay');

  document.getElementById('detailTitle').textContent = job.title;
  document.getElementById('detailUrl').innerHTML = `<a href="${job.url}" target="_blank" rel="noopener">${job.url}</a>`;
  document.getElementById('detailReward').textContent = job.reward || '—';
  document.getElementById('detailDeadline').textContent = job.deadline || '—';
  document.getElementById('detailClient').textContent = job.client_name || '—';
  document.getElementById('detailDesc').textContent = job.description || '説明なし';

  const reqEl = document.getElementById('detailRequirements');
  if (job.requirements && job.requirements.length > 0) {
    reqEl.innerHTML = job.requirements.map(r => `<span class="tag tag-gray">${escHtml(r)}</span>`).join('');
  } else {
    reqEl.innerHTML = '<span class="text-muted">なし</span>';
  }

  const attachEl = document.getElementById('detailAttachments');
  if (job.attachments && job.attachments.length > 0) {
    attachEl.innerHTML = job.attachments.map(a =>
      `<span class="tag"><a href="${a.file_url}" target="_blank" style="color:inherit">${escHtml(a.file_name)}</a></span>`
    ).join('');
  } else {
    attachEl.innerHTML = '<span class="text-muted">なし</span>';
  }

  panel.classList.add('open');
  overlay.classList.add('show');
}

function closeDetailPanel() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

async function startScrape() {
  const btn = document.getElementById('btnScrape');
  btnLoading(btn, true, 'スクレイプ中...');
  try {
    await scrapeJobs();
    showToast('info', 'スクレイプ開始', 'バックグラウンドで案件を取得しています。しばらく後に更新してください。');
    // Poll for new jobs after a delay
    setTimeout(() => loadJobs(), 5000);
    setTimeout(() => loadJobs(), 15000);
    setTimeout(() => loadJobs(), 30000);
  } catch (e) {
    showToast('error', 'スクレイプエラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

/* ===== Full Pipeline from Detail Panel ===== */
async function runFullPipeline(jobId) {
  const btn = document.getElementById('btnRunPipeline');
  btnLoading(btn, true, '分析中...');

  try {
    // Step 1: Analyze
    updatePipelineStep('step-analyze', 'active');
    showToast('info', 'ステップ1/3', 'Claude で案件を分析中...');
    const analyzed = await analyzeJob(jobId);
    state.analyzedJob = analyzed;
    updatePipelineStep('step-analyze', 'done');

    // Step 2: Generate Prompts
    updatePipelineStep('step-prompts', 'active');
    btnLoading(btn, true, 'プロンプト生成中...');
    showToast('info', 'ステップ2/3', 'Gemini でプロンプトを生成中...');
    const prompts = await generatePrompts(analyzed);
    state.prompts = prompts;
    updatePipelineStep('step-prompts', 'done');

    // Step 3: Generate Banners
    updatePipelineStep('step-banners', 'active');
    btnLoading(btn, true, 'バナー生成中...');
    showToast('info', 'ステップ3/3', 'DALL-E 3 でバナーを生成中...');
    const banners = await generateBanners(jobId);
    state.banners = banners;
    updatePipelineStep('step-banners', 'done');

    showToast('success', '完了！', `${banners.length} 枚のバナーが生成されました。`);
    closeDetailPanel();

    // Switch to banners tab and show
    switchTab('banners');
    renderBannersTab();
    loadBannersForJob(jobId);

    // Refresh job list
    await loadJobs();
  } catch (e) {
    showToast('error', 'パイプラインエラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

function updatePipelineStep(stepId, status) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (status) el.classList.add(status);
  if (status === 'done') {
    el.querySelector('.step-icon').innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  }
}

/* ===== Banners Tab ===== */
function renderBannersTab() {
  const jobSel = document.getElementById('bannerJobSelect');
  jobSel.innerHTML = `<option value="">-- ジョブを選択 --</option>` +
    state.jobs.map(j => `<option value="${j.job_id}"${state.selectedJob?.job_id === j.job_id ? ' selected' : ''}>${escHtml(j.title.substring(0, 60))}</option>`).join('');
}

async function loadBannersForJob(jobId) {
  if (!jobId) {
    document.getElementById('bannerGrid').innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg><div class="empty-state-title">ジョブを選択してください</div></div>`;
    return;
  }

  document.getElementById('bannerGrid').innerHTML = `<div class="loading-overlay"><span class="spinner spinner-lg"></span><span class="loading-text">バナーを読み込んでいます...</span></div>`;

  try {
    const banners = await fetchBanners(jobId);
    state.banners = banners;
    state.selectedJob = state.jobs.find(j => j.job_id === jobId) || state.selectedJob;
    renderBannerGrid(banners, jobId);
  } catch (e) {
    showToast('error', 'バナー取得エラー', e.message);
    document.getElementById('bannerGrid').innerHTML = `<div class="empty-state"><div class="empty-state-title">エラー</div><div class="empty-state-desc">${escHtml(e.message)}</div></div>`;
  }
}

function renderBannerGrid(banners, jobId) {
  const grid = document.getElementById('bannerGrid');
  if (!banners || banners.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
      <div class="empty-state-title">バナーがありません</div>
      <div class="empty-state-desc">このジョブのバナーはまだ生成されていません。<br>ジョブ一覧から「詳細」を開いてパイプラインを実行してください。</div>
      <button class="btn btn-primary" onclick="runGenerateBannersOnly('${jobId}')">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
        バナーを今すぐ生成
      </button>
    </div>`;
    return;
  }

  grid.innerHTML = `<div class="banner-grid">${banners.map(banner => renderBannerCard(banner)).join('')}</div>`;
}

function renderBannerCard(banner) {
  const isSelected = state.selectedBanner?.banner_id === banner.banner_id;
  const statusBadge = {
    generated: '<span class="badge badge-generated">生成済み</span>',
    approved: '<span class="badge badge-approved">承認</span>',
    rejected: '<span class="badge badge-rejected">却下</span>',
  }[banner.status] || '<span class="badge badge-generated">生成済み</span>';

  const tasteLabel = { 'モダン': 'Modern', 'ポップ': 'Pop', 'エレガント': 'Elegant' }[banner.design_taste] || banner.design_taste;

  return `
    <div class="banner-card${isSelected ? ' selected-banner' : ''}" id="bcard-${banner.banner_id}">
      <div class="banner-image-wrap" onclick="openImageModal('${banner.image_url}')">
        <img src="${banner.image_url}" alt="Banner ${banner.banner_id}"
          onerror="this.parentElement.innerHTML='<div class=\\'banner-image-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z\\'/></svg><span>画像読み込み失敗</span></div>'"
          loading="lazy"
        >
      </div>
      <div class="banner-card-footer">
        <div>
          <div class="banner-taste">${tasteLabel} / ${banner.design_taste}</div>
          <div style="margin-top:4px">${statusBadge}</div>
        </div>
        <div class="banner-actions">
          <button class="btn btn-sm btn-success" onclick="approveBanner('${banner.banner_id}')" title="承認">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            承認
          </button>
          <button class="btn btn-sm btn-danger" onclick="rejectBanner('${banner.banner_id}')" title="却下">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            却下
          </button>
          <button class="btn btn-sm btn-secondary" onclick="selectBannerForApp('${banner.banner_id}')" title="応募文生成">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 000 2h3a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
            応募
          </button>
        </div>
      </div>
    </div>
  `;
}

async function approveBanner(bannerId) {
  try {
    await updateBannerStatus(bannerId, 'approved');
    showToast('success', '承認しました', `バナー ${bannerId} を承認しました。`);
    const jobId = document.getElementById('bannerJobSelect').value;
    if (jobId) loadBannersForJob(jobId);
  } catch (e) {
    showToast('error', 'エラー', e.message);
  }
}

async function rejectBanner(bannerId) {
  try {
    await updateBannerStatus(bannerId, 'rejected');
    showToast('info', '却下しました', `バナー ${bannerId} を却下しました。`);
    const jobId = document.getElementById('bannerJobSelect').value;
    if (jobId) loadBannersForJob(jobId);
  } catch (e) {
    showToast('error', 'エラー', e.message);
  }
}

function selectBannerForApp(bannerId) {
  state.selectedBanner = state.banners.find(b => b.banner_id === bannerId) || null;
  showToast('info', '応募文タブへ', 'バナーを選択しました。応募文タブで生成できます。');
  switchTab('applications');
  renderApplicationTab();
}

async function runGenerateBannersOnly(jobId) {
  const btn = event.target.closest('button');
  if (btn) btnLoading(btn, true, '生成中...');
  try {
    showToast('info', 'バナー生成', 'DALL-E 3 でバナーを生成中...');
    const banners = await generateBanners(jobId);
    state.banners = banners;
    renderBannerGrid(banners, jobId);
    showToast('success', '完了', `${banners.length} 枚のバナーが生成されました。`);
  } catch (e) {
    showToast('error', 'バナー生成エラー', e.message);
    if (btn) btnLoading(btn, false);
  }
}

/* ===== Image Modal ===== */
function openImageModal(url) {
  const modal = document.getElementById('imgModal');
  document.getElementById('imgModalImg').src = url;
  modal.classList.add('open');
}

function closeImageModal() {
  document.getElementById('imgModal').classList.remove('open');
}

/* ===== Applications Tab ===== */
function renderApplicationTab() {
  const jobSel = document.getElementById('appJobSelect');
  jobSel.innerHTML = `<option value="">-- ジョブを選択 --</option>` +
    state.jobs.map(j => `<option value="${j.job_id}"${state.selectedJob?.job_id === j.job_id ? ' selected' : ''}>${escHtml(j.title.substring(0, 60))}</option>`).join('');

  const bannerSel = document.getElementById('appBannerSelect');
  bannerSel.innerHTML = state.banners.length > 0
    ? `<option value="">-- バナーを選択 --</option>` + state.banners.map(b =>
        `<option value="${b.banner_id}"${state.selectedBanner?.banner_id === b.banner_id ? ' selected' : ''}>${b.banner_id} - ${b.design_taste} (${b.status})</option>`
      ).join('')
    : `<option value="">バナーがありません</option>`;

  if (state.applicationText) {
    document.getElementById('appTextContent').textContent = state.applicationText.text_content;
    document.getElementById('appTextContainer').style.display = 'block';
  }
}

async function loadBannersForAppTab(jobId) {
  if (!jobId) return;
  state.selectedJob = state.jobs.find(j => j.job_id === jobId) || state.selectedJob;
  try {
    const banners = await fetchBanners(jobId);
    state.banners = banners;
    const sel = document.getElementById('appBannerSelect');
    sel.innerHTML = banners.length > 0
      ? `<option value="">-- バナーを選択 --</option>` + banners.map(b =>
          `<option value="${b.banner_id}">${b.banner_id} - ${b.design_taste} (${b.status})</option>`
        ).join('')
      : `<option value="">バナーがありません</option>`;
  } catch (e) {
    showToast('error', 'バナー取得エラー', e.message);
  }
}

async function generateApplicationText() {
  const jobId = document.getElementById('appJobSelect').value;
  const bannerId = document.getElementById('appBannerSelect').value;
  if (!jobId || !bannerId) {
    showToast('warning', '選択が必要です', 'ジョブとバナーを両方選択してください。');
    return;
  }

  const banner = state.banners.find(b => b.banner_id === bannerId);
  const job = state.jobs.find(j => j.job_id === jobId);

  const btn = document.getElementById('btnGenAppText');
  btnLoading(btn, true, '生成中...');

  try {
    let analyzedJob = state.analyzedJob;
    if (!analyzedJob || analyzedJob.job_id !== jobId) {
      try {
        analyzedJob = await analyzeJob(jobId);
        state.analyzedJob = analyzedJob;
      } catch (_) {
        analyzedJob = null;
      }
    }

    const payload = {
      job_id: jobId,
      selected_banner_id: bannerId,
      job_details: {
        title: job?.title || '',
        reward: job?.reward || '',
        target_audience: analyzedJob?.target_audience || '',
        purpose: analyzedJob?.purpose || '',
        banner_size: analyzedJob?.banner_size || '',
        key_phrases: analyzedJob?.key_phrases || [],
      },
      banner_details: {
        design_taste: banner?.design_taste || '',
        banner_id: bannerId,
      },
    };

    const result = await generateAppText(payload);
    state.applicationText = result;

    document.getElementById('appTextContent').textContent = result.text_content;
    document.getElementById('appTextContainer').style.display = 'block';
    showToast('success', '応募文を生成しました', 'コピーしてクラウドワークスに貼り付けてください。');
  } catch (e) {
    showToast('error', '生成エラー', e.message);
  } finally {
    btnLoading(btn, false);
  }
}

function copyAppText() {
  const text = document.getElementById('appTextContent').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('success', 'コピーしました', 'クリップボードに応募文をコピーしました。');
  }).catch(() => {
    showToast('error', 'コピー失敗', 'ブラウザの権限を確認してください。');
  });
}

/* ===== Utility ===== */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      switchTab(tab);
      if (tab === 'banners') {
        renderBannersTab();
        if (state.selectedJob) {
          document.getElementById('bannerJobSelect').value = state.selectedJob.job_id;
          loadBannersForJob(state.selectedJob.job_id);
        }
      } else if (tab === 'applications') {
        renderApplicationTab();
      }
    });
  });

  // Scrape button
  document.getElementById('btnScrape').addEventListener('click', startScrape);
  document.getElementById('btnRefresh').addEventListener('click', loadJobs);

  // Detail panel close
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetailPanel);
  document.getElementById('overlay').addEventListener('click', closeDetailPanel);

  // Run full pipeline button in detail panel
  document.getElementById('btnRunPipeline').addEventListener('click', () => {
    if (state.selectedJob) runFullPipeline(state.selectedJob.job_id);
  });

  // Banner job selector
  document.getElementById('bannerJobSelect').addEventListener('change', e => {
    loadBannersForJob(e.target.value);
  });

  // App tab job selector
  document.getElementById('appJobSelect').addEventListener('change', e => {
    loadBannersForAppTab(e.target.value);
  });

  // Generate app text button
  document.getElementById('btnGenAppText').addEventListener('click', generateApplicationText);

  // Copy app text button
  document.getElementById('btnCopyAppText').addEventListener('click', copyAppText);

  // Image modal close
  document.getElementById('imgModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeImageModal();
  });
  document.getElementById('imgModalClose').addEventListener('click', closeImageModal);

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDetailPanel();
      closeImageModal();
    }
  });

  // Initial load
  switchTab('jobs');
  loadJobs();
});
