/* MagicLens 金山词霸直连域（R47/L3，架构评审：自 background.js 迁出的领域代码）。
 * Why 独立模块：service worker 的职责是「消息路由 + moon-well API 中转」，金山 suggest
 * 直连（R15 快路径）、Porter 词干化（Lucene 8.3.0 口径）与 session 缓存是自成一体的
 * 领域逻辑——路由文件只按 MSG 分发，领域细节全部在本模块。
 * 口径与后端 IcibaDictClient 完全一致：免费无凭证 suggest、仅收首条 key 与查询词全等
 * （忽略大小写）、一切异常静默降级——miss/异常回退 moon-well（ES 缓存 + 词干还原 +
 * LLM 兜底），金山接口变动只影响速度，不影响正确性。
 * 挂载：background 经 importScripts（globalThis，service worker 无 window）。
 */
(() => {
  const g = typeof window !== 'undefined' ? window : globalThis;

  /* ---------- 金山词霸 suggest 直连（单词划词快路径，R15） ----------
   * Why：单词翻译不再绕行 moon-well（浏览器→Traefik→Tailscale→fnOS 才到金山，两段
   * TLS + 一段隧道），service worker 持 <all_urls> host_permissions 天然豁免 CORS，
   * 直连通常百毫秒级且免登录。口径与后端 IcibaDictClient 完全一致：免费无凭证的
   * suggest 接口、仅接受首条 key 与查询词全等（忽略大小写）的结果、一切异常静默
   * 降级——词典 miss/异常回退 moon-well /vocabulary/reading/translate（ES 缓存、
   * 后端词干还原与 LLM 兜底原样保留），金山接口变动只影响速度，不影响正确性。 */

  const ICIBA_URL =
    'https://dict-mobile.iciba.com/interface/index.php?c=word&m=getsuggest&nums=1&is_need_mean=1&word=';
  // Why 每次直查也必须带超时：接口不可用时不能让单词气泡比走 moon-well 还慢
  const ICIBA_TIMEOUT_MS = 2500;
  // 划词「单词」判定，与后端 ReadingVocabularyService.WORD_PATTERN 一致
  const WORD_PATTERN = /^[A-Za-z][A-Za-z'’-]*$/;
  // session 缓存（含 miss 负缓存）：重复划词零网络。Why 不持久化：权威缓存在
  // moon-well ES（跨设备），本地陈旧词条没必要跨浏览器会话存活
  const ICIBA_CACHE_KEY = 'icibaCache';
  const ICIBA_CACHE_CAP = 512;

  // —— Porter 词干化，对齐 moon-well WordStemmer 依赖的 Lucene 8.3.0 EnglishAnalyzer ——
  // Why 是 Lucene 版而非 1980 原始版：后端口径以 Lucene 为准（bli→ble 替代 abli→able、
  // 新增 logi→log；wolves→wolv、agreed→agre 是实测输出，原论文注释只是中间值），
  // 本实现已用 94 向量对照 Lucene 实测逐一验证。即使未来出现偏差，后果仅是金山多
  // miss 一次 → 回退 moon-well（后端权威兜底），不会产生错误翻译。
  const EN_STOPWORDS = new Set(('a an and are as at be but by for if in into is it ' +
    'no not of on or such that the their then there these they this to was will with').split(' '));

  function porterStem(input) {
    let w = input;
    if (w.length <= 2) return w;
    const cons = (i) => {
      const c = w[i];
      if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') return false;
      if (c === 'y') return i === 0 ? true : !cons(i - 1);
      return true;
    };
    // Porter m()：w[0..j] 内 VC 序列个数
    const measure = (j) => {
      let n = 0, i = 0;
      while (true) {
        if (i > j) return n;
        if (!cons(i)) break;
        i++;
      }
      i++;
      while (true) {
        while (true) {
          if (i > j) return n;
          if (cons(i)) break;
          i++;
        }
        i++; n++;
        while (true) {
          if (i > j) return n;
          if (!cons(i)) break;
          i++;
        }
        i++;
      }
    };
    const vowelInStem = (j) => {
      for (let i = 0; i <= j; i++) if (!cons(i)) return true;
      return false;
    };
    const doubleC = (j) => j >= 1 && w[j] === w[j - 1] && cons(j);
    // *o：词干以 c v c 结尾且末位非 w/x/y
    const cvc = (i) => i >= 2 && cons(i) && !cons(i - 1) && cons(i - 2) && w[i] !== 'w' && w[i] !== 'x' && w[i] !== 'y';

    // step1（原 1a+1b）：复数与 -ed/-ing
    if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('ies')) w = w.slice(0, -2);
    else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);
    if (w.endsWith('eed')) {
      if (measure(w.length - 4) > 0) w = w.slice(0, -1);
    } else {
      let stripped = false;
      if (w.endsWith('ed') && vowelInStem(w.length - 3)) { w = w.slice(0, -2); stripped = true; }
      else if (w.endsWith('ing') && vowelInStem(w.length - 4)) { w = w.slice(0, -3); stripped = true; }
      if (stripped) {
        if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
        else if (doubleC(w.length - 1) && w[w.length - 1] !== 'l' && w[w.length - 1] !== 's' && w[w.length - 1] !== 'z') w = w.slice(0, -1);
        else if (measure(w.length - 1) === 1 && cvc(w.length - 1)) w += 'e';
      }
    }
    // step2（原 1c）：(*v*) Y→I
    if (w.endsWith('y') && vowelInStem(w.length - 2)) w = w.slice(0, -1) + 'i';
    // step3（原 2）：双后缀映射（首条命中即止，m(stem)>0 才替换）
    const step3 = [['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
      ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'],
      ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'],
      ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
      ['iviti', 'ive'], ['biliti', 'ble'], ['logi', 'log']];
    for (const [suf, rep] of step3) {
      if (w.endsWith(suf)) {
        const j = w.length - suf.length - 1;
        if (measure(j) > 0) w = w.slice(0, j + 1) + rep;
        break;
      }
    }
    // step4（原 3）：-icate/-ative/-alize/-iciti/-ical/-ful/-ness
    const step4 = [['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']];
    for (const [suf, rep] of step4) {
      if (w.endsWith(suf)) {
        const j = w.length - suf.length - 1;
        if (measure(j) > 0) w = w.slice(0, j + 1) + rep;
        break;
      }
    }
    // step5（原 4）：m>1 剥离固定后缀（按倒数第二字符分派，同 Lucene switch 语义）
    const step5fam = { a: ['al'], c: ['ance', 'ence'], e: ['er'], i: ['ic'], l: ['able', 'ible'],
      n: ['ant', 'ement', 'ment', 'ent'], o: ['ion', 'ou'], s: ['ism'], t: ['ate', 'iti'],
      u: ['ous'], v: ['ive'], z: ['ize'] };
    const fam = step5fam[w[w.length - 2]];
    if (fam) {
      for (const suf of fam) {
        if (!w.endsWith(suf)) continue;
        if (suf === 'ion') {
          const j = w.length - 4;
          if (j >= 0 && (w[j] === 's' || w[j] === 't') && measure(j) > 1) w = w.slice(0, j + 1);
        } else {
          const j = w.length - suf.length - 1;
          if (measure(j) > 1) w = w.slice(0, j + 1);
        }
        break;
      }
    }
    // step6（原 5a+5b）：m>1 或 m=1 且非 *o 去 E；m>1 且 LL → 单 L
    if (w.endsWith('e')) {
      const a = measure(w.length - 1);
      if (a > 1 || (a === 1 && !cvc(w.length - 2))) w = w.slice(0, -1);
    }
    if (w.endsWith('l') && doubleC(w.length - 1) && measure(w.length - 1) > 1) w = w.slice(0, -1);
    return w;
  }

  // 对齐后端 WordStemmer.stemWord：小写 → 剥所有格 → 纯字母校验 → 停用词过滤 → Porter
  function stemWord(word) {
    let lower = word.trim().toLowerCase();
    if (!lower) return null;
    if (lower.endsWith("'s") || lower.endsWith('’s')) lower = lower.slice(0, -2);
    // 残留撇号/连字符（don't / mother-in-law）→ 非屈折形态，不还原
    if (!/^[a-z]+$/.test(lower)) return null;
    // 停用词（the、of 等）后端被分析器过滤返回 null；直查 miss 后同样不重查
    if (EN_STOPWORDS.has(lower)) return null;
    return porterStem(lower);
  }

  async function icibaCacheGet(word) {
    const store = await chrome.storage.session.get(ICIBA_CACHE_KEY);
    const cache = store[ICIBA_CACHE_KEY];
    return cache && Object.prototype.hasOwnProperty.call(cache, word) ? cache[word] : undefined;
  }

  async function icibaCachePut(word, paraphrase) {
    const store = await chrome.storage.session.get(ICIBA_CACHE_KEY);
    const cache = store[ICIBA_CACHE_KEY] || {};
    cache[word] = paraphrase;
    // 超容量按插入序淘汰最旧（字符串键保持插入序；命中不刷新位次，与后端
    // accessOrder LRU 略有差异，512 上限下无实际影响）
    const keys = Object.keys(cache);
    for (const k of keys.slice(0, Math.max(0, keys.length - ICIBA_CACHE_CAP))) delete cache[k];
    await chrome.storage.session.set({ [ICIBA_CACHE_KEY]: cache });
  }

  // suggest 会模糊匹配：仅接受首条记录 key 与查询词完全一致（忽略大小写）的结果
  function parseIcibaParaphrase(payload, word) {
    const first = payload && Array.isArray(payload.message) ? payload.message[0] : null;
    if (!first || typeof first.key !== 'string') return null;
    if (first.key.trim().toLowerCase() !== word) return null;
    const paraphrase = typeof first.paraphrase === 'string' ? first.paraphrase.trim() : '';
    return paraphrase || null;
  }

  // 查询单词释义；miss/异常返回 null（异常同样写负缓存：接口不可用时同一词不再白等超时）
  async function icibaLookup(word) {
    const key = word.trim().toLowerCase();
    if (!key) return null;
    const cached = await icibaCacheGet(key);
    if (cached !== undefined) return cached || null;
    let paraphrase = null;
    try {
      const resp = await fetch(ICIBA_URL + encodeURIComponent(key), {
        signal: AbortSignal.timeout(ICIBA_TIMEOUT_MS),
      });
      paraphrase = parseIcibaParaphrase(await resp.json(), key);
    } catch {
      /* 网络/超时/非 JSON：静默降级，与后端 IcibaDictClient 同哲学 */
    }
    await icibaCachePut(key, paraphrase || '');
    return paraphrase;
  }

  // 带词形还原的查询：原词 miss 后剥所有格 + Porter 词干重查一次（sidebars→sidebar），
  // 与后端 IcibaDictClient.lookupWithStemming 同构；还原词与原词相同不重查
  async function icibaLookupWithStemming(word) {
    const direct = await icibaLookup(word);
    if (direct) return direct;
    const stem = stemWord(word);
    if (!stem || stem === word.trim().toLowerCase()) return null;
    return icibaLookup(stem);
  }

  // R40 查词补报：会话内去重即可（SW 挂起重置后服务端幂等兜底），遥测失败静默
  const reportedLookups = new Set();


  g.__magicLensIciba = {
    WORD_PATTERN,
    lookupWithStemming: icibaLookupWithStemming,
    lookup: icibaLookup,
    stemWord,
  };
})();
