/* ==================== SkillHub 前端 ==================== */
const API = '';
let currentPage = 'home';
let apiKey = localStorage.getItem('sk_api_key') || '';
let currentDev = null;

// ==================== 工具函数 ====================
function $ (sel) { return document.querySelector(sel); }
function $$ (sel) { return document.querySelectorAll(sel); }
function toast (msg, type) {
  if (type === void 0) type = 'info';
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 3000);
}

async function api (url, opts) {
  if (opts === void 0) opts = {};
  var headers = opts.headers || {};
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
  var res = await fetch(API + url, Object.assign({}, opts, { headers: headers }));
  if (!res.ok) {
    var e = await res.json().catch(function () { return ({ error: res.statusText }); });
    throw new Error(e.error || ('HTTP ' + res.status));
  }
  return res.json();
}

// ==================== 认证 ====================
function setKey (key) {
  apiKey = key;
  localStorage.setItem('sk_api_key', key);
}

function logout () {
  apiKey = '';
  localStorage.removeItem('sk_api_key');
  currentDev = null;
  updateNav();
  toast('已退出登录');
  navigate('home');
}

async function loadProfile () {
  if (!apiKey) return null;
  try {
    currentDev = await api('/api/developers/me/profile');
    return currentDev;
  } catch (e) {
    console.warn('Profile load failed:', e.message);
    return null;
  }
}

function updateNav () {
  var statusEl = $('#loginStatus');
  var loginBtn = $('#loginBtn');
  var userInfoEl = $('#userInfo');

  if (apiKey && currentDev) {
    statusEl.style.display = 'none';
    loginBtn.style.display = 'none';
    userInfoEl.style.display = 'inline';
    userInfoEl.innerHTML = '<span style="color:var(--success);margin-right:8px;">&#9679;</span>' + currentDev.name + ' <a href="#" onclick="logout();return false" style="font-size:0.8em;margin-left:8px">退出</a>';
  } else if (apiKey) {
    statusEl.style.display = 'none';
    loginBtn.style.display = 'inline-block';
    loginBtn.textContent = '已保存Key';
    userInfoEl.style.display = 'none';
  } else {
    statusEl.style.display = 'inline';
    loginBtn.style.display = 'inline-block';
    loginBtn.textContent = '登录';
    userInfoEl.style.display = 'none';
  }
}

// ==================== 路由 ====================
function navigate (page, params) {
  if (params === void 0) params = {};
  currentPage = page;
  var main = $('#mainContent');

  // 更新导航高亮
  $$('.nav-links a').forEach(function (a) { a.classList.remove('active'); });
  var navLink = document.querySelector('.nav-links a[data-page="' + page + '"]');
  if (navLink) navLink.classList.add('active');

  switch (page) {
    case 'home': renderHome(main, params); break;
    case 'skill': renderSkillDetail(main, params.id); break;
    case 'publish': renderPublish(main, params); break;
    case 'rank': renderRank(main); break;
    case 'developer': renderDeveloper(main, params.id); break;
    default: renderHome(main, params);
  }
}

// ==================== 首页：技能列表 ====================
async function renderHome (main, params) {
  if (params === void 0) params = {};
  main.innerHTML = '<div class="page-container"><h1 class="page-title">发现技能</h1><div class="search-bar"><input type="text" id="searchInput" placeholder="搜索技能名称或描述..." value="' + (params.search || '') + '"><select id="categoryFilter"><option value="all">全部分类</option></select><select id="sortSelect"><option value="latest" ' + (params.sort === 'latest' ? 'selected' : '') + '>最新发布</option><option value="downloads" ' + (params.sort === 'downloads' ? 'selected' : '') + '>最多下载</option><option value="rating" ' + (params.sort === 'rating' ? 'selected' : '') + '>最高评分</option><option value="oldest">最早发布</option></select></div><div id="skillList" class="skill-grid"><div class="loading"><div class="spinner"></div><p>加载中...</p></div></div><div id="pagination" class="pagination"></div></div>';

  // 加载分类
  try {
    var cats = await api('/api/stats/categories');
    var catSel = $('#categoryFilter');
    cats.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name + ' (' + c.count + ')';
      if (c.name === (params.category || 'all')) opt.selected = true;
      catSel.appendChild(opt);
    });
  } catch (e) { /* 忽略 */ }

  // 绑定搜索事件
  var searchTimer;
  $('#searchInput').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { loadSkills(params.page || 1); }, 400);
  });
  $('#categoryFilter').addEventListener('change', function () { loadSkills(1); });
  $('#sortSelect').addEventListener('change', function () { loadSkills(1); });

  await loadSkills(params.page || 1);
}

async function loadSkills (page) {
  var search = $('#searchInput') ? $('#searchInput').value : '';
  var category = $('#categoryFilter') ? $('#categoryFilter').value : 'all';
  var sort = $('#sortSelect') ? $('#sortSelect').value : 'latest';

  $('#skillList').innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>';

  try {
    var params = new URLSearchParams({ page: page, limit: 12, sort: sort });
    if (search) params.set('search', search);
    if (category !== 'all') params.set('category', category);

    var data = await api('/api/skills?' + params.toString());

    if (data.skills.length === 0) {
      $('#skillList').innerHTML = '<div class="empty-state"><div class="empty-icon">&#128269;</div><p>没找到技能</p><p style="font-size:0.85em;color:var(--text3)">换个搜索词或成为第一个发布者</p></div>';
    } else {
      $('#skillList').innerHTML = data.skills.map(renderSkillCard).join('');
    }

    renderPagination(page, data.totalPages);
    $('#searchInput').value = search; // 保持搜索词
  } catch (e) {
    $('#skillList').innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;</div><p>加载失败</p><p style="font-size:0.85em;color:var(--text3)">' + e.message + '</p></div>';
  }
}

function renderSkillCard (s) {
  var dev = s.developers || {};
  var ratingHtml = s.rating_count > 0
    ? '<span>&#9733; ' + s.rating_avg + ' (' + s.rating_count + ')</span>'
    : '<span>暂无评分</span>';
  return '<div class="skill-card" onclick="navigate(\'skill\',{id:\'' + s.id + '\'})"><span class="category-tag">' + escapeHtml(s.category) + '</span><h3>' + escapeHtml(s.name) + '</h3><p class="desc">' + escapeHtml(s.description) + '</p><div class="meta">' + ratingHtml + '<span>&#8615; ' + s.download_count + '</span><span>v' + escapeHtml(s.version) + '</span></div><div class="dev">by ' + escapeHtml(dev.name || 'unknown') + '</div></div>';
}

function renderPagination (current, total) {
  if (total <= 1) { $('#pagination').innerHTML = ''; return; }
  var html = '';
  html += '<button ' + (current <= 1 ? 'disabled' : '') + ' onclick="loadSkills(' + (current - 1) + ')">上一页</button>';
  for (var i = 1; i <= total; i++) {
    if (total > 7 && i > 2 && i < total - 1 && Math.abs(i - current) > 1) {
      if (i === 3 || i === total - 2) html += '<button disabled>...</button>';
      continue;
    }
    html += '<button class="' + (i === current ? 'active' : '') + '" onclick="loadSkills(' + i + ')">' + i + '</button>';
  }
  html += '<button ' + (current >= total ? 'disabled' : '') + ' onclick="loadSkills(' + (current + 1) + ')">下一页</button>';
  $('#pagination').innerHTML = html;
}

// ==================== 技能详情 ====================
async function renderSkillDetail (main, id) {
  main.innerHTML = '<div class="page-container"><div class="loading"><div class="spinner"></div><p>加载技能信息...</p></div></div>';

  try {
    var skill = await api('/api/skills/' + id);
    var reviews = await api('/api/reviews/skill/' + id);

    var dev = skill.developers || {};
    var tagsHtml = (skill.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('');

    var html = '<div class="page-container"><div class="skill-detail"><a href="#" onclick="navigate(\'home\');return false" style="font-size:0.85em;color:var(--text3)">&larr; 返回列表</a><h1>' + escapeHtml(skill.name) + '</h1><div class="byline">v' + escapeHtml(skill.version) + ' &middot; 由 <a href="#" onclick="navigate(\'developer\',{id:\'' + dev.id + '\'});return false">' + escapeHtml(dev.name || '未知') + '</a> 发布于 ' + formatDate(skill.created_at) + '</div>';

    html += '<div class="tags">' + tagsHtml + '</div>';

    html += '<div class="stats-row"><div class="stat-item"><div class="num">' + skill.download_count + '</div><div class="label">下载</div></div><div class="stat-item"><div class="num">' + (skill.rating_avg || '0') + '</div><div class="label">评分</div></div><div class="stat-item"><div class="num">' + skill.rating_count + '</div><div class="label">评测</div></div></div>';

    html += '<div class="skill-actions">';
    if (skill.zip_url) {
      html += '<button class="btn btn-primary" onclick="downloadSkill(\'' + skill.id + '\')">&#8615; 下载</button>';
    }
    html += '<button class="btn" onclick="showReviewForm(\'' + skill.id + '\')">&#9733; 评测</button></div>';

    html += '<div class="section-title">技能描述</div><p style="white-space:pre-wrap;color:var(--text2)">' + escapeHtml(skill.description) + '</p>';

    // 评测列表
    html += '<div class="section-title">评测 (' + (reviews.length || 0) + ')</div>';
    if (reviews.length === 0) {
      html += '<p style="color:var(--text3);padding:20px 0">暂无评测，来写第一个吧</p>';
    } else {
      html += '<div class="review-list">' + reviews.map(function (r) {
        var rd = r.developers || {};
        return '<div class="review-item"><div class="review-header"><span class="review-author">' + escapeHtml(rd.name || '未知') + '</span><span class="review-rating">' + '&#9733;'.repeat(r.rating) + '&#9734;'.repeat(5 - r.rating) + '</span></div><p class="review-comment">' + escapeHtml(r.comment || '无评论') + '</p><div class="review-date">' + formatDate(r.created_at) + '</div></div>';
      }).join('') + '</div>';
    }

    html += '<div id="reviewForm" style="display:none;margin-top:24px;padding:20px;background:var(--bg2);border-radius:var(--radius)"><h4>写评测</h4><div style="margin:12px 0"><label style="color:var(--text2);margin-right:12px">评分:</label>' + [1,2,3,4,5].map(function(n) { return '<button class="btn btn-sm rating-star" data-rating="' + n + '" onclick="selectRating(this)">' + n + ' &#9733;</button>'; }).join('') + '</div><textarea id="reviewComment" placeholder="写下你的评测（可选）" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);min-height:80px;resize:vertical;margin-bottom:12px"></textarea><button class="btn btn-primary" onclick="submitReview(\'' + skill.id + '\')">提交评测</button><button class="btn" onclick="document.getElementById(\'reviewForm\').style.display=\'none\'" style="margin-left:8px">取消</button></div>';

    html += '</div></div>';
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = '<div class="page-container"><div class="empty-state"><div class="empty-icon">&#9888;</div><p>技能不存在或加载失败</p><p style="color:var(--text3)">' + e.message + '</p><button class="btn" onclick="navigate(\'home\')">返回首页</button></div></div>';
  }
}

var selectedRating = 0;
function showReviewForm (skillId) {
  document.getElementById('reviewForm').style.display = 'block';
  selectedRating = 0;
  document.querySelectorAll('.rating-star').forEach(function (b) { b.classList.remove('btn-primary'); });
}
function selectRating (btn) {
  selectedRating = parseInt(btn.dataset.rating);
  document.querySelectorAll('.rating-star').forEach(function (b, i) {
    b.classList.toggle('btn-primary', i < selectedRating);
  });
}
async function submitReview (skillId) {
  if (!apiKey) { toast('请先登录', 'error'); return; }
  if (selectedRating < 1) { toast('请选择评分', 'error'); return; }

  try {
    var comment = $('#reviewComment').value;
    await api('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: skillId, rating: selectedRating, comment: comment })
    });
    toast('评测成功', 'success');
    navigate('skill', { id: skillId });
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function downloadSkill (skillId) {
  if (!apiKey) { toast('请先登录', 'error'); return; }
  try {
    var data = await api('/api/skills/' + skillId + '/download', { method: 'POST' });
    if (data.download_url) {
      window.open(data.download_url, '_blank');
      toast('下载开始', 'success');
      setTimeout(function () { navigate('skill', { id: skillId }); }, 1000);
    } else {
      toast('该技能暂无文件', 'error');
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ==================== 发布页 ====================
function renderPublish (main, params) {
  if (params === void 0) params = {};
  if (!apiKey) {
    main.innerHTML = '<div class="page-container"><div class="empty-state"><div class="empty-icon">&#128274;</div><p>请先登录以发布技能</p><button class="btn btn-primary" onclick="$(\'#loginModal\').style.display=\'flex\'">登录</button></div></div>';
    return;
  }

  main.innerHTML = '<div class="page-container"><h1 class="page-title">' + (params.edit ? '编辑技能' : '发布新技能') + '</h1><div class="publish-form"><div class="form-group"><label>技能名称 *</label><input type="text" id="pName" placeholder="给你的技能起个名字"></div><div class="form-group"><label>描述 *</label><textarea id="pDesc" placeholder="描述你的技能功能和使用方法"></textarea></div><div class="form-group"><label>版本</label><input type="text" id="pVersion" value="1.0.0" placeholder="1.0.0"></div><div class="form-group"><label>分类</label><select id="pCategory"><option value="automation">自动化</option><option value="data">数据处理</option><option value="devtools">开发工具</option><option value="ai">AI 模型</option><option value="content">内容创作</option><option value="business">商业办公</option><option value="other">其他</option></select></div><div class="form-group"><label>标签 (逗号分隔)</label><input type="text" id="pTags" placeholder="nodejs, agent, skill"></div><div class="form-group"><label>ZIP 文件</label><div class="file-upload" id="zipDrop"><div class="upload-icon">&#128230;</div><div class="upload-text" id="zipLabel">点击选择或拖拽 ZIP 文件</div><div class="upload-hint">最大 10MB</div><input type="file" id="zipInput" accept=".zip" style="display:none"></div></div><div style="display:flex;gap:10px"><button class="btn btn-primary" id="submitBtn" onclick="publishSkill()">发布技能</button><button class="btn" onclick="navigate(\'home\')">取消</button></div></div></div>';

  // 文件上传交互
  var zipDrop = $('#zipDrop');
  var zipInput = $('#zipInput');
  zipDrop.addEventListener('click', function () { zipInput.click(); });
  zipInput.addEventListener('change', function () {
    if (zipInput.files[0]) {
      $('#zipLabel').innerHTML = '<span class="file-selected">' + zipInput.files[0].name + '</span>';
    }
  });
  zipDrop.addEventListener('dragover', function (e) { e.preventDefault(); zipDrop.style.borderColor = 'var(--primary)'; });
  zipDrop.addEventListener('dragleave', function () { zipDrop.style.borderColor = 'var(--border)'; });
  zipDrop.addEventListener('drop', function (e) {
    e.preventDefault();
    zipDrop.style.borderColor = 'var(--border)';
    var file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      var dt = new DataTransfer();
      dt.items.add(file);
      zipInput.files = dt.files;
      $('#zipLabel').innerHTML = '<span class="file-selected">' + file.name + '</span>';
    }
  });
}

async function publishSkill () {
  if (!apiKey) { toast('请先登录', 'error'); return; }

  var name = $('#pName').value.trim();
  var desc = $('#pDesc').value.trim();

  if (!name) { toast('请输入技能名称', 'error'); return; }
  if (!desc) { toast('请输入技能描述', 'error'); return; }

  $('#submitBtn').disabled = true;
  $('#submitBtn').textContent = '发布中...';

  try {
    var formData = new FormData();
    formData.append('name', name);
    formData.append('description', desc);
    formData.append('version', $('#pVersion').value || '1.0.0');
    formData.append('category', $('#pCategory').value);
    formData.append('tags', $('#pTags').value);

    var zipInput = $('#zipInput');
    if (zipInput.files[0]) {
      formData.append('zip', zipInput.files[0]);
    }

    await api('/api/skills', {
      method: 'POST',
      body: formData
    });

    toast('技能发布成功！', 'success');
    // 清空表单
    navigate('home');
  } catch (e) {
    toast('发布失败: ' + e.message, 'error');
  } finally {
    $('#submitBtn').disabled = false;
    $('#submitBtn').textContent = '发布技能';
  }
}

// ==================== 排行榜 ====================
async function renderRank (main) {
  main.innerHTML = '<div class="page-container"><h1 class="page-title">开发者排行</h1><div id="rankContent"><div class="loading"><div class="spinner"></div></div></div></div>';

  try {
    var devs = await api('/api/developers/top/list?limit=20');
    var html = '<table class="rank-table"><thead><tr><th>#</th><th>开发者</th><th>技能数</th><th>总下载</th></tr></thead><tbody>';
    devs.forEach(function (d, i) {
      html += '<tr onclick="navigate(\'developer\',{id:\'' + d.id + '\'})" style="cursor:pointer"><td class="rank-num">#' + (i + 1) + '</td><td><strong>' + escapeHtml(d.name) + '</strong></td><td>' + d.skills_count + '</td><td>' + d.total_downloads + '</td></tr>';
    });
    html += '</tbody></table>';
    $('#rankContent').innerHTML = html;
  } catch (e) {
    $('#rankContent').innerHTML = '<div class="empty-state"><p>加载失败: ' + e.message + '</p></div>';
  }
}

// ==================== 开发者页 ====================
async function renderDeveloper (main, id) {
  main.innerHTML = '<div class="page-container"><div class="loading"><div class="spinner"></div></div></div>';

  try {
    var dev = await api('/api/developers/' + id);
    var html = '<div class="page-container"><a href="#" onclick="navigate(\'rank\');return false" style="font-size:0.85em;color:var(--text3)">&larr; 返回排行</a><div style="display:flex;align-items:center;gap:20px;margin:24px 0"><div style="width:64px;height:64px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.5em;font-weight:700;color:#fff">' + escapeHtml(dev.name.charAt(0).toUpperCase()) + '</div><div><h1 style="margin:0">' + escapeHtml(dev.name) + '</h1><p style="color:var(--text2);font-size:0.9em">' + escapeHtml(dev.bio || '这个开发者很懒，什么都没写') + '</p></div></div>';

    html += '<div class="stats-row" style="max-width:400px"><div class="stat-item"><div class="num">' + dev.skills_count + '</div><div class="label">技能</div></div><div class="stat-item"><div class="num">' + dev.total_downloads + '</div><div class="label">总下载</div></div><div class="stat-item"><div class="num">' + formatDate(dev.joined_at) + '</div><div class="label">加入于</div></div></div>';

    html += '<div class="section-title">发布的技能</div>';
    if (!dev.skills || dev.skills.length === 0) {
      html += '<p style="color:var(--text3)">暂无技能</p>';
    } else {
      html += '<div class="skill-grid">' + dev.skills.map(renderSkillCard).join('') + '</div>';
    }

    html += '</div>';
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = '<div class="page-container"><div class="empty-state"><p>加载失败: ' + e.message + '</p></div></div>';
  }
}

// ==================== 工具函数 ====================
function escapeHtml (str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function formatDate (d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function () {
  // 导航链接绑定
  $$('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      navigate(a.dataset.page);
    });
  });

  // 品牌 logo 点击回首页
  $('.nav-brand').addEventListener('click', function (e) {
    e.preventDefault();
    navigate('home');
  });

  // 登录弹窗
  $('#loginBtn').addEventListener('click', function () {
    if (apiKey) {
      // 已保存 key，尝试加载 profile
      loadProfile().then(updateNav);
      return;
    }
    $('#loginModal').style.display = 'flex';
    $('#apiKeyInput').focus();
  });
  $('#loginCancel').addEventListener('click', function () {
    $('#loginModal').style.display = 'none';
  });
  $('#loginConfirm').addEventListener('click', function () {
    var key = $('#apiKeyInput').value.trim();
    if (!key || (!key.startsWith('sk_') && !key.startsWith('agent-world-'))) {
      toast('请输入有效的 API Key (sk_ 或 agent-world- 开头)', 'error');
      return;
    }
    setKey(key);
    $('#loginModal').style.display = 'none';
    loadProfile().then(function () {
      updateNav();
      toast('登录成功', 'success');
    });
  });
  $('#apiKeyInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#loginConfirm').click();
  });

  // 点击弹窗外部关闭
  $('#loginModal').addEventListener('click', function (e) {
    if (e.target === $('#loginModal')) $('#loginModal').style.display = 'none';
  });

  // 初始化
  updateNav();
  if (apiKey) loadProfile().then(updateNav);

  // 路由启动
  var hash = window.location.hash.slice(1);
  if (hash) {
    var parts = hash.split('/');
    if (parts[0] === 'skill' && parts[1]) navigate('skill', { id: parts[1] });
    else if (parts[0] === 'developer' && parts[1]) navigate('developer', { id: parts[1] });
    else navigate(hash);
  } else {
    navigate('home');
  }

  // hash 变化监听
  window.addEventListener('hashchange', function () {
    var h = window.location.hash.slice(1);
    var parts = h.split('/');
    if (parts[0] === 'skill' && parts[1]) navigate('skill', { id: parts[1] });
    else if (parts[0] === 'developer' && parts[1]) navigate('developer', { id: parts[1] });
    else if (h) navigate(h);
    else navigate('home');
  });
});
