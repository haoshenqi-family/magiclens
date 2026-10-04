/* MagicLens 设置页：服务地址 / Token / 自动翻译开关，存 chrome.storage.sync。 */
const $apiBase = document.getElementById('apiBase');
const $token = document.getElementById('token');
const $auto = document.getElementById('autoTranslate');
const $result = document.getElementById('testResult');

chrome.storage.sync.get({ apiBase: 'http://192.168.31.9:8082', token: '', autoTranslate: true }, (c) => {
  $apiBase.value = c.apiBase;
  $token.value = c.token;
  $auto.checked = c.autoTranslate;
});

function save() {
  chrome.storage.sync.set({
    apiBase: $apiBase.value.trim().replace(/\/+$/, ''),
    token: $token.value.trim(),
    autoTranslate: $auto.checked,
  });
}

document.getElementById('save').addEventListener('click', () => {
  save();
  showResult(true, '已保存');
});

document.getElementById('test').addEventListener('click', () => {
  save(); // 用当前填写的配置测试
  showResult(false, '连接中…');
  chrome.runtime.sendMessage({ type: 'ml:settings' }, (resp) => {
    if (chrome.runtime.lastError) return showResult(false, chrome.runtime.lastError.message);
    if (resp && resp.ok) return showResult(true, '✓ 连接成功，moon-well 鉴权有效');
    showResult(false, `✗ ${(resp && resp.error) || '连接失败'}`);
  });
});

function showResult(ok, text) {
  $result.textContent = text;
  $result.className = ok ? 'ok' : 'err';
}
