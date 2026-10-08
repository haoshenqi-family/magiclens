/* MagicLens 设置页（v0.3）：无需手动配置地址/Token——
 * 点「登录」打开 moon-well 的 Authentik 登录页，成功后由回调页自动捕获令牌。 */
const $loginStatus = document.getElementById('loginStatus');
const $loginBtn = document.getElementById('loginBtn');
const $logoutBtn = document.getElementById('logoutBtn');
const $auto = document.getElementById('autoTranslate');
const $result = document.getElementById('testResult');

function renderLoginState(loggedIn) {
  $loginStatus.textContent = loggedIn ? '已登录（令牌自动续期）' : '未登录';
  $loginStatus.className = loggedIn ? 'ok' : 'bad';
  $loginBtn.hidden = loggedIn;
  document.getElementById('registerBtn').hidden = loggedIn;
  $logoutBtn.hidden = !loggedIn;
}

function refreshLoginState() {
  chrome.storage.sync.get({ token: '' }, ({ token }) => renderLoginState(Boolean(token)));
}

chrome.storage.sync.get({ autoTranslate: true }, ({ autoTranslate }) => {
  $auto.checked = autoTranslate;
});
$auto.addEventListener('change', () => {
  chrome.storage.sync.set({ autoTranslate: $auto.checked });
});

$loginBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'ml:login' });
});

document.getElementById('registerBtn').addEventListener('click', () => {
  // 邀请制注册（Authentik invitation-enrollment），注册完回来登录
  chrome.runtime.sendMessage({ type: 'ml:register' });
});

$logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'ml:logout' }, () => {
    renderLoginState(false);
    showResult(false, '已退出登录');
  });
});

document.getElementById('test').addEventListener('click', () => {
  showResult(false, '连接中…');
  chrome.runtime.sendMessage({ type: 'ml:settings' }, (resp) => {
    if (chrome.runtime.lastError) return showResult(false, chrome.runtime.lastError.message);
    if (resp && resp.ok) return showResult(true, '✓ 连接成功，鉴权有效');
    showResult(false, `✗ ${(resp && resp.error) || '连接失败'}`);
  });
});

// 登录回调成功时（callback 页发出）自动刷新状态
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'ml:login-ok') refreshLoginState();
});

function showResult(ok, text) {
  $result.textContent = text;
  $result.className = ok ? 'ok' : 'err';
}

refreshLoginState();

/* ---------- 域名管理（R25）：禁用名单的添加/移除/渲染 ----------
 * Why 以 storage 为唯一事实源：渲染挂 storage.onChanged，添加/移除只写 storage，
 * 不手工维护本地副本，避免双写漂移。 */
const $domainInput = document.getElementById('domainInput');
const $domainList = document.getElementById('domainList');
const $domainErr = document.getElementById('domainErr');
const $domainAdd = document.getElementById('domainAdd');

function showDomainErr(text) {
  $domainErr.textContent = text || '';
  $domainErr.hidden = !text;
}

function renderDomains(list) {
  $domainList.textContent = '';
  if (!Array.isArray(list) || !list.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = '（暂无禁用域名）';
    $domainList.appendChild(empty);
    return;
  }
  for (const d of list) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = d;
    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.textContent = '移除';
    rm.addEventListener('click', () => {
      chrome.storage.sync.get({ disabledDomains: [] }, ({ disabledDomains }) => {
        chrome.storage.sync.set({ disabledDomains: disabledDomains.filter((x) => x !== d) });
      });
    });
    li.append(name, rm);
    $domainList.appendChild(li);
  }
}

chrome.storage.sync.get({ disabledDomains: [] }, ({ disabledDomains }) => renderDomains(disabledDomains));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.disabledDomains) renderDomains(changes.disabledDomains.newValue);
});

$domainAdd.addEventListener('click', () => {
  const host = window.__magicLensNormDomain($domainInput.value);
  if (!host) return showDomainErr('无法识别该域名，请输入如 example.com 或完整网址');
  showDomainErr('');
  $domainInput.value = '';
  chrome.storage.sync.get({ disabledDomains: [] }, ({ disabledDomains }) => {
    if (disabledDomains.includes(host)) return; // 幂等：重复添加静默忽略
    chrome.storage.sync.set({ disabledDomains: [...disabledDomains, host] });
  });
});

// 回车即添加
$domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $domainAdd.click();
});
