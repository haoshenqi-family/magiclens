/* MagicLens 弹窗：总开关 + 配置状态入口。配置细节在 options 页维护。 */
const $enabled = document.getElementById('enabled');
const $status = document.getElementById('status');
const $ver = document.getElementById('ver');

$ver.textContent = `v${chrome.runtime.getManifest().version}`;

chrome.storage.sync.get({ enabled: true }, (c) => {
  $enabled.checked = c.enabled;
});
$enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: $enabled.checked });
});

chrome.storage.sync.get({ apiBase: '', token: '' }, ({ apiBase, token }) => {
  if (apiBase && token) {
    $status.textContent = '已配置，划词即可翻译';
  } else {
    $status.textContent = '未配置服务地址或 Token，请先完成设置';
    $status.classList.add('warn');
  }
});

document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
