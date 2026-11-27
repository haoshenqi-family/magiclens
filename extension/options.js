const MSG = __magicLensRpc.MSG;  // R46：消息类型常量集中（rpc.js）

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
  chrome.storage.sync.get(__magicLensDefaults, ({ token }) => renderLoginState(Boolean(token)));  // L5：默认值单点
}

chrome.storage.sync.get(__magicLensDefaults, ({ autoTranslate }) => {
  $auto.checked = autoTranslate;
});
$auto.addEventListener('change', () => {
  chrome.storage.sync.set({ autoTranslate: $auto.checked });
});

/* ---------- R71 翻译快捷键：录制式自定义 ----------
 * storage 为唯一事实源（域名管理同款）：录制/清除只写 chrome.storage.sync，
 * page-translate.js 经 storage.onChanged 采纳、已开页面即时生效。键位串形制与
 * 展示文案走 common.js 三件套（e.code 形制，mac 死键字符不影响匹配）。 */
const SC_ROWS = [
  {
    id: 'scPage', clearId: 'scPageClear', key: 'shortcutPageToggle',
    others: [
      { key: 'shortcutParagraph', name: '翻译段落' },
      { key: 'shortcutReadAloud', name: '朗读正文' },
    ],
  },
  {
    id: 'scPara', clearId: 'scParaClear', key: 'shortcutParagraph',
    others: [
      { key: 'shortcutPageToggle', name: '整页翻译' },
      { key: 'shortcutReadAloud', name: '朗读正文' },
    ],
  },
  {
    id: 'scRead', clearId: 'scReadClear', key: 'shortcutReadAloud',
    others: [
      { key: 'shortcutPageToggle', name: '整页翻译' },
      { key: 'shortcutParagraph', name: '翻译段落' },
    ],
  },
];
const $scErr = document.getElementById('scErr');
const showScErr = (text) => { $scErr.textContent = text || ''; $scErr.hidden = !text; };
const renderCombo = (input, stored) => {
  input.value = window.__magicLensComboLabel(stored) || '';
  input.placeholder = input.value ? '' : '未设置（点击录制）';
};

for (const row of SC_ROWS) {
  const input = document.getElementById(row.id);
  const reload = () => chrome.storage.sync.get(__magicLensDefaults, (c) => renderCombo(input, c[row.key]));
  reload();
  input.addEventListener('focus', () => {
    input.value = '按下组合键（Esc 取消）';
    input.classList.add('rec');
    showScErr('');
  });
  input.addEventListener('blur', () => { input.classList.remove('rec'); reload(); });
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return input.blur(); // 取消：blur 即还原原值
    const combo = window.__magicLensComboFromEvent(e);
    if (!combo) return; // 仅修饰键或无主修饰键：继续等待（裸键/纯 Shift 不可录制）
    chrome.storage.sync.get(__magicLensDefaults, (c) => {
      const conflict = row.others.find((other) => c[other.key] === combo);
      if (conflict) return showScErr(`与「${conflict.name}」的快捷键重复，请换一个组合键`);
      chrome.storage.sync.set({ [row.key]: combo }, () => input.blur());
    });
  });
  document.getElementById(row.clearId).addEventListener('click', () => chrome.storage.sync.set({ [row.key]: '' }));
}
// 跨窗口/双开设置页同步：仅刷新非录制中的框，避免覆写「按下组合键」提示态
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const row of SC_ROWS) {
    if (!changes[row.key]) continue;
    const input = document.getElementById(row.id);
    if (document.activeElement !== input) renderCombo(input, changes[row.key].newValue);
  }
});

/* ---------- 常驻入口（R54）：首次安装引导 + 常驻开关 ----------
 * 引导卡片只在用户尚未表态（ballAsked=false）时显示——安装时 background 自动打开
 * 本页正好承接；表态后永不再问，开关随时可翻。任何一次明确选择都同时落
 * ballEnabled + ballAsked 两个键，避免「关了开关又被问一遍」。 */
const $ball = document.getElementById('ballEnabled');
const $ballAsk = document.getElementById('ballAsk');

function setBall(on) {
  $ball.checked = on;
  chrome.storage.sync.set({ ballEnabled: on, ballAsked: true });
}

chrome.storage.sync.get(__magicLensDefaults, ({ ballEnabled, ballAsked }) => {
  $ball.checked = ballEnabled;
  $ballAsk.hidden = ballAsked;
});
document.getElementById('ballAskOn').addEventListener('click', () => setBall(true));
document.getElementById('ballAskOff').addEventListener('click', () => setBall(false));
$ball.addEventListener('change', () => {
  chrome.storage.sync.set({ ballEnabled: $ball.checked, ballAsked: true });
});

/* ---------- R70 悬浮球快捷动作配置（真值源=moon-well，buddy 页） ----------
 * R69 的本地逐气泡开关已随真值迁移移除（单一真值不漂移）：扩展球只读
 * moon-well POST /buddy/quick-actions（与 magicbook buddy 页「伙伴悬浮球快捷动作」
 * 同一份），本页只负责把用户送去那里。 */
document.getElementById('buddyConfigBtn').addEventListener('click', () => {
  window.open(`${window.__magicLensSiteOrigin}/buddy`, '_blank', 'noopener');
});

$loginBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MSG.ML_LOGIN });
});

document.getElementById('registerBtn').addEventListener('click', () => {
  // 邀请制注册（Authentik invitation-enrollment），注册完回来登录。
  // R61：链接由 background 从 moon-well 匿名端点动态获取，失败在结果区明示
  //（服务不可达/后端未配置时用户能看到原因，而不是「点了没反应」）。
  chrome.runtime.sendMessage({ type: MSG.ML_REGISTER }, (resp) => {
    if (chrome.runtime.lastError) return showResult(false, chrome.runtime.lastError.message);
    if (resp && resp.ok) return showResult(true, '已打开邀请注册页');
    showResult(false, `✗ ${(resp && resp.error) || '获取注册链接失败'}`);
  });
});

$logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MSG.ML_LOGOUT }, () => {
    renderLoginState(false);
    showResult(false, '已退出登录');
  });
});

document.getElementById('test').addEventListener('click', () => {
  showResult(false, '连接中…');
  chrome.runtime.sendMessage({ type: MSG.ML_SETTINGS }, (resp) => {
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
      chrome.storage.sync.get(__magicLensDefaults, ({ disabledDomains }) => {
        chrome.storage.sync.set({ disabledDomains: disabledDomains.filter((x) => x !== d) });
      });
    });
    li.append(name, rm);
    $domainList.appendChild(li);
  }
}

chrome.storage.sync.get(__magicLensDefaults, ({ disabledDomains }) => renderDomains(disabledDomains));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.disabledDomains) renderDomains(changes.disabledDomains.newValue);
});

$domainAdd.addEventListener('click', () => {
  const host = window.__magicLensNormDomain($domainInput.value);
  if (!host) return showDomainErr('无法识别该域名，请输入如 example.com 或完整网址');
  showDomainErr('');
  $domainInput.value = '';
  chrome.storage.sync.get(__magicLensDefaults, ({ disabledDomains }) => {
    if (disabledDomains.includes(host)) return; // 幂等：重复添加静默忽略
    chrome.storage.sync.set({ disabledDomains: [...disabledDomains, host] });
  });
});

// 回车即添加
$domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $domainAdd.click();
});
