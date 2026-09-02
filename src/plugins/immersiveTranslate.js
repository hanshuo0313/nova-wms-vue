// src/plugins/immersiveTranslate.js
import axios from 'axios';
// import { getEnabled as fetchGlossary } from '@/api/wms/glossary'; // 改用 translateAxios 避免触发 401 弹窗

export default {
  install(app, options = {}) {
    const {
      apiEndpoint = 'http://localhost:5000/translate',
      sourceLang = 'zh',
      targetLang = 'en',
      languages = [
        { code: 'zh', label: '中文', flag: '🇨🇳' },
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' },
        { code: 'ko', label: '한국어', flag: '🇰🇷' }
      ],
      cacheEnabled = true,
      excludeSelectors = 'script, style, code, pre, .no-translate, .el-pagination, .pagination-container',
      autoTranslateOnRouteChange = false,
      persistentCache = true,
      cacheStorageKey = 'translation_cache_v1'
    } = options;

    // 当前实际使用的目标语言（可动态切换）
    let currentTargetLang = targetLang;

    // 创建独立的 axios 实例（避免被项目拦截器干扰）
    const translateAxios = axios.create({
      baseURL: '',
      timeout: 30000, // 30秒超时，给首次加载留足时间
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 缓存
    const translationCache = new Map();

    // 从 localStorage 加载持久化缓存
    if (persistentCache && cacheEnabled) {
      loadPersistentCache();
    }

    // 当前翻译状态
    let isTranslated = false;
    let _tableFingerprint = '';  // 表格翻译指纹（模块级，方便 restorePage 重置）

    // MutationObserver 实例（用于监听动态内容）
    let observer = null;

    // ---------- 注入翻译自适应样式（容器自动扩展适配译文） ----------
    function injectTranslationStyles() {
      if (document.getElementById('__immersive_translate_styles')) return;
      const style = document.createElement('style');
      style.id = '__immersive_translate_styles';
      style.textContent = `
        /* 翻译节点基础：允许文字在容器内自动换行 */
        .translated-node {
          word-break: break-word;
          overflow-wrap: anywhere;
          hyphens: auto;
          line-height: inherit;
        }
        .translated-node .translated-text {
          word-break: break-word;
          overflow-wrap: anywhere;
          hyphens: auto;
        }
        /* 表格：允许列宽根据内容自动扩展 */
        .el-table .translated-node,
        .el-table__row .translated-node,
        table .translated-node {
          display: inline;
          max-width: 100%;
        }
        .el-table .translated-node .translated-text,
        .el-table__row .translated-node .translated-text,
        table .translated-node .translated-text {
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        /* 表头：允许换行 + 自动扩展 */
        .el-table__header .translated-node .translated-text {
          white-space: normal;
          word-break: break-word;
        }
        /* 单元格内容自动换行 */
        .el-table .cell {
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        /* 表格单元格宽度自动适配内容 */
        .el-table th.el-table__cell,
        .el-table td.el-table__cell {
          min-width: fit-content;
        }

        /* 表单标签：允许自动扩展宽度 */
        .el-form-item__label:has(.translated-node) {
          width: auto !important;
          min-width: 80px;
          white-space: nowrap;
          padding-right: 12px;
        }

        /* 按钮/标签：紧凑显示，超长省略号 */
        .el-button .translated-node .translated-text,
        .el-tag .translated-node .translated-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          max-width: 100%;
          vertical-align: middle;
        }
        /* 面包屑 */
        .el-breadcrumb .translated-node .translated-text {
          white-space: nowrap;
        }
      `;
      document.head.appendChild(style);
    }

    // ---------- 请求取消控制器 ----------
    let abortController = null; // 用于取消所有飞行中的翻译请求

    // 取消所有正在飞行的翻译请求
    function abortPendingRequests() {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      pendingTranslations.clear();
    }

    // 确保有一个可用的 AbortController
    function ensureAbortController() {
      if (!abortController || abortController.signal.aborted) {
        abortController = new AbortController();
      }
      return abortController;
    }

    // ---------- 术语词典（从后端 API 动态加载） ----------
    const glossaryMap = new Map(); // 运行时词典：中文 -> 英文

    /**
     * 从后端 API 加载术语词典
     * 后端需返回格式：{ code: 200, data: { "中文": "English", ... } }
     * 支持 localStorage 缓存，下次启动秒加载
     * 多语言：每种 targetLang 独立缓存，互不干扰
     */
    async function loadGlossary() {
      // 1. 先从 localStorage 快速加载（每种语言独立 key）
      const CACHE_KEY = `translation_glossary_v1_${currentTargetLang}`;
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          Object.entries(data).forEach(([zh, translated]) => glossaryMap.set(zh.trim(), translated));
          console.log(`[翻译插件] 词典[${currentTargetLang}]从缓存加载，共 ${glossaryMap.size} 条`);
        }
      } catch (e) { /* 忽略缓存读取错误 */ }

      // 2. 从后端 API 更新（使用独立 axios 实例，避免触发认证拦截器的 401 弹窗）
      try {
        // 从 Cookie 获取 Token（与项目 auth.js 中的 TokenKey 一致）
        const token = document.cookie.split('; ').find(row => row.startsWith('Admin-Token='))?.split('=')[1] || '';
        
        // 词典 API 在 WMS 后端，需要通过代理前缀访问
        const baseApi = import.meta.env.VITE_APP_BASE_API || '/dev-api';
        const res = await translateAxios.get(`${baseApi}/wms/glossary/enabled`, {
          params: { targetLang: currentTargetLang },
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const data = res?.data?.data || res?.data?.rows || null;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          glossaryMap.clear();
          Object.entries(data).forEach(([zh, translated]) => glossaryMap.set(zh.trim(), translated));
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          console.log(`[翻译插件] 词典[${currentTargetLang}]从 API 更新成功，共 ${glossaryMap.size} 条`);
          console.log(`[翻译插件] 词典内容:`, Object.fromEntries(glossaryMap));
        } else {
          console.warn(`[翻译插件] 词典[${currentTargetLang}] API 返回格式异常:`, res?.data);
        }
      } catch (e) {
        console.warn(`[翻译插件] 词典[${currentTargetLang}] API 请求失败，使用缓存版本`, e.message);
      }
    }

    /**
     * 术语词典子串替换：在文本中查找并替换词典术语
     * 例如："传送带: 4500 Dual-stacked" + 词典{"传送带":"Conveyor belt"} → "Conveyor belt: 4500 Dual-stacked"
     * 按长度降序匹配，优先替换更长的术语，避免短术语错误匹配长术语的一部分
     */
    function applyGlossarySubstring(text) {
      if (!glossaryMap.size) return null;
      // 按原文长度降序排列，优先匹配更长的术语
      const sorted = [...glossaryMap.entries()].sort((a, b) => b[0].length - a[0].length);
      let result = text;
      let replaced = false;
      for (const [source, target] of sorted) {
        if (result.includes(source)) {
          result = result.split(source).join(target);
          replaced = true;
        }
      }
      return replaced ? result : null;
    }

    // ---------- 增量翻译优化：去重、微批次、重试 ----------
    const pendingTranslations = new Map(); // text -> Promise<translation> 去重正在飞行的请求
    const INCREMENTAL_BATCH_SIZE = 1; // 增量翻译每批条数（LibreTranslate 逐行处理，批次越小越稳定）
    const BATCH_DELAY_MS = 200; // 批次间隔(ms)，防止 CPU 打满
    const INCREMENTAL_TIMEOUT = 60000; // 增量翻译批次超时(ms)
    const SINGLE_TIMEOUT = 25000; // 降级逐条翻译超时(ms)，比批次更长
    const MAX_RETRY = 2; // 最大重试次数

    // 翻译单条文本（带去重 + 重试 + AbortController + 递增超时）
    function translateSingle(text, retryCount = 0) {
      // 缓存命中直接返回
      if (cacheEnabled && translationCache.has(text)) {
        return Promise.resolve(translationCache.get(text));
      }
      // 已有相同请求在飞行中，复用
      if (pendingTranslations.has(text)) {
        return pendingTranslations.get(text);
      }
      const controller = ensureAbortController();
      // 逐条翻译使用更长的超时，重试时逐步增加超时
      const singleTimeout = SINGLE_TIMEOUT + retryCount * 5000;
      const promise = (async () => {
        try {
          const response = await translateAxios.post(apiEndpoint, {
            q: text,
            source: sourceLang,
            target: currentTargetLang,
            format: 'text'
          }, { timeout: singleTimeout, signal: controller.signal });
          const result = response.data.translatedText || text;
          if (cacheEnabled && result !== text) {
            translationCache.set(text, result);
          }
          return result;
        } catch (e) {
          if (e.name === 'CanceledError' || e.name === 'AbortError') {
            return text; // 被主动取消，不重试
          }
          // 重试机制：失败后最多重试 MAX_RETRY 次（取消后不重试，超时重试间隔更长）
          if (retryCount < MAX_RETRY && !controller.signal.aborted) {
            const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout');
            const delay = isTimeout ? 500 * (retryCount + 1) : 200 * (retryCount + 1);
            await new Promise(r => setTimeout(r, delay));
            pendingTranslations.delete(text);
            return translateSingle(text, retryCount + 1);
          }
          console.warn('[翻译插件] 单条翻译失败:', text.slice(0, 30), e.message);
          return text;
        } finally {
          pendingTranslations.delete(text);
        }
      })();
      pendingTranslations.set(text, promise);
      return promise;
    }

    // 发送一批翻译请求（带重试）
    async function requestBatchTranslation(batch, retryCount = 0) {
      const controller = ensureAbortController();
      const combined = batch.join('\n');
      try {
        const response = await translateAxios.post(apiEndpoint, {
          q: combined,
          source: sourceLang,
          target: currentTargetLang,
          format: 'text'
        }, { timeout: INCREMENTAL_TIMEOUT, signal: controller.signal });

        const translatedText = response.data.translatedText;
        const parts = translatedText.split('\n');
        batch.forEach((text, idx) => {
          const trans = parts[idx] || text;
          if (cacheEnabled && trans !== text) {
            translationCache.set(text, trans);
          }
        });
        return true;
      } catch (e) {
        if (e.name === 'CanceledError' || e.name === 'AbortError') {
          return false; // 被主动取消
        }
        // 重试机制：批次失败后重试（取消后不重试，超时重试间隔更长）
        if (retryCount < MAX_RETRY && !controller.signal.aborted) {
          const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout');
          const delay = isTimeout ? 500 * (retryCount + 1) : 200 * (retryCount + 1);
          console.warn(`[翻译插件] 批次翻译失败(${batch.length}条)，${delay}ms 后重试...`, e.message);
          await new Promise(r => setTimeout(r, delay));
          return requestBatchTranslation(batch, retryCount + 1);
        }
        console.warn('[翻译插件] 增量批次翻译失败，降级为逐条翻译:', e.message);
        await Promise.allSettled(batch.map(t => translateSingle(t)));
        return false;
      }
    }

    // 增量翻译：批量发送（带去重 + 小批次 + 短超时 + 重试）
    // cacheOnly=true 时只使用缓存，不调用 API（用于翻页场景，避免超时卡死）
    async function translateIncrementalBatch(items, cacheOnly = false) {
      // items: [{textNode, original}]
      // 1. 快速缓存路径：先查词典、缓存，命中直接包装
      const uncached = [];
      let cachedCount = 0, skippedCount = 0;
      items.forEach(item => {
        const trimmed = item.original.trim();
        if (isNonTranslatable(item.original)) {
          skippedCount++;
          return;
        }
        if (glossaryMap.has(trimmed)) {
          cachedCount++;
          if (cacheEnabled) translationCache.set(item.original, glossaryMap.get(trimmed));
          applyTranslation(item.textNode, item.original, glossaryMap.get(trimmed));
        } else {
          const subResult = applyGlossarySubstring(trimmed);
          if (subResult) {
            cachedCount++;
            if (cacheEnabled) translationCache.set(item.original, subResult);
            applyTranslation(item.textNode, item.original, subResult);
          } else if (cacheEnabled && translationCache.has(item.original)) {
            cachedCount++;
            applyTranslation(item.textNode, item.original, translationCache.get(item.original));
          } else {
            uncached.push(item);
          }
        }
      });

      console.log(`[翻译插件] translateIncrementalBatch: 缓存命中=${cachedCount}, 跳过=${skippedCount}, 待API=${uncached.length}${cacheOnly ? ' (仅缓存模式)' : ''}`);

      // cacheOnly 模式：不调用 API，未命中缓存的内容保持原文
      if (uncached.length === 0 || cacheOnly) return;

      // 2. 去重：相同文本只翻译一次
      const uniqueTexts = [...new Set(uncached.map(i => i.original))];
      const toRequest = uniqueTexts.filter(t => !pendingTranslations.has(t) && !(cacheEnabled && translationCache.has(t)));

      // 3. 小批次顺序请求（带重试）+ 同时等待已在飞行中的重复请求
      const existingPending = uniqueTexts.filter(t => pendingTranslations.has(t));
      if (toRequest.length > 0) {
        const batches = [];
        for (let i = 0; i < toRequest.length; i += INCREMENTAL_BATCH_SIZE) {
          batches.push(toRequest.slice(i, i + INCREMENTAL_BATCH_SIZE));
        }
        // 顺序执行每个批次，避免并发压垂 API
        for (const batch of batches) {
          await requestBatchTranslation(batch);
          if (BATCH_DELAY_MS > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
        // 等待已在飞行中的重复请求
        if (existingPending.length > 0) {
          await Promise.allSettled(existingPending.map(t => pendingTranslations.get(t)));
        }
      } else if (existingPending.length > 0) {
        // 没有新请求，但有已在飞行中的重复请求
        await Promise.allSettled(existingPending.map(t => pendingTranslations.get(t)));
      }

      // 4. 包装所有节点（检查节点是否仍在 DOM 中，直接从缓存读取）
      let successCount = 0;
      uncached.forEach(item => {
        const trans = (cacheEnabled && translationCache.get(item.original)) || item.original;
        if (trans !== item.original) successCount++;
        applyTranslation(item.textNode, item.original, trans);
      });
      console.log(`[翻译插件] API翻译完成: 成功=${successCount}/${uncached.length}`);

      // 异步保存缓存
      if (cacheEnabled && successCount > 0) {
        setTimeout(() => savePersistentCache(), 200);
      }
    }

    // ---------- 持久化缓存管理（按语言隔离） ----------
    function getCacheKey(lang) {
      return `${cacheStorageKey}_${lang}`;
    }

    function loadPersistentCache(lang) {
      try {
        const cached = localStorage.getItem(getCacheKey(lang || currentTargetLang));
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.entries(parsed).forEach(([key, value]) => {
            translationCache.set(key, value);
          });
          console.log(`[翻译插件] 已加载缓存[${lang || currentTargetLang}]，共 ${translationCache.size} 条`);
        }
      } catch (e) {
        console.warn('[翻译插件] 加载持久化缓存失败:', e);
      }
    }

    function savePersistentCache(lang) {
      if (!persistentCache || !cacheEnabled) return;
      try {
        const cacheObj = {};
        translationCache.forEach((value, key) => {
          cacheObj[key] = value;
        });
        localStorage.setItem(getCacheKey(lang || currentTargetLang), JSON.stringify(cacheObj));
        console.log(`[翻译插件] 已保存缓存[${lang || currentTargetLang}]，共 ${translationCache.size} 条`);
      } catch (e) {
        console.warn('[翻译插件] 保存持久化缓存失败:', e);
        if (e.name === 'QuotaExceededError') {
          clearOldCache();
        }
      }
    }

    // 切换语言时交换缓存：保存旧语言 → 清空 → 加载新语言
    function swapCacheForLanguage(oldLang, newLang) {
      savePersistentCache(oldLang);    // 保存旧语言缓存
      translationCache.clear();        // 清空内存
      glossaryMap.clear();             // 清空词典
      loadPersistentCache(newLang);    // 加载新语言缓存
      console.log(`[翻译插件] 缓存切换: ${oldLang} → ${newLang}`);
    }

    function clearOldCache() {
      // 保留最近 500 条缓存
      const entries = Array.from(translationCache.entries());
      if (entries.length > 500) {
        const toKeep = entries.slice(-500);
        translationCache.clear();
        toKeep.forEach(([key, value]) => translationCache.set(key, value));
        savePersistentCache();
        console.log('[翻译插件] 已清理旧缓存，保留最近 500 条');
      }
    }

    // 导出缓存到 JSON 文件（开发调试用）
    function exportCacheToFile() {
      const cacheObj = {};
      translationCache.forEach((value, key) => {
        cacheObj[key] = value;
      });
      const blob = new Blob([JSON.stringify(cacheObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translation_cache_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // 从 JSON 文件导入缓存
    function importCacheFromFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          Object.entries(imported).forEach(([key, value]) => {
            translationCache.set(key, value);
          });
          savePersistentCache();
          console.log(`[翻译插件] 成功导入 ${Object.keys(imported).length} 条缓存`);
        } catch (err) {
          console.error('[翻译插件] 导入缓存失败:', err);
        }
      };
      reader.readAsText(file);
    }

    // ---------- 工具函数 ----------

    // 获取所有需要翻译的文本节点
    function getTextNodes(root) {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            // 排除特定标签
            if (parent.closest(excludeSelectors)) return NodeFilter.FILTER_REJECT;
            // 已经是翻译包裹的节点，跳过
            if (parent.closest('.translated-node')) return NodeFilter.FILTER_REJECT;
            return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );
      const nodes = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }
      return nodes;
    }

    // 表格单元格原文存储（用 Map 代替 data 属性，避免干扰 Vue DOM diffing）
    const _tableOriginalText = new Map();  // key: textNode, value: original text
    const _tableTranslatedText = new Map(); // key: textNode, value: translated text

    /**
     * 应用翻译：表格单元格直接替换文本（不用 wrapper），非表格用 wrapper
     * 表格单元格不用 wrapper 的原因：wrapper span 会干扰 Vue 的虚拟 DOM diffing，
     * 导致翻页时 Vue 无法正确更新表格数据
     */
    function applyTranslation(textNode, original, translation) {
      const inTable = !!textNode.parentElement?.closest('.el-table__body');
      if (inTable) {
        // 表格单元格：直接替换文本内容，原文存在 Map 中（不修改 DOM 属性）
        textNode.textContent = translation;
        // 仅翻译成功（译文≠原文）才记录，避免失败文本被误标记为已翻译而跳过重试
        if (translation !== original) {
          _tableTranslatedText.set(textNode, translation);
        }
        // 如果文本节点被 Vue 复用（新页数据），更新 Map 中的原文
        if (_tableOriginalText.has(textNode)) {
          const storedOriginal = _tableOriginalText.get(textNode);
          if (storedOriginal !== original) {
            _tableOriginalText.set(textNode, original);
          }
        } else {
          _tableOriginalText.set(textNode, original);
        }
      } else {
        // 非表格：使用 wrapper 方式
        wrapWithTranslation(textNode, original, translation);
      }
    }

    // 将文本替换为原文+译文的包裹节点（连接性检查 + 动态容器适配）
    let _wrapStats = { called: 0, notConnected: 0, alreadyWrapped: 0, success: 0 };
    function wrapWithTranslation(textNode, original, translation) {
      _wrapStats.called++;
      // 安全检查：节点必须仍在 DOM 中且未被其他逻辑替换
      if (!textNode || !textNode.parentNode || !textNode.isConnected) {
        _wrapStats.notConnected++;
        return;
      }
      // 防止重复包装：如果父节点已经是 translated-node 则跳过
      if (textNode.parentElement?.classList?.contains('translated-node')) {
        _wrapStats.alreadyWrapped++;
        return;
      }

      const wrapper = document.createElement('span');
      wrapper.className = 'translated-node';

      const origSpan = document.createElement('span');
      origSpan.className = 'original-text';
      origSpan.style.display = 'none';
      origSpan.textContent = original;

      const transSpan = document.createElement('span');
      transSpan.className = 'translated-text';
      transSpan.textContent = translation;

      wrapper.appendChild(origSpan);
      wrapper.appendChild(transSpan);
      textNode.replaceWith(wrapper);
      _wrapStats.success++;

      // 每批次结束后输出统计
      if (_wrapStats.called === _wrapStats.notConnected + _wrapStats.alreadyWrapped + _wrapStats.success &&
          _wrapStats.called > 0) {
        // 延迟输出，确保批次完成
        clearTimeout(wrapWithTranslation._logTimer);
        wrapWithTranslation._logTimer = setTimeout(() => {
          console.log(`[翻译插件] wrapWithTranslation: 调用=${_wrapStats.called}, 成功=${_wrapStats.success}, 未连接=${_wrapStats.notConnected}, 已包装=${_wrapStats.alreadyWrapped}`);
          _wrapStats = { called: 0, notConnected: 0, alreadyWrapped: 0, success: 0 };
        }, 100);
      }

      // 译文比原文长时，动态调整容器宽度以适应英文
      if (translation.length > original.length) {
        requestAnimationFrame(() => {
          if (!wrapper.isConnected) return;
          adjustContainerForTranslation(wrapper, transSpan, original, translation);
        });
      }
    }

    // 动态调整容器宽度以适应较长的英文译文
    function adjustContainerForTranslation(wrapper, transSpan, original, translation) {
      // 1. 测量译文实际宽度（临时设为 nowrap 获取自然宽度）
      const prevWhiteSpace = transSpan.style.whiteSpace;
      transSpan.style.whiteSpace = 'nowrap';
      const translationWidth = transSpan.scrollWidth;
      transSpan.style.whiteSpace = prevWhiteSpace;

      if (translationWidth <= 0) return;

      // 2. 处理表格列宽（最常见的场景）
      const td = wrapper.closest('td');
      const th = wrapper.closest('th');
      const tableCell = td || th;

      if (tableCell) {
        const neededWidth = translationWidth + 24; // 24px padding

        // 找到 Element Plus 的外层容器（同时包含 header 和 body 两个 table）
        const elTable = tableCell.closest('.el-table');
        if (!elTable) return;

        // 确定当前列在所有列中的索引
        const ownTable = tableCell.closest('table');
        if (!ownTable) return;

        const colgroup = ownTable.querySelector('colgroup');
        if (!colgroup) return;

        const cells = tableCell.parentNode.children;
        const colIndex = Array.from(cells).indexOf(tableCell);
        if (colIndex < 0) return;

        // 只通过 col.width 控制列宽（兼容 Element Plus 的拖拽列宽功能）
        // 不设置 th/td 的 min-width，避免阻止用户拖动列宽
        // table-layout: fixed 下，col.width 直接决定列宽
        const allTables = elTable.querySelectorAll('table');
        allTables.forEach(tbl => {
          const cg = tbl.querySelector('colgroup');
          if (cg) {
            const cols = cg.querySelectorAll('col');
            if (colIndex < cols.length) {
              const col = cols[colIndex];
              const currentColWidth = parseInt(col.style.width) || parseInt(col.getAttribute('width')) || 0;
              if (neededWidth > currentColWidth) {
                col.style.width = neededWidth + 'px';
              }
            }
          }
        });

        return;
      }

      // 3. 处理表单标签（如 "仓库" → "Warehouse"）
      const formLabel = wrapper.closest('.el-form-item__label');
      if (formLabel) {
        formLabel.style.width = 'auto';
        formLabel.style.minWidth = (translationWidth + 16) + 'px';
        return;
      }

      // 4. 通用容器：设置 min-width 确保内容不被截断
      const container = wrapper.closest('.el-card, .el-dialog, .el-drawer, .app-container');
      if (container) {
        const currentMinWidth = parseInt(getComputedStyle(container).minWidth) || 0;
        if (translationWidth + 40 > currentMinWidth) {
          container.style.minWidth = Math.min(translationWidth + 40, 400) + 'px';
        }
      }
    }

    // 还原：移除包裹，显示原文
    function unwrapTranslation(wrapper) {
      const origSpan = wrapper.querySelector('.original-text');
      if (origSpan) {
        const textNode = document.createTextNode(origSpan.textContent);
        wrapper.replaceWith(textNode);
      }
    }

    /**
     * 安全还原翻译包装：只有在数据未变时才还原原文，否则直接移除包装
     * 解决翻页时 .original-text 包含旧页数据覆盖 Vue 新数据的问题
     */
    function safeUnwrapTranslation(wrapper) {
      if (!wrapper.isConnected) return;
      const origSpan = wrapper.querySelector('.original-text');
      const transSpan = wrapper.querySelector('.translated-text');
      const parent = wrapper.parentElement;
      if (!parent) return;

      // 检查父元素中除了 wrapper 之外是否还有其他文本节点
      const otherTextNodes = Array.from(parent.childNodes).filter(n =>
        n !== wrapper && n.nodeType === Node.TEXT_NODE && n.textContent.trim()
      );

      if (otherTextNodes.length === 0) {
        // 没有其他文本节点：wrapper 是当前内容，数据未变，安全还原原文
        if (origSpan) {
          const textNode = document.createTextNode(origSpan.textContent);
          wrapper.replaceWith(textNode);
        } else {
          wrapper.remove();
        }
      } else {
        // 有其他文本节点：Vue 已更新数据，直接移除 wrapper，不动新数据
        wrapper.remove();
      }
    }

    // 批量翻译（合并长文本减少请求，支持 AbortController 取消 + 重试 + 降级）
    // 兜底：对 API 未翻译的混合文本，提取中文片段逐段翻译后回填
    // 例如 "条形码读取器-SR-5000X" 整体翻译失败时，单独翻译"条形码读取器"再拼接
    async function translateChineseSegments(text) {
      const runs = [...new Set(text.match(/[一-鿿]+/g) || [])];
      if (runs.length === 0) return null;
      // 并行翻译各中文片段
      const transList = await Promise.all(runs.map(run => translateSingle(run).catch(() => run)));
      let result = text;
      runs.forEach((run, idx) => {
        const t = transList[idx];
        if (t && t !== run) result = result.split(run).join(t);
      });
      return result !== text ? result : null;
    }

    async function batchTranslate(texts) {
      const results = [];
      const toTranslate = [];

      // 先查词典、缓存，并过滤纯数字或主要包含数字的文本
      texts.forEach((text, index) => {
        const trimmed = text.trim();
        if (glossaryMap.has(trimmed)) {
          // 词典精确命中：直接使用标准译文，不走 API
          results[index] = glossaryMap.get(trimmed);
          if (cacheEnabled) translationCache.set(text, glossaryMap.get(trimmed));
        } else {
          // 词典精确未命中，尝试子串替换
          const subResult = applyGlossarySubstring(trimmed);
          if (subResult) {
            results[index] = subResult;
            if (cacheEnabled) translationCache.set(text, subResult);
          } else if (isNonTranslatable(text)) {
            results[index] = text;
          } else if (cacheEnabled && translationCache.has(text)) {
            results[index] = translationCache.get(text);
          } else {
            toTranslate.push({ text, index });
          }
        }
      });

      if (toTranslate.length > 0) {
        const controller = ensureAbortController();
        // 分批翻译：批次过大会使单批超过超时（CPU 推理慢），过小则 HTTP 往返多。
        // 基准：10 条/批约 9s，安全低于超时；兼顾往返次数与单批耗时
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < toTranslate.length; i += batchSize) {
          batches.push(toTranslate.slice(i, i + batchSize));
        }

        console.log(`[翻译插件] 开始翻译 ${toTranslate.length} 条文本（缓存命中 ${texts.length - toTranslate.length} 条），分 ${batches.length} 批并行处理`);

        // 翻译单个批次（带重试 + 超时递增）
        const translateBatchWithRetry = async (batch, batchIndex, retryCount = 0) => {
          const combined = batch.map(item => item.text).join('\n');
          // 超时设得足够宽裕，避免 CPU 推理慢时误超时触发重试（重试会浪费一倍时间）
          const batchTimeout = 90000 + retryCount * 30000;
          try {
            const response = await translateAxios.post(apiEndpoint, {
              q: combined,
              source: sourceLang,
              target: currentTargetLang,
              format: 'text'
            }, { timeout: batchTimeout, signal: controller.signal });

            const translatedText = response.data.translatedText;
            const translatedParts = translatedText.split('\n');
            return batch.map((item, idx) => ({
              index: item.index,
              text: item.text,
              translation: translatedParts[idx] || item.text
            }));
          } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError') {
              return batch.map(item => ({ index: item.index, text: item.text, translation: item.text }));
            }
            // 重试机制：超时重试最多 2 次，间隔递增
            if (retryCount < MAX_RETRY && !controller.signal.aborted) {
              const isTimeout = e.code === 'ECONNABORTED' || e.message.includes('timeout');
              const delay = isTimeout ? 500 * (retryCount + 1) : 200 * (retryCount + 1);
              console.warn(`[翻译插件] 第 ${batchIndex + 1} 批翻译失败，${delay}ms 后重试(超时${batchTimeout / 1000}s)...`, e.message);
              await new Promise(r => setTimeout(r, delay));
              return translateBatchWithRetry(batch, batchIndex, retryCount + 1);
            }
            // 重试耗尽：如果批次 > 3 条，拆分为更小的子批次重试
            if (batch.length > 3 && !controller.signal.aborted) {
              console.warn(`[翻译插件] 第 ${batchIndex + 1} 批(${batch.length}条)重试耗尽，拆分为子批次...`);
              const half = Math.ceil(batch.length / 2);
              const subResults = await Promise.all([
                translateBatchWithRetry(batch.slice(0, half), batchIndex, 0),
                translateBatchWithRetry(batch.slice(half), batchIndex, 0)
              ]);
              return subResults.flat();
            }
            // 最终降级：逐条翻译
            console.warn(`[翻译插件] 第 ${batchIndex + 1} 批降级为逐条翻译...`);
            const singleResults = await Promise.allSettled(
              batch.map(item => translateSingle(item.text).then(trans => ({
                index: item.index, text: item.text, translation: trans
              })))
            );
            return singleResults.map((r, idx) =>
              r.status === 'fulfilled' ? r.value : { index: batch[idx].index, text: batch[idx].text, translation: batch[idx].text }
            );
          }
        };

        // 顺序处理所有批次（每批之间加延迟，防止 CPU 打满）
        const batchResults = [];
        for (let i = 0; i < batches.length; i++) {
          if (controller.signal.aborted) break;
          const result = await translateBatchWithRetry(batches[i], i);
          batchResults.push(result);
          // 批次之间加延迟（最后一批不延迟）
          if (i < batches.length - 1) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }

        // 合并结果
        let successCount = 0;
        batchResults.flat().forEach(result => {
          if (result && result.index !== undefined) {
            let trans = result.translation;
            // 用术语词典清理残留中文术语（无论 API 是否翻译成功，如"模块/断路器"）
            const cleaned = applyGlossarySubstring(trans);
            if (cleaned) trans = cleaned;
            results[result.index] = trans;
            if (cacheEnabled && trans !== result.text) {
              translationCache.set(result.text, trans);
              successCount++;
            }
          }
        });

        // 兜底：译文仍含中文（整条未译或部分翻译，如"SIEMENS模块"），提取中文片段单独翻译回填
        // 仅对非日语生效（日语译文本身允许含汉字）；扫描全部结果（含缓存/词典路径）
        // 并行 + 限量 + 容错，避免阻塞主翻译流程（防止 _tableTranslating 卡死）
        if (currentTargetLang !== 'ja') {
          const toFix = [];
          for (let i = 0; i < results.length; i++) {
            if (results[i] && /[一-鿿]/.test(results[i])) toFix.push(i);
          }
          if (toFix.length > 0) {
            try {
              await Promise.all(toFix.slice(0, 20).map(async (i) => {
                const fixed = await translateChineseSegments(results[i]);
                if (fixed) {
                  results[i] = fixed;
                  if (cacheEnabled) translationCache.set(texts[i], fixed);
                  successCount++;
                }
              }));
            } catch (e) {
              console.warn('[翻译插件] 中文片段兜底翻译异常:', e.message);
            }
          }
        }

        // 异步保存到 localStorage
        if (cacheEnabled && successCount > 0) {
          setTimeout(() => savePersistentCache(), 100);
        }

        console.log(`[翻译插件] 翻译完成，成功 ${successCount} 条`);
      }
      return results;
    }

    // 判断是否为不需要翻译的内容（合并正则以提升性能）
    // 合并为单个正则：纯数字|纯字母|字母数字组合(含_-)|数字+标点|日期|时间|IP|小数|百分比|货币
    const NON_TRANSLATABLE_RE = /^$|^\d+$|^[a-zA-Z]+$|^[a-zA-Z0-9_\-]+$|^[\d\s.,;:!?\-\/\\%]+$|^\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2}$|^\d{1,2}:\d{2}(:\d{2})?$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$|^\d+\.\d+$|^\d+(\.\d+)?%$|^[¥$€£]\d+(\.\d+)?$|^\d+(\.\d+)?[元角分]$/;
    function isNonTranslatable(text) {
      const trimmed = text.trim();
      // 空字符串不翻译
      if (!trimmed) return true;
      // 统一正则匹配（合并所有模式，减少多次匹配开销）
      if (NON_TRANSLATABLE_RE.test(trimmed)) return true;
      // 如果数字占比超过80%，也不翻译（避免 "订单号: 12345" 被翻译）
      const digitCount = trimmed.replace(/\D/g, '').length;
      if (digitCount > 0 && digitCount / trimmed.length > 0.8) return true;
      return false;
    }

    // 核心翻译过程
    async function translatePage() {
      const textNodes = getTextNodes(document.body);
      // 提取原文（为了保持引用）
      const originals = textNodes.map(node => node.textContent);
      // 去重翻译（相同文本只翻译一次）
      const uniqueTexts = [...new Set(originals)];
      const translations = await batchTranslate(uniqueTexts);

      // 构建 原文->译文 映射
      const transMap = new Map();
      uniqueTexts.forEach((text, i) => {
        transMap.set(text, translations[i]);
      });

      // 替换节点
      textNodes.forEach((node, i) => {
        const orig = originals[i];
        const trans = transMap.get(orig);
        applyTranslation(node, orig, trans || orig);
      });

      console.log(`[翻译插件] 页面翻译完成，共翻译 ${uniqueTexts.length} 个唯一文本`);
    }

    // 翻译单个新增节点（直接翻译 + 真正 await 等待完成）
    async function translateNewNode(node) {
      if (!isTranslated || !node.textContent?.trim()) return;

      const textNodes = getTextNodes(node);
      if (textNodes.length === 0) return;

      // 收集所有待翻译项
      const items = [];
      textNodes.forEach(tn => {
        const original = tn.textContent;
        if (original && original.trim() && !isNonTranslatable(original)) {
          items.push({ textNode: tn, original });
        }
      });

      if (items.length === 0) return;

      // 直接调用增量翻译批次（去重 + 缓存 + 重试），只用缓存避免阻塞
      await translateIncrementalBatch(items, true);
    }

    // 还原所有翻译
    function restorePage() {
      // 1. 恢复 wrapper 方式的节点
      document.querySelectorAll('.translated-node').forEach(wrapper => {
        safeUnwrapTranslation(wrapper);
      });
      // 2. 恢复表格单元格的直接文本替换（从 Map 读取原文）
      _tableOriginalText.forEach((original, textNode) => {
        if (textNode.isConnected && original) {
          textNode.textContent = original;
        }
      });
      _tableOriginalText.clear();
      _tableTranslatedText.clear();
      _tableFingerprint = '';  // 重置指纹，下次翻译重新扫描
      // 3. 清理动态调整的 col 宽度（恢复原始布局）
      document.querySelectorAll('col[style*="width"]').forEach(col => {
        col.style.width = '';
      });
      document.querySelectorAll('.el-form-item__label[style*="min-width"]').forEach(label => {
        label.style.width = '';
        label.style.minWidth = '';
      });
      // 可保留缓存和样式，下一次翻译更快
    }

    // 启动 MutationObserver 监听动态内容
    function startObserver() {
      if (observer) return;

      // ========== 表格专用：独立观察器 + 分页监听 ==========
      // 问题：全局 Observer 的防抖被翻页时其他 DOM 变化不断重置，导致表格翻译不执行
      // 方案：专用 Observer + 分页点击监听，与全局 Observer 完全解耦

      let _tableDebounce = null;
      let _tablePhase2Timer = null;   // 第二阶段定时器（独立于 debounce）
      let _tableTranslating = false;  // 防止并发翻译
      let _tableApplying = false;     // 标记正在应用翻译（忽略自身触发的 Mutation）

      async function translateNewTableNodes() {
        if (_tableTranslating) {  // 上一次翻译未完成，跳过
          console.log('[翻译插件] translateNewTableNodes: 翻译进行中，跳过');
          return;
        }
        _tableTranslating = true;
        try {
          // 等待 Vue DOM 更新完成
          await new Promise(r => setTimeout(r, 100));

          // 收集所有未翻译的表格文本节点（跳过已翻译的）
          const allTextNodes = [];
          const allOriginals = [];
          let totalNodes = 0;
          document.querySelectorAll('.el-table__body').forEach(tableBody => {
            getTextNodes(tableBody).forEach(tn => {
              const text = tn.textContent;
              if (!text || !text.trim() || isNonTranslatable(text)) return;
              totalNodes++;
              // 跳过已翻译的节点：通过 _tableTranslatedText 判断
              // 如果当前DOM文本等于存储的译文，说明已翻译完成
              if (_tableTranslatedText.has(tn) && _tableTranslatedText.get(tn) === text) return;
              allTextNodes.push(tn);
              allOriginals.push(text);
            });
          });

          console.log(`[翻译插件] translateNewTableNodes: 总节点=${totalNodes}, 待翻译=${allTextNodes.length}`);
          if (allTextNodes.length === 0) return;

          // 指纹检查（避免重复翻译相同内容）
          const fingerprint = allOriginals.join('\x00');
          if (fingerprint === _tableFingerprint) {
            return;
          }
          _tableFingerprint = fingerprint;

          // 直接调用 batchTranslate（内部自动处理缓存 + API 翻译，与初始翻译相同逻辑）
          const uniqueTexts = [...new Set(allOriginals)];
          const translations = await batchTranslate(uniqueTexts);

          const transMap = new Map();
          uniqueTexts.forEach((text, i) => {
            transMap.set(text, translations[i]);
          });

          // 应用翻译结果
          _tableApplying = true;
          try {
            let applied = 0;
            allTextNodes.forEach((node, i) => {
              const orig = allOriginals[i];
              const trans = transMap.get(orig);
              if (trans && trans !== orig) {
                applyTranslation(node, orig, trans);
                _tableTranslatedText.set(node, trans);
                applied++;
              }
            });
            console.log(`[翻译插件] 表格翻译完成: 节点=${allTextNodes.length}, 应用=${applied}`);
          } finally {
            _tableApplying = false;
          }
        } finally {
          _tableTranslating = false;
        }
      }

      function scheduleTableRetranslate() {
        clearTimeout(_tableDebounce);
        clearTimeout(_tablePhase2Timer);
        clearTimeout(_bgTranslationTimer);
        _tableDebounce = setTimeout(async () => {
          // 等待正在进行的翻译（如后台翻译）完成，避免 translateNewTableNodes 被静默跳过（最多等 5s）
          const waitStart = Date.now();
          while (_tableTranslating && Date.now() - waitStart < 5000) {
            await new Promise(r => setTimeout(r, 200));
          }
          // 第一阶段：仅缓存，瞬间完成表格已缓存内容
          await translateNewTableNodes();
          // 第二阶段：3秒后补译非表格内容（表单/弹窗等，避免重复处理表格）
          clearTimeout(_nonTableTimer);
          _nonTableTimer = setTimeout(() => translateNonTableContent(), 3000);
        }, 1500);
      }

      let _nonTableTimer = null;
      let _dialogTimer = null;  // 弹窗打开后的二次补译计时器
      // 补译非表格区域的未翻译内容（表单/弹窗等）
      async function translateNonTableContent() {
        if (!isTranslated) {
          console.log('[翻译插件] 非表格补译: 未开启翻译，跳过');
          return;
        }

        // 收集非表格区域的文本节点
        const textNodes = [];
        const originals = [];
        getTextNodes(document.body).forEach(tn => {
          if (tn.parentElement?.closest('.el-table__body')) return; // 跳过表格
          textNodes.push(tn);
          originals.push(tn.textContent);
        });

        const uniqueTexts = [...new Set(originals)];
        // 基于"是否含中文"检测未翻译内容（弹窗新节点即使已缓存也要应用译文）
        // 英文/韩语：含中文即未翻译；日语：含中文且无假名才未翻译
        const CHINESE_RE = /[一-鿿]/;
        const KANA_RE = /[぀-ヿ]/;
        const toTranslate = uniqueTexts.filter(t => {
          if (!t || !t.trim() || isNonTranslatable(t)) return false;
          if (!CHINESE_RE.test(t)) return false; // 不含中文=已翻译/非中文，跳过
          if (currentTargetLang === 'ja') return !KANA_RE.test(t);
          return true;
        });

        console.log(`[翻译插件] 非表格补译: 总节点=${textNodes.length}, 唯一文本=${uniqueTexts.length}, 待翻译=${toTranslate.length}`);
        if (toTranslate.length === 0) return;

        const translations = await batchTranslate(toTranslate);
        const transMap = new Map();
        toTranslate.forEach((text, i) => transMap.set(text, translations[i]));

        // 应用翻译
        let applied = 0;
        textNodes.forEach((node, i) => {
          const orig = originals[i];
          const trans = transMap.get(orig);
          if (trans && trans !== orig) {
            wrapWithTranslation(node, orig, trans);
            applied++;
          }
        });
        console.log(`[翻译插件] 非表格补译完成: 待翻译=${toTranslate.length}, 应用=${applied}`);
      }

      // 仅翻译表格区域（避免 translatePage 扫描整个 body 导致弹窗卡顿）
      async function translateTableOnly() {
        const tableBodies = document.querySelectorAll('.el-table__body');
        if (tableBodies.length === 0) return;

        const allTextNodes = [];
        const allOriginals = [];
        tableBodies.forEach(tableBody => {
          getTextNodes(tableBody).forEach(tn => {
            allTextNodes.push(tn);
            allOriginals.push(tn.textContent);
          });
        });

        const uniqueTexts = [...new Set(allOriginals)];
        const translations = await batchTranslate(uniqueTexts);

        const transMap = new Map();
        uniqueTexts.forEach((text, i) => {
          transMap.set(text, translations[i]);
        });

        _tableApplying = true;
        try {
          allTextNodes.forEach((node, i) => {
            const orig = allOriginals[i];
            const trans = transMap.get(orig);
            if (trans && trans !== orig) {
              applyTranslation(node, orig, trans);
            }
          });
        } finally {
          _tableApplying = false;
        }
        console.log(`[翻译插件] 表格补译完成，共 ${uniqueTexts.length} 个唯一文本`);
      }

      // 检测文本是否包含中文字符（用于英文/韩语翻译场景）
      const CHINESE_RE = /[\u4e00-\u9fff]/;
      // 检测文本是否包含日语假名（用于日语翻译场景）
      const JAPANESE_KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;  // 平假名 + 片假名

      // 后台分批翻译：根据目标语言选择判断策略
      let _bgTranslationTimer = null;
      function scheduleBackgroundTranslation() {
        clearTimeout(_bgTranslationTimer);
        const BATCH_SIZE = 10;
        const INTERVAL = 3000;
        const MAX_FAILURES = 3;
        let consecutiveFailures = 0;
        const processed = new Set();
        // 根据目标语言选择判断策略
        // 英文/韩语：翻译结果不含中文 → 中文字符检测
        // 日语：翻译结果含平假名/片假名 → 日语假名检测
        const strategy = currentTargetLang === 'ja' ? 'kana'
          : (currentTargetLang === 'en' || currentTargetLang === 'ko') ? 'chinese'
          : 'map';

        const strategyLabel = { chinese: '中文字符检测', kana: '日语假名检测', map: 'Map状态判断' };
        console.log(`[翻译插件] 后台翻译已启动 (${strategyLabel[strategy]})`);

        async function processBatch() {
          if (!isTranslated || _tableTranslating) return;

          const uncachedItems = [];
          document.querySelectorAll('.el-table__body').forEach(tableBody => {
            getTextNodes(tableBody).forEach(tn => {
              if (processed.has(tn)) return;
              const text = tn.textContent;
              if (!text || !text.trim()) return;
              if (isNonTranslatable(text)) return;
              if (translationCache.has(text)) return;
              if (glossaryMap.has(text.trim())) return;

              if (strategy === 'chinese') {
                // 英文/韩语：不含中文 = 已翻译
                if (!CHINESE_RE.test(text)) return;
              } else if (strategy === 'kana') {
                // 日语：含平假名/片假名 = 已翻译为日语
                if (JAPANESE_KANA_RE.test(text)) return;
                // 中文与日语差异对比：不含中文 = 非中文内容，跳过
                if (!CHINESE_RE.test(text)) return;
              } else {
                // 其他语言：通过 Map 检查
                if (_tableOriginalText.has(tn)) {
                  const storedOriginal = _tableOriginalText.get(tn);
                  if (text !== storedOriginal) return;
                }
              }

              uncachedItems.push({ textNode: tn, original: text });
            });
          });

          console.log(`[翻译插件] 后台翻译: 未翻译节点=${uncachedItems.length}`);
          if (uncachedItems.length === 0) return;

          const batch = uncachedItems.slice(0, BATCH_SIZE);
          const texts = batch.map(item => item.original);

          _tableTranslating = true;
          _tableApplying = true;
          let successCount = 0;
          try {
            const prevCacheSize = translationCache.size;
            const translations = await batchTranslate(texts);
            successCount = translationCache.size - prevCacheSize;

            // 应用翻译结果到表格单元格
            batch.forEach((item, idx) => {
              const trans = translations[idx];
              if (trans && trans !== item.original) {
                item.textNode.textContent = trans;
                if (!_tableOriginalText.has(item.textNode)) {
                  _tableOriginalText.set(item.textNode, item.original);
                }
              }
              // 只要翻译结果与原文不同（或已缓存），就标记为已处理
              if (translationCache.has(item.original) || glossaryMap.has(item.original.trim())) {
                processed.add(item.textNode);
              }
            });
          } catch (e) {
            console.warn(`[翻译插件] 后台翻译失败:`, e.message);
            // 失败时不标记为已处理，允许下次重试
          } finally {
            _tableApplying = false;
            _tableTranslating = false;
          }

          if (successCount === 0) {
            consecutiveFailures++;
            console.log(`[翻译插件] 后台翻译: 本批成功=0, 连续失败=${consecutiveFailures}/${MAX_FAILURES}`);
            if (consecutiveFailures >= MAX_FAILURES) {
              console.log('[翻译插件] 后台翻译: 连续失败过多，停止');
              return;
            }
          } else {
            consecutiveFailures = 0;
            console.log(`[翻译插件] 后台翻译: 本批成功 ${successCount} 条`);
          }

          if (uncachedItems.length > BATCH_SIZE) {
            _bgTranslationTimer = setTimeout(processBatch, INTERVAL);
          }
        }

        processBatch();
      }

      // 分页点击监听
      document.addEventListener('click', (e) => {
        if (!isTranslated) return;
        if (e.target.closest('.el-pagination')) {
          clearTimeout(_bgTranslationTimer);  // 取消后台翻译
          scheduleTableRetranslate();
        }
      }, true);

      // 输入框数据值悬停翻译（仅展示不提交）：
      // 直接改写 input.value 有数据污染/Vue 重渲染还原风险，故采用悬停显示译文（title 提示），值本身永不改动
      document.addEventListener('mouseover', (e) => {
        if (!isTranslated) return;
        const t = e.target;
        if (!(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        if (t.dataset.itHoverBound) return;  // 已绑定过，跳过
        const v = t.value;
        if (!v || !/[一-鿿]/.test(v)) return;  // 仅处理含中文的值
        t.dataset.itHoverBound = '1';
        // 优先用缓存，避免重复请求；异步翻译后写入 title
        if (cacheEnabled && translationCache.has(v)) {
          const cached = translationCache.get(v);
          if (cached && cached !== v) t.title = cached;
        } else {
          translateSingle(v).then(trans => {
            if (trans && trans !== v) t.title = trans;
          }).catch(() => {});
        }
      }, true);

      // 表格专用 Observer：只关注表格区域的变化
      const tableObserver = new MutationObserver((mutations) => {
        if (!isTranslated) return;
        if (_tableTranslating || _tableApplying) return;  // 翻译进行中，忽略所有变化
        let hasTableChange = false;
        for (const m of mutations) {
          if (m.type === 'childList') {
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE &&
                (node.closest?.('.el-table__body') || node.closest?.('.el-table__row'))) {
                hasTableChange = true;
                break;
              }
            }
          }
          if (m.type === 'characterData') {
            // 忽略我们自己 applyTranslation 触发的 characterData 变化
            if (_tableApplying) return;
            const parent = m.target.parentElement;
            if (parent && parent.closest('.el-table__body')) {
              hasTableChange = true;
            }
          }
          if (hasTableChange) break;
        }
        if (hasTableChange) {
          scheduleTableRetranslate();
        }
      });

      // 监听所有表格区域
      document.querySelectorAll('.el-table__body-wrapper').forEach(wrapper => {
        tableObserver.observe(wrapper, {
          childList: true, subtree: true, characterData: true
        });
      });
      // 也监听 document.body 中新增的表格（如弹窗中的表格）
      tableObserver.observe(document.body, {
        childList: true, subtree: true
      });

      // ========== 全局 Observer：处理非表格内容 ==========
      observer = new MutationObserver((mutations) => {
        if (!isTranslated) return;

        const nodesToTranslate = [];
        let dialogOpened = false;

        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              // 检测弹窗/抽屉打开，弹窗内容需要更及时的翻译
              if (node.nodeType === Node.ELEMENT_NODE &&
                (node.matches?.('.el-dialog, .el-drawer, .el-overlay, .el-message-box') ||
                 node.closest?.('.el-dialog, .el-drawer, .el-overlay, .el-message-box'))) {
                dialogOpened = true;
              }
              if (node.nodeType === Node.ELEMENT_NODE &&
                !node.classList?.contains('translated-node') &&
                !node.closest?.('#__immersive_translate_btn') &&
                // 跳过表格节点（由专用 Observer 处理）
                !node.closest?.('.el-table__body') &&
                !node.closest?.('.el-table__row')) {
                nodesToTranslate.push(node);
              }
            });
          }

          if (mutation.type === 'characterData' && mutation.target.textContent) {
            const parent = mutation.target.parentElement;
            if (parent &&
              !parent.closest('.translated-node') &&
              !parent.closest('#__immersive_translate_btn') &&
              !parent.closest('.el-table__body') && // 跳过表格
              mutation.target.textContent.trim()) {
              const textNode = mutation.target;
              const original = textNode.textContent;
              if (!isNonTranslatable(original)) {
                nodesToTranslate.push({textNode, original});
              }
            }
          }
        });

        if (nodesToTranslate.length > 0) {
          clearTimeout(observer._debounceTimer);
          observer._debounceTimer = setTimeout(async () => {
            const elementNodes = nodesToTranslate.filter(n => n.nodeType === Node.ELEMENT_NODE);
            const textNodeItems = nodesToTranslate.filter(n => n.textNode);

            const allTextItems = [];
            elementNodes.forEach(node => {
              const tNodes = getTextNodes(node);
              tNodes.forEach(tn => {
                const original = tn.textContent;
                if (original && original.trim()) {
                  allTextItems.push({ textNode: tn, original });
                }
              });
            });
            textNodeItems.forEach(item => {
              allTextItems.push({ textNode: item.textNode, original: item.original });
            });

            if (allTextItems.length > 0) {
              // 增量翻译先用缓存，快速显示已缓存内容
              await translateIncrementalBatch(allTextItems, true);
              // 弹窗内容提前补译（600ms），普通内容保持 3s；弹窗再追加一次 2s 补译覆盖异步加载
              const delay = dialogOpened ? 600 : 3000;
              clearTimeout(_nonTableTimer);
              _nonTableTimer = setTimeout(() => translateNonTableContent(), delay);
              if (dialogOpened) {
                clearTimeout(_dialogTimer);
                _dialogTimer = setTimeout(() => translateNonTableContent(), 2000);
              }
            }
          }, 150);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: false,
        attributes: false
      });

      // 保存引用以便清理
      observer._tableObserver = tableObserver;
      observer._tableDebounceRef = () => _tableDebounce;
    }

    // 停止 Observer
    function stopObserver() {
      if (observer) {
        clearTimeout(observer._debounceTimer);
        observer._debounceTimer = null;
        // 清理表格专用 Observer
        if (observer._tableObserver) {
          observer._tableObserver.disconnect();
          observer._tableObserver = null;
        }
        observer.disconnect();
        observer = null;
      }
    }

    // ---------- 创建浮动按钮 ----------
    function createTranslateButton(router) {
      // 注入 loading spinner 的 CSS 动画（全局复用，避免重复注入）
      if (!document.getElementById('__translate_spinner_style')) {
        const spinnerStyle = document.createElement('style');
        spinnerStyle.id = '__translate_spinner_style';
        spinnerStyle.textContent = `
          @keyframes __translate_spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .__translate_spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: __translate_spin 0.8s linear infinite;
            vertical-align: middle;
            margin-right: 6px;
          }
        `;
        document.head.appendChild(spinnerStyle);
      }
      const loadingHTML = '<span class="__translate_spinner"></span>Switching...';

      // ---------- 多语言选择器 ----------
      const container = document.createElement('div');
      container.id = '__immersive_translate_btn';
      container.style.cssText = `
        position: fixed; top: 6px; right: 80px; z-index: 99999;
        font-size: 14px; user-select: none;
      `;

      // 主按钮
      const btn = document.createElement('div');
      btn.innerHTML = '🌐 中文';
      btn.style.cssText = `
        background: #4A90D9; color: #fff; padding: 10px 16px;
        border-radius: 20px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex; align-items: center; gap: 6px;
        transition: background 0.2s;
      `;

      // 下拉菜单
      const dropdown = document.createElement('div');
      dropdown.style.cssText = `
        display: none; position: absolute; top: 100%; right: 0;
        margin-top: 6px; background: #fff; border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15); overflow: hidden;
        min-width: 160px;
      `;

      // 生成语言选项
      languages.forEach(lang => {
        const item = document.createElement('div');
        item.innerHTML = `<span style="margin-right:8px">${lang.flag}</span>${lang.label}`;
        item.style.cssText = `
          padding: 10px 16px; cursor: pointer; color: #333;
          display: flex; align-items: center;
          transition: background 0.15s;
        `;
        item.addEventListener('mouseenter', () => item.style.background = '#f0f4ff');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');

        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          dropdown.style.display = 'none';
          await switchLanguage(lang);
        });
        dropdown.appendChild(item);
      });

      container.appendChild(btn);
      container.appendChild(dropdown);

      // 点击按钮展开/收起下拉
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });

      // 点击页面其他区域关闭下拉
      document.addEventListener('click', () => {
        dropdown.style.display = 'none';
      });

      // 双击导出缓存
      btn.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        exportCacheToFile();
      });

      // 切换语言核心逻辑
      async function switchLanguage(lang) {
        if (lang.code === sourceLang) {
          // 选择原文语言：恢复中文
          if (isTranslated) {
            restorePage();
            abortPendingRequests();
            stopObserver();
            btn.innerHTML = `🌐 ${lang.flag} ${lang.label}`;
            btn.style.background = '#4A90D9';
            isTranslated = false;
          }
          return;
        }

        // 切换到其他语言
        const oldLang = currentTargetLang;
        currentTargetLang = lang.code;
        abortPendingRequests();

        // 如果已翻译，先恢复原文
        if (isTranslated) {
          restorePage();
          stopObserver();
        }

        // 交换缓存：保存旧语言 → 清空 → 加载新语言
        swapCacheForLanguage(oldLang, lang.code);

        btn.innerHTML = loadingHTML;
        btn.style.background = '#999';
        btn.style.pointerEvents = 'none';

        try {
          injectTranslationStyles();
          await loadGlossary();
          await translatePage();
          startObserver();

          const langLabel = languages.find(l => l.code === lang.code)?.label || lang.code;
          const langFlag = languages.find(l => l.code === lang.code)?.flag || '🌐';
          btn.innerHTML = `🌐 ${langFlag} ${langLabel}`;
          btn.style.background = '#E67E22';

          // 延迟补扫
          setTimeout(async () => {
            await translateNewNode(document.body);
            const placeholderEls = document.querySelectorAll('[placeholder]');
            let phCount = 0;
            placeholderEls.forEach(el => {
              const orig = el.getAttribute('placeholder');
              if (orig && glossaryMap.has(orig.trim())) {
                el.setAttribute('placeholder', glossaryMap.get(orig.trim()));
                phCount++;
              }
            });
            console.log(`[翻译插件] placeholder 补扫完成，命中词典 ${phCount} 个`);
          }, 600);

          isTranslated = true;
        } catch (e) {
          console.error('[翻译插件] 详细错误:', e);
          let errorMsg = '❌ 失败';
          if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
            errorMsg = '❌ 超时';
          } else if (e.response?.status === 404) {
            errorMsg = '❌ API路径错误';
          } else if (e.response?.status === 500) {
            errorMsg = '❌ 服务器错误';
          } else if (e.message.includes('Network Error')) {
            errorMsg = '❌ 网络错误';
          }
          btn.innerHTML = errorMsg;
          btn.style.background = '#E74C3C';
          alert(`翻译失败！\n\n错误类型: ${e.message}\n\n请检查:\n1. CTranslate2 服务是否启动\n2. 浏览器控制台查看详细错误`);
        }
        btn.style.pointerEvents = 'auto';
      }

      document.body.appendChild(container);

      // 如果启用了路由切换自动翻译，监听路由变化
      if (router && autoTranslateOnRouteChange) {
        router.afterEach(async (to, from) => {
          // 路由切换后，如果处于翻译状态，等待DOM更新后重新翻译
          if (isTranslated) {
            // 取消上一页残留的飞行请求，避免结果写入已销毁的页面
            abortPendingRequests();
            stopObserver();

            // 等待Vue组件渲染完成（增加重试机制）
            const retryTranslate = async (retryCount = 0) => {
              setTimeout(async () => {
                btn.innerHTML = loadingHTML;
                btn.style.background = '#999';
                btn.style.pointerEvents = 'none';
                try {
                  await translateNewNode(document.body); // 只翻译未被翻译的节点
                  startObserver(); // 重新启动监听器
                  const langInfo = languages.find(l => l.code === currentTargetLang) || languages[1];
                  btn.innerHTML = `🌐 ${langInfo.flag} ${langInfo.label}`;
                  btn.style.background = '#E67E22';
                } catch (e) {
                  if (retryCount < 3) {
                    retryTranslate(retryCount + 1);
                  } else {
                    btn.innerHTML = '❌ 失败';
                    btn.style.background = '#E74C3C';
                  }
                }
                btn.style.pointerEvents = 'auto';
              }, 300 + retryCount * 200);
            };

            retryTranslate();
          }
        });
      }
    }

    // 页面加载完成后初始化按钮
    const router = app.config.globalProperties.$router;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createTranslateButton(router);
      });
    } else {
      createTranslateButton(router);
    }

    // 暴露缓存管理方法到全局（方便调试和管理）
    if (typeof window !== 'undefined') {
      window.__translationCache = {
        export: exportCacheToFile,
        import: importCacheFromFile,
        clear: () => {
          translationCache.clear();
          localStorage.removeItem(cacheStorageKey);
          console.log('[翻译插件] 缓存已清空');
        },
        // 清除术语词典缓存（内存 + localStorage）
        clearGlossary: () => {
          // 清除内存中的词典 Map
          glossaryMap.clear();
          // 清除所有语言的 localStorage 词典缓存
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('translation_glossary_v1_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          console.log(`[翻译插件] 术语词典已清空，共清除 ${keysToRemove.length} 条缓存`);
        },
        size: () => translationCache.size,
        stats: () => {
          console.log(`[翻译插件] 当前缓存条目数: ${translationCache.size}`);
          console.log(`[翻译插件] 占用空间: ${(JSON.stringify(Object.fromEntries(translationCache)).length / 1024).toFixed(2)} KB`);
        },
        // 手动触发翻译（用于分页等动态加载场景）
        trigger: async (options = {}) => {
          if (!isTranslated) {
            console.log('[翻译插件] 未处于翻译状态，跳过');
            return;
          }

          const {
            selector = '.el-table__body',
            delay = 100,
            restoreOld = true
          } = options;

          console.log(`[翻译插件] 手动触发翻译... (选择器: ${selector})`);

          // 先取消旧请求，避免快速分页时结果错乱
          abortPendingRequests();

          // 先还原旧的翻译标记（使用安全还原，避免覆盖 Vue 新数据）
          if (restoreOld) {
            document.querySelectorAll(`${selector} .translated-node`).forEach(wrapper => {
              safeUnwrapTranslation(wrapper);
            });
          }

          // 等待 DOM 稳定
          await new Promise(resolve => setTimeout(resolve, delay));

          // 重新翻译指定区域
          const targetElement = document.querySelector(selector);
          if (targetElement) {
            await translateNewNode(targetElement);
            console.log(`[翻译插件] 翻译完成: ${selector}`);
          } else {
            console.log(`[翻译插件] 未找到元素: ${selector}`);
          }
        }
      };

      // 监听分页事件（已禁用，由 startObserver 内的专用监听器处理）
      // 避免与 startObserver 的 scheduleTableRetranslate 冲突
    }

    // 可选：监听动态内容（如果内网页面有大量动态加载，可在此处理）
    // 但仅当处于翻译状态时才对新节点执行翻译，此处略。
  }
}
