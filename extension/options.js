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
