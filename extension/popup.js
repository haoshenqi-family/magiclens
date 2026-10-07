/* MagicLens 弹窗：总开关 + 生词高亮开关 + 配置状态入口。配置细节在 options 页维护。 */
const $enabled = document.getElementById('enabled');
const $hl = document.getElementById('hl');
const $status = document.getElementById('status');
const $ver = document.getElementById('ver');

// 优先展示 version_name（X.Y.Z-YYYYMMDDHHmm，带修改时间戳），便于对应到具体一次修改
const mlManifest = chrome.runtime.getManifest();
$ver.textContent = `v${mlManifest.version_name || mlManifest.version}`;

chrome.storage.sync.get({ enabled: true, hlEnabled: true }, (c) => {
  $enabled.checked = c.enabled;
  $hl.checked = c.hlEnabled;
});
$enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: $enabled.checked });
});
$hl.addEventListener('change', () => {
  // Why 直写 storage 而非发消息：与 Alt+U 快捷键同一落点（highlight.js 经 storage.onChanged 自行启停）
  chrome.storage.sync.set({ hlEnabled: $hl.checked });
});

document.getElementById('rescan').addEventListener('click', () => {
  $status.className = '';
  $status.textContent = '扫描中…';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return showStatus(false, '找不到当前标签页');
    chrome.tabs.sendMessage(tab.id, { type: 'ml:hl-rescan' }, (resp) => {
      if (chrome.runtime.lastError) return showStatus(false, '本页不支持扫描（浏览器内置页等）');
      if (resp && resp.ok) return showStatus(true, '✓ 已重新扫描生词');
      showStatus(false, (resp && resp.error) || '扫描失败');
    });
  });
});

function showStatus(ok, text) {
  $status.className = ok ? '' : 'warn';
  $status.textContent = text;
}

chrome.storage.sync.get({ token: '' }, ({ token }) => {
  if (token) {
    $status.textContent = '已登录，划词即可翻译';
  } else {
    $status.textContent = '未登录，点「设置」登录后使用';
    $status.classList.add('warn');
  }
});

document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
