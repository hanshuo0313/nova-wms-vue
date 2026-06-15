// src/plugins/immersiveTranslate.js
import axios from 'axios';

export default {
  install(app, options = {}) {
    const {
      apiEndpoint = 'http://localhost:5000/translate',
      sourceLang = 'zh',
      targetLang = 'en',
      cacheEnabled = true,
      excludeSelectors = 'script, style, code, pre, .no-translate, .el-pagination, .pagination-container',
      autoTranslateOnRouteChange = false,
      persistentCache = true, // 新增：是否启用持久化缓存
      cacheStorageKey = 'translation_cache_v1' // 新增：localStorage 键名
    } = options;

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

    // ---------- 增量翻译优化：去重、微批次、重试 ----------
    const pendingTranslations = new Map(); // text -> Promise<translation> 去重正在飞行的请求
    const INCREMENTAL_BATCH_SIZE = 10; // 增量翻译每批条数（比全页翻译小）
    const INCREMENTAL_TIMEOUT = 20000; // 增量翻译批次超时(ms)
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
            target: targetLang,
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
          target: targetLang,
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
    async function translateIncrementalBatch(items) {
      // items: [{textNode, original}]
      // 1. 快速缓存路径：先查缓存，命中直接包装
      const uncached = [];
      items.forEach(item => {
        if (isNonTranslatable(item.original)) {
          // 不需要翻译的文本，跳过
          return;
        }
        if (cacheEnabled && translationCache.has(item.original)) {
          wrapWithTranslation(item.textNode, item.original, translationCache.get(item.original));
        } else {
          uncached.push(item);
        }
      });

      if (uncached.length === 0) return;

      // 2. 去重：相同文本只翻译一次
      const uniqueTexts = [...new Set(uncached.map(i => i.original))];
      const toRequest = uniqueTexts.filter(t => !pendingTranslations.has(t) && !(cacheEnabled && translationCache.has(t)));

      // 3. 小批次并行请求（带重试）+ 同时等待已在飞行中的重复请求
      const existingPending = uniqueTexts.filter(t => pendingTranslations.has(t));
      if (toRequest.length > 0) {
        const batches = [];
        for (let i = 0; i < toRequest.length; i += INCREMENTAL_BATCH_SIZE) {
          batches.push(toRequest.slice(i, i + INCREMENTAL_BATCH_SIZE));
        }
        const batchPromises = batches.map(batch => requestBatchTranslation(batch));
        // 同时等待新批次和已在飞行中的请求
        const allPromises = [
          ...batchPromises,
          ...existingPending.map(t => pendingTranslations.get(t))
        ];
        await Promise.allSettled(allPromises);
      } else if (existingPending.length > 0) {
        // 没有新请求，但有已在飞行中的重复请求
        await Promise.allSettled(existingPending.map(t => pendingTranslations.get(t)));
      }

      // 4. 包装所有节点（检查节点是否仍在 DOM 中，直接从缓存读取）
      let successCount = 0;
      uncached.forEach(item => {
        const trans = (cacheEnabled && translationCache.get(item.original)) || item.original;
        if (trans !== item.original) successCount++;
        wrapWithTranslation(item.textNode, item.original, trans);
      });

      // 异步保存缓存
      if (cacheEnabled && successCount > 0) {
        setTimeout(() => savePersistentCache(), 200);
      }
    }

    // ---------- 持久化缓存管理 ----------
    function loadPersistentCache() {
      try {
        const cached = localStorage.getItem(cacheStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.entries(parsed).forEach(([key, value]) => {
            translationCache.set(key, value);
          });
          console.log(`[翻译插件] 已加载 ${translationCache.size} 条缓存记录`);
        }
      } catch (e) {
        console.warn('[翻译插件] 加载持久化缓存失败:', e);
      }
    }

    function savePersistentCache() {
      if (!persistentCache || !cacheEnabled) return;

      try {
        const cacheObj = {};
        translationCache.forEach((value, key) => {
          cacheObj[key] = value;
        });
        localStorage.setItem(cacheStorageKey, JSON.stringify(cacheObj));
        console.log(`[翻译插件] 已保存 ${translationCache.size} 条缓存记录`);
      } catch (e) {
        console.warn('[翻译插件] 保存持久化缓存失败:', e);
        // 如果超出 localStorage 限制，清理旧缓存
        if (e.name === 'QuotaExceededError') {
          clearOldCache();
        }
      }
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

    // 将文本替换为原文+译文的包裹节点（连接性检查 + 动态容器适配）
    function wrapWithTranslation(textNode, original, translation) {
      // 安全检查：节点必须仍在 DOM 中且未被其他逻辑替换
      if (!textNode || !textNode.parentNode || !textNode.isConnected) return;
      // 防止重复包装：如果父节点已经是 translated-node 则跳过
      if (textNode.parentElement?.classList?.contains('translated-node')) return;

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

    // 批量翻译（合并长文本减少请求，支持 AbortController 取消 + 重试 + 降级）
    async function batchTranslate(texts) {
      const results = [];
      const toTranslate = [];

      // 先查缓存，并过滤纯数字或主要包含数字的文本
      texts.forEach((text, index) => {
        if (isNonTranslatable(text)) {
          results[index] = text;
        } else if (cacheEnabled && translationCache.has(text)) {
          results[index] = translationCache.get(text);
        } else {
          toTranslate.push({ text, index });
        }
      });

      if (toTranslate.length > 0) {
        const controller = ensureAbortController();
        // 分批翻译，每批最多 30 条（平衡速度和稳定性）
        const batchSize = 30;
        const batches = [];
        for (let i = 0; i < toTranslate.length; i += batchSize) {
          batches.push(toTranslate.slice(i, i + batchSize));
        }

        console.log(`[翻译插件] 开始翻译 ${toTranslate.length} 条文本（缓存命中 ${texts.length - toTranslate.length} 条），分 ${batches.length} 批并行处理`);

        // 翻译单个批次（带重试 + 超时递增）
        const translateBatchWithRetry = async (batch, batchIndex, retryCount = 0) => {
          const combined = batch.map(item => item.text).join('\n');
          // 每次重试增加 10s 超时（30s → 40s → 50s）
          const batchTimeout = 30000 + retryCount * 10000;
          try {
            const response = await translateAxios.post(apiEndpoint, {
              q: combined,
              source: sourceLang,
              target: targetLang,
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

        // 并行处理所有批次
        const batchPromises = batches.map((batch, batchIndex) =>
          translateBatchWithRetry(batch, batchIndex)
        );

        // 等待所有批次完成
        const batchResults = await Promise.all(batchPromises);

        // 合并结果
        let successCount = 0;
        batchResults.flat().forEach(result => {
          if (result && result.index !== undefined) {
            results[result.index] = result.translation;
            if (cacheEnabled && result.translation !== result.text) {
              translationCache.set(result.text, result.translation);
              successCount++;
            }
          }
        });

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
        wrapWithTranslation(node, orig, trans || orig);
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

      // 直接调用增量翻译批次（去重 + 缓存 + 重试），真正 await 等待完成
      await translateIncrementalBatch(items);
    }

    // 还原所有翻译
    function restorePage() {
      document.querySelectorAll('.translated-node').forEach(wrapper => {
        unwrapTranslation(wrapper);
      });
      // 清理动态调整的 col 宽度（恢复原始布局）
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

      observer = new MutationObserver((mutations) => {
        if (!isTranslated) return;

        const nodesToTranslate = [];
        let shouldTranslate = false;

        mutations.forEach(mutation => {
          // 处理新增节点
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              // 只处理元素节点，且排除已翻译的节点和分页控件
              if (node.nodeType === Node.ELEMENT_NODE &&
                !node.classList?.contains('translated-node') &&
                !node.closest?.('#__immersive_translate_btn') &&
                !node.closest?.('.el-pagination') &&
                !node.closest?.('.pagination-container')) {

                // 检查是否是表格行或表格单元格
                if (node.closest?.('.el-table__body') ||
                  node.closest?.('.el-table__row') ||
                  node.tagName === 'TBODY') {
                  shouldTranslate = true;
                }
                nodesToTranslate.push(node);
              }
            });
          }

          // 处理文本内容变化（统一走增量批次，避免直接包装的竞态问题）
          if (mutation.type === 'characterData' && mutation.target.textContent) {
            const parent = mutation.target.parentElement;
            if (parent &&
              !parent.closest('.translated-node') &&
              !parent.closest('#__immersive_translate_btn') &&
              !parent.closest('.el-pagination') &&
              !parent.closest('.pagination-container') &&
              mutation.target.textContent.trim()) {

              // 检查是否在表格内
              if (parent.closest('.el-table__body') || parent.closest('.el-table')) {
                shouldTranslate = true;
              }

              // 统一加入待翻译队列（不再直接包装，避免竞态）
              const textNode = mutation.target;
              const original = textNode.textContent;
              if (!isNonTranslatable(original)) {
                nodesToTranslate.push({textNode, original});
              }
            }
          }
        });

        // 批量翻译新增节点（优化：合并所有节点统一翻译，区分优先级）
        if (nodesToTranslate.length > 0) {
          // 防抖：高优先级(表格行)用短延迟80ms，普通节点用150ms
          const isHighPriority = shouldTranslate;
          const debounceMs = isHighPriority ? 80 : 150;
          clearTimeout(observer._debounceTimer);
          observer._debounceTimer = setTimeout(async () => {
            // 分离普通节点和文本节点
            const elementNodes = nodesToTranslate.filter(n => n.nodeType === Node.ELEMENT_NODE);
            const textNodeItems = nodesToTranslate.filter(n => n.textNode);

            // 如果是表格更新，先还原旧的翻译标记
            if (shouldTranslate) {
              document.querySelectorAll('.el-table__body .translated-node').forEach(wrapper => {
                unwrapTranslation(wrapper);
              });
            }

            // 收集所有元素节点中的文本节点
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

            // 合并文本节点（来自 characterData 的）
            textNodeItems.forEach(item => {
              allTextItems.push({ textNode: item.textNode, original: item.original });
            });

            // 统一走增量翻译（去重 + 防抖 + 小批次）
            if (allTextItems.length > 0) {
              await translateIncrementalBatch(allTextItems);
            }
          }, debounceMs); // 高优先级80ms，普通150ms
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: false,
        attributes: false
      });
    }

    // 停止 Observer
    function stopObserver() {
      if (observer) {
        // 清理防抖定时器
        clearTimeout(observer._debounceTimer);
        observer._debounceTimer = null;
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

      const btn = document.createElement('div');
      btn.id = '__immersive_translate_btn';
      btn.innerHTML = '🌐 中文';
      btn.style.cssText =
        `position: fixed; top: 6px; right: 80px; z-index: 99999;
        background: #4A90D9; color: #fff; padding: 10px 16px;
        border-radius: 20px; cursor: pointer; user-select: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-size: 14px;
        display: flex; align-items: center;
      `;

      // 添加双击导出缓存功能
      btn.addEventListener('dblclick', () => {
        exportCacheToFile();
      });

      btn.addEventListener('click', async () => {
        if (isTranslated) {
          restorePage();
          abortPendingRequests(); // 取消所有飞行中的请求
          stopObserver();
          btn.innerHTML = '🌐 中文';
          btn.style.background = '#4A90D9';
          isTranslated = false;
        } else {
          // 防御性编程：确保没有残留的飞行请求
          abortPendingRequests();
          btn.innerHTML = loadingHTML;
          btn.style.background = '#999';
          btn.style.pointerEvents = 'none';
          try {
            // 先测试 API 连接（使用独立实例，增加超时时间）
            /*console.log('[翻译插件] 测试 API 连接...');
            const testResponse = await translateAxios.post(apiEndpoint, {
              q: '测试',
              source: sourceLang,
              target: targetLang,
              format: 'text'
            }, { timeout: 30000 });

            if (!testResponse.data.translatedText) {
              throw new Error('API 返回数据格式错误');
            }*/

            console.log('[翻译插件] API 连接成功，开始翻译页面...');
            injectTranslationStyles(); // 注入翻译自适应样式（容器自动扩展）
            await translatePage();
            startObserver(); // 启动监听器
            btn.innerHTML = '↩️ English';
            btn.style.background = '#E67E22';
          } catch (e) {
            console.error('[翻译插件] 详细错误:', e);
            let errorMsg = '❌ 失败/fail';

            if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
              errorMsg = '❌ 超时/Timeout';
              alert(`翻译超时！\n\n可能原因:\n1. LibreTranslate 首次加载模型较慢（需 10-30 秒）\n2. Docker 容器未启动\n3. 服务器资源不足\n\n建议:\n- 等待 1-2 分钟后重试\n- 检查 Docker 日志: docker logs <容器ID>`);
            } else if (e.response?.status === 404) {
              errorMsg = '❌ API路径错误';
            } else if (e.response?.status === 500) {
              errorMsg = '❌ 服务器错误';
            } else if (e.message.includes('Network Error')) {
              errorMsg = '❌ 网络错误';
            }

            btn.innerHTML = errorMsg;
            btn.style.background = '#E74C3C';

            // 显示详细错误提示
            alert(`翻译失败！\n\n错误类型: ${e.message}\n\n请检查:\n1. LibreTranslate 服务是否启动\n2. 浏览器控制台查看详细错误`);
          }
          btn.style.pointerEvents = 'auto';
          isTranslated = true;
        }
      });

      document.body.appendChild(btn);

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
                  //await translatePage(); // 会重新扫描整个页面，包括已翻译的部分
                  await translateNewNode(document.body); // 只翻译未被翻译的节点
                  startObserver(); // 重新启动监听器
                  btn.innerHTML = '↩️ English';
                  btn.style.background = '#E67E22';
                } catch (e) {
                  if (retryCount < 3) {
                    // 最多重试3次
                    retryTranslate(retryCount + 1);
                  } else {
                    btn.innerHTML = '❌ 失败/fail';
                    btn.style.background = '#E74C3C';
                  }
                }
                btn.style.pointerEvents = 'auto';
              }, 300 + retryCount * 200); // 递增延迟：300ms, 500ms, 700ms, 900ms
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

          // 先还原旧的翻译标记
          if (restoreOld) {
            document.querySelectorAll(`${selector} .translated-node`).forEach(wrapper => {
              unwrapTranslation(wrapper);
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

      // 监听分页事件（Element Plus 分页会触发 pagination 事件，带防抖）
      let paginationTimer = null;
      document.addEventListener('click', (e) => {
        // 检测是否点击了分页按钮
        if (e.target.closest('.el-pagination')) {
          if (isTranslated) {
            // 防抖：快速连点时只执行最后一次
            clearTimeout(paginationTimer);
            paginationTimer = setTimeout(() => {
              console.log('[翻译插件] 检测到分页操作，准备翻译...');
              // 延迟执行，等待数据加载完成
              setTimeout(() => {
                window.__translationCache.trigger();
              }, 500);
            }, 100);
          }
        }
      });
    }

    // 可选：监听动态内容（如果内网页面有大量动态加载，可在此处理）
    // 但仅当处于翻译状态时才对新节点执行翻译，此处略。
  }
}
