/* MagicLens 弹窗：总开关 + 生词高亮开关 + 配置状态入口。配置细节在 options 页维护。 */
const $enabled = document.getElementById('enabled');
const $hl = document.getElementById('hl');
const $status = document.getElementById('status');
const $ver = document.getElementById('ver');
// 本站启用开关（R25 域名管理）
const $siteRow = document.getElementById('siteRow');
const $site = document.getElementById('siteEnabled');
const $siteHost = document.getElementById('siteHost');
let siteHost = null;
let siteDisabled = null; // null = 非 http(s) 页或状态未就绪

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

/* ---------- 本站启用/禁用（R25 域名管理） ----------
 * 状态按「本站当前是否被禁」显示（isDisabledHost，含父域条目覆盖的情形）；
 * 恢复时移除所有覆盖本站的条目（含父域，如 a.example.com 的恢复会连带移除
 * example.com），否则勾上了实际仍被父域禁着，状态与行为自相矛盾。 */
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  let url = null;
  try { url = tab && tab.url ? new URL(tab.url) : null; } catch { /* 非法 URL 按不支持处理 */ }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return;
  // Why 过一遍归一化：URL hostname 可能带尾点（http://example.com./），原样入库
  // 会让 options 的 includes() 判重认不出与 'example.com' 是同一站点
  siteHost = window.__magicLensNormDomain(url.hostname) || url.hostname;
  $siteHost.textContent = siteHost;
  $siteRow.hidden = false;
  chrome.storage.sync.get({ disabledDomains: [] }, ({ disabledDomains }) => {
    siteDisabled = window.__magicLensIsDisabledHost(siteHost, disabledDomains);
    $site.checked = !siteDisabled;
  });
});

$site.addEventListener('change', () => {
  if (!siteHost) return;
  chrome.storage.sync.get({ disabledDomains: [] }, ({ disabledDomains }) => {
    const next = $site.checked
      ? disabledDomains.filter((d) => {
        const n = window.__magicLensNormDomain(d);
        return !(n && (siteHost === n || siteHost.endsWith(`.${n}`)));
      })
      : [...new Set([...disabledDomains, siteHost])]; // hostname 本身已归一化；Set 兜重复
    chrome.storage.sync.set({ disabledDomains: next }, () => {
      siteDisabled = !$site.checked;
      showStatus($site.checked, $site.checked ? '已恢复本站，刷新页面后生效' : '已禁用本站，刷新页面后生效');
    });
  });
});

document.getElementById('rescan').addEventListener('click', () => {
  // R25：本站已被域名管理禁用时，提示真实原因而非「不支持扫描」
  if (siteDisabled) return showStatus(false, '本站已在域名管理中禁用，恢复后刷新生效');
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
