/* MagicLens 统一 RPC 门面（R46，架构评审 L1 / X1 本仓部分）：
 * content.js / highlight.js / chat.js 三份消息封装此前语义各异——
 * content {ok,error}+失效退役、highlight 吞错返 null+失效 teardown、
 * chat Promise {ok,error,status}+失效换文案——传输与失效分类各自手抄，
 * 口径靠注释对齐（R16/R24 类漂移的温床）。
 *
 * 本文件只统一「传输 + 失效分类 + 退役钩子」：
 *  - send(msg, onResult)：同步抛与回调 lastError 两路过同一失效分类器；
 *  - onInvalidated(fn)：失效时依次通知退役钩子（content=retireOrphan、
 *    highlight=teardown；chat 经调用方文案分支），注册侧各自保留副作用；
 *  - 调用方薄包装保留各自返回契约（{ok,error} / null / Promise），互不迁就；
 *  - 消息类型常量集中（MSG），新增消息一律从表取，禁止裸字符串扩散。
 *
 * 挂载：content script 三件套经 manifest 注入（common.js 之后）；background
 * 经 importScripts（service worker 无 window，统一 globalThis 挂载）。
 */
(() => {
  const g = typeof window !== 'undefined' ? window : globalThis;
  if (g.__magicLensRpc) return;

  const hooks = new Set();
  const isInvalidated = (m) => /invalidated|disposed/i.test(String(m || ''));
  const onInvalidated = (fn) => hooks.add(fn);
  const notifyInvalidated = () => hooks.forEach((fn) => { try { fn(); } catch { /* 钩子异常不阻断彼此 */ } });

  /** 统一发送：onResult(resp, err)——err 非空时 resp 为 null。
   * 失效（Extension context invalidated / disposed）：先触发全部退役钩子，
   * 再以 (null, 原文) 回调——调用方薄包装决定是否还需要回 UI。 */
  function send(msg, onResult) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) throw new Error('Extension context invalidated');
      chrome.runtime.sendMessage(msg, (resp) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          const m = String((lastErr && lastErr.message) || lastErr);
          if (isInvalidated(m)) notifyInvalidated();
          return onResult(null, m);
        }
        onResult(resp || null, null);
      });
    } catch (e) {
      const m = String((e && e.message) || e);
      if (isInvalidated(m)) notifyInvalidated();
      onResult(null, m);
    }
  }

  /** 消息类型注册表（接收端 background 的 case 与发送端共用同一表）。 */
  const MSG = Object.freeze({
    ML_ANALYZE: 'ml:analyze',
    ML_API: 'ml:api',
    ML_AUTH: 'ml:auth',
    ML_DETAIL: 'ml:detail',
    ML_FAMILIAR: 'ml:familiar',
    ML_HL_RESCAN: 'ml:hl-rescan',
    ML_HL_TOGGLE: 'ml:hl-toggle',
    ML_LOGIN: 'ml:login',
    ML_LOGIN_OK: 'ml:login-ok',
    ML_LOGOUT: 'ml:logout',
    ML_MARK: 'ml:mark',
    ML_OPENSELECTION: 'ml:openSelection',
    ML_OPENOPTIONS: 'ml:openOptions',
    // R53 伴读语音：START/STOP/CANCEL 是 content→SW；GO/DONE 是 SW→offscreen 文档的
    // 内部转发。Why 分两套：content 的 runtime.sendMessage 会广播到全部扩展上下文
    //（含 offscreen），offscreen 只认自己那两个类型、其余不回话，避免抢占响应通道。
    ML_REC_CANCEL: 'ml:rec-cancel',
    ML_REC_DONE: 'ml:rec-done',
    ML_REC_GO: 'ml:rec-go',
    ML_REC_START: 'ml:rec-start',
    ML_REC_STOP: 'ml:rec-stop',
    ML_REGISTER: 'ml:register',
    ML_SELECTION: 'ml:selection',
    ML_SETTINGS: 'ml:settings',
    ML_TRANSLATE: 'ml:translate',
    ML_TTS_SPEAK: 'ml:tts-speak',
  });

  g.__magicLensRpc = { send, onInvalidated, isInvalidated, MSG };
})();
