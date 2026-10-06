/* MagicLens 弹窗：总开关 + 配置状态入口。配置细节在 options 页维护。 */
const $enabled = document.getElementById('enabled');
const $status = document.getElementById('status');
const $ver = document.getElementById('ver');

// 优先展示 version_name（X.Y.Z-YYYYMMDDHHmm，带修改时间戳），便于对应到具体一次修改
const mlManifest = chrome.runtime.getManifest();
$ver.textContent = `v${mlManifest.version_name || mlManifest.version}`;

chrome.storage.sync.get({ enabled: true }, (c) => {
  $enabled.checked = c.enabled;
});
$enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: $enabled.checked });
});

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
