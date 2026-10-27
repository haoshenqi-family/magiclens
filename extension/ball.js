/* MagicLens 常驻入口悬浮球（R54）：网页右下角的固定小圆钮，点击打开伴读抽屉。
 *
 * Why 独立文件不塞进 content.js：划词引擎已是 688 行巨石（L2 阶段二拆分在案），
 * 常驻入口是独立关注点；同隔离世界直接复用 chat.js 暴露的 __magicLensAsk 钩子，
 * 零新消息类型。
 * 开关链路：设置页「常驻入口」复选框 + 首次安装引导卡片（options，ballAsked 记录
 * 已表态）→ chrome.storage.sync 单一事实源；本模块只读配置 + 挂 onChanged 实时
 * 显隐（已打开页面无需刷新）。域名管理名单、主开关与划词/高亮共用同一判定
 *（common.js __magicLensBallVisible）。
 * 失效即退役：扩展重载后旧球经 rpc onInvalidated 自行摘除，不留死 UI（R39 口径）。 */
(() => {
  if (window.__magicLensBallLoaded) return;
  window.__magicLensBallLoaded = true;

  let host = null;
  let visible = false;

  function remove() {
    if (host) { host.remove(); host = null; }
    visible = false;
  }

  function build() {
    host = document.createElement('div');
    host.id = 'magiclens-ball-host';
    const shadow = host.attachShadow({ mode: 'closed' }); // AGENTS 硬性约定：closed Shadow DOM
    const style = document.createElement('style');
    // Why fixed 定位在 shadow 内元素而非 host：host 保持零尺寸不参与布局，
    // 宿主页对 div 的全局样式（如 display:flex!）不影响球的位置
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      /* z-index 压在抽屉遮罩（2147483646）之下：抽屉打开时球被半透明遮罩盖住，
         不出现「球浮在遮罩上」的穿层 */
      .ball { position: fixed; right: 18px; bottom: 18px; z-index: 2147483645;
        width: 44px; height: 44px; border-radius: 50%; cursor: pointer; border: none;
        padding: 0; background: linear-gradient(135deg, #6366f1, #4338ca); color: #fff;
        font: 700 12px/44px -apple-system, 'PingFang SC', 'Segoe UI', sans-serif;
        text-align: center; letter-spacing: .5px;
        box-shadow: 0 4px 14px rgba(67, 56, 202, .4);
        opacity: .92; transition: opacity .15s ease, transform .15s ease; }
      .ball:hover { opacity: 1; transform: scale(1.06); }
      .ball:active { transform: scale(.97); }
    `;
    const btn = document.createElement('button');
    btn.className = 'ball';
    btn.textContent = 'AI';
    btn.title = 'MagicLens 伴读（点击打开）';
    btn.setAttribute('aria-label', '打开 MagicLens 伴读');
    btn.addEventListener('click', () => {
      // chat.js 同隔离世界钩子；扩展重载后旧 chat.js 副本已退役、__magicLensAsk
      // 不存在时本球的下一次 sync 也会经失效钩子摘除自己
      if (typeof window.__magicLensAsk === 'function') window.__magicLensAsk('');
    });
    shadow.append(style, btn);
    (document.body || document.documentElement).appendChild(host);
    visible = true;
  }

  function sync() {
    chrome.storage.sync.get(__magicLensDefaults, (cfg) => {
      if (chrome.runtime.lastError) return; // 上下文已失效：交给退役钩子
      const want = window.__magicLensBallVisible(cfg, location.hostname, window === window.top);
      if (want && !visible) build();
      else if (!want && visible) remove();
    });
  }

  __magicLensRpc.onInvalidated(remove);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled || changes.ballEnabled || changes.disabledDomains) sync();
  });
  sync();
})();
