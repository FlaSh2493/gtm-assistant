import { ipcRenderer } from 'electron';

// This script will be injected into the <webview>
// It acts like the old content script, but sends data to the renderer via IPC

const isTopFrame = window === window.top;
const PRELOAD_VERSION = '1.0.5-shield';

const canUseIpc = process.isMainFrame;

if (!canUseIpc) {
  console.log(`[GTM GA Assistant] Subframe without IPC: ${window.location.href}`);
}
console.log(`🚀 [GTM GA Assistant] Webview Preload Injected v${PRELOAD_VERSION} (${isTopFrame ? 'Top Frame' : 'Subframe: ' + window.location.href})`);

let specModeActive = false;
let selectionEnabled = false;
let lastHoveredElement: HTMLElement | null = null;
let hoverDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let rafId: number | null = null;
let lastSentRects: string = '';

if (canUseIpc) ipcRenderer.on('set-spec-mode', (_event, active: boolean) => {
  specModeActive = active;
});

const ensureSelectionStyle = (enabled: boolean) => {
  let styleEl = document.getElementById('gtm-assistant-selection-style');
  if (enabled) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gtm-assistant-selection-style';
      // Only override pointer-events on elements that block interaction for non-functional reasons
      styleEl.textContent = `body * { pointer-events: auto !important; }`;
      document.head.appendChild(styleEl);
    }
  } else {
    styleEl?.remove();
  }
};

if (canUseIpc) ipcRenderer.on('set-selection-enabled', (_event, enabled: boolean) => {
  selectionEnabled = enabled;
  ensureSelectionStyle(enabled);
});

// --- Cross-origin Iframe Offset Calculation ---
let iframeOffsetX = 0;
let iframeOffsetY = 0;

if (!isTopFrame) {
  const requestOffset = () => window.top?.postMessage({ type: 'GTM_ASSISTANT_GET_OFFSET' }, '*');

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'GTM_ASSISTANT_OFFSET_RESPONSE') {
      iframeOffsetX = e.data.x;
      iframeOffsetY = e.data.y;
    }
  });

  // Request immediately; retry after DOM is ready to handle timing races
  requestOffset();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', requestOffset);
  }
}

// Top frame (or parent) listens for offset requests and calculates absolute position
window.addEventListener('message', (e) => {
  if (e.data?.type !== 'GTM_ASSISTANT_GET_OFFSET') return;

  const iframes = document.querySelectorAll('iframe');
  for (const iframe of Array.from(iframes)) {
    if (iframe.contentWindow === e.source) {
      const rect = iframe.getBoundingClientRect();
      const parentOffsetX = isTopFrame ? 0 : iframeOffsetX;
      const parentOffsetY = isTopFrame ? 0 : iframeOffsetY;
      iframe.contentWindow?.postMessage({
        type: 'GTM_ASSISTANT_OFFSET_RESPONSE',
        x: rect.left + parentOffsetX,
        y: rect.top + parentOffsetY,
      }, '*');
      break;
    }
  }
});

const getIframeOffset = () => ({ x: iframeOffsetX, y: iframeOffsetY });

// Shared data attribute list used by both getSelector and getSelectorRecommendations
const DATA_ATTRS = ['data-testid', 'data-cy', 'data-action', 'data-analytics', 'data-id', 'data-name', 'data-gtm-id'];

const cssEscape = (val: string): string =>
  window.CSS?.escape ? window.CSS.escape(val) : val.replace(/([!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1');

const isUnique = (selector: string): boolean => {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
};

// Returns the primary selector for an element. Prefers stable attributes over DOM path.
const getSelector = (element: HTMLElement): string => {
  if (element.id && !/^\d/.test(element.id)) return `#${cssEscape(element.id)}`;
  for (const attr of DATA_ATTRS) {
    const val = element.getAttribute(attr);
    if (val) return `[${attr}="${val.replace(/"/g, '\\"')}"]`;
  }

  const path: string[] = [];
  let cur: HTMLElement | null = element;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    let seg = cur.nodeName.toLowerCase();
    if (cur.parentElement) {
      const siblings = Array.from(cur.parentElement.children).filter(e => e.nodeName === cur!.nodeName);
      if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
    }
    path.unshift(seg);
    cur = cur.parentElement as HTMLElement | null;
    if (cur?.nodeName === 'BODY' || cur?.nodeName === 'HTML') break;
  }
  return path.join(' > ');
};

// Returns up to 6 unique selector candidates. Accepts precomputed selector to avoid double traversal.
const getSelectorRecommendations = (element: HTMLElement, precomputed?: string): string[] => {
  const recommendations: string[] = [];
  const tagName = element.tagName.toLowerCase();

  // 1. ID — if unique, no need to continue
  if (element.id) {
    const idSelector = `#${cssEscape(element.id)}`;
    if (isUnique(idSelector)) {
      recommendations.push(idSelector);
      return recommendations; // ID is already unique; skip rest
    }
    const idAttrSelector = `[id="${element.id.replace(/"/g, '\\"')}"]`;
    if (isUnique(idAttrSelector)) recommendations.push(idAttrSelector);
  }

  // 2. Data Attributes
  for (const attr of DATA_ATTRS) {
    const val = element.getAttribute(attr);
    if (val) {
      const attrSelector = `[${attr}="${val.replace(/"/g, '\\"')}"]`;
      if (isUnique(attrSelector)) recommendations.push(attrSelector);
    }
  }

  // 3. Classes
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter(c => c && !c.includes(':') && !/^[0-9]/.test(c));
    for (const cls of classes) {
      const classSelector = `.${cssEscape(cls)}`;
      if (isUnique(classSelector)) recommendations.push(classSelector);
      const tagClass = `${tagName}.${cssEscape(cls)}`;
      if (isUnique(tagClass)) recommendations.push(tagClass);
    }
    if (classes.length >= 2) {
      const combined = `.${classes.slice(0, 2).map(cssEscape).join('.')}`;
      if (isUnique(combined)) recommendations.push(combined);
    }
  }

  // 4. Hierarchical fallback — reuse precomputed selector to avoid redundant DOM traversal
  const fallback = precomputed ?? getSelector(element);
  if (fallback) recommendations.push(fallback);

  return [...new Set(recommendations)].filter(Boolean).slice(0, 6);
};

const getOffsetRect = (el: HTMLElement) => {
  const { x, y } = getIframeOffset();
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + y,
    left: rect.left + x,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom + y,
    right: rect.right + x,
    x: rect.x + x,
    y: rect.y + y,
  };
};

const handleHover = (target: HTMLElement, includeRecommendations = true) => {
  if (!canUseIpc) return;
  const selector = includeRecommendations ? getSelector(target) : '';
  ipcRenderer.send('webview-ipc-relay', 'webview-hover', {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    rect: getOffsetRect(target),
    selector,
    recommendations: includeRecommendations ? getSelectorRecommendations(target, selector) : [],
    isSubframe: !isTopFrame,
    frameUrl: window.location.href,
    isPartial: !includeRecommendations,
  });
};

const handleClick = (target: HTMLElement) => {
  if (!canUseIpc) return;
  const selector = getSelector(target);
  ipcRenderer.send('webview-ipc-relay', 'webview-click', {
    tagName: target.tagName,
    rect: getOffsetRect(target),
    outerHTML: target.outerHTML.substring(0, 500),
    selector,
    recommendations: getSelectorRecommendations(target, selector),
    isSubframe: !isTopFrame,
    frameUrl: window.location.href,
  });
};

// --- Event Listeners (Capturing Phase) ---

document.addEventListener('pointermove', (e) => {
  // Only process pointer moves when selection mode is active (cmd held in spec mode)
  if (!selectionEnabled) return;

  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const target = elements.find(el => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT') as HTMLElement | undefined;

    if (target && target !== document.documentElement && target !== document.body) {
      if (target !== lastHoveredElement) {
        lastHoveredElement = target;
        handleHover(target, false);

        if (hoverDebounceTimeout) clearTimeout(hoverDebounceTimeout);
        hoverDebounceTimeout = setTimeout(() => {
          if (lastHoveredElement === target) handleHover(target, true);
        }, 150);
      }
    } else {
      if (lastHoveredElement) {
        lastHoveredElement = null;
        ipcRenderer.send('webview-ipc-relay', 'webview-hover', null);
      }
    }
  });
}, true);

const blockEventInSpecMode = (e: Event) => {
  if (specModeActive && selectionEnabled) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
};

document.addEventListener('pointerdown', (e) => {
  blockEventInSpecMode(e);

  if (!selectionEnabled || !e.metaKey) return;

  const rawTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
  const target = rawTarget?.closest('a, button, input, select, textarea') || rawTarget;

  if (target && target !== document.documentElement && target !== document.body) {
    handleClick(target as HTMLElement);
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener('mouseup', blockEventInSpecMode, true);
document.addEventListener('click', blockEventInSpecMode, true);

// IPC Handler for messages from renderer
if (canUseIpc) ipcRenderer.on('highlight-element', (_event, selector) => {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Meta(Cmd) key state relay (webview-focused keyboard events)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Meta') {
    if (canUseIpc) ipcRenderer.send('webview-ipc-relay', 'webview-cmd-key', { pressed: true });
    if (specModeActive) {
      selectionEnabled = true;
      ensureSelectionStyle(true);
    }
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Meta') {
    if (canUseIpc) ipcRenderer.send('webview-ipc-relay', 'webview-cmd-key', { pressed: false });
    selectionEnabled = false;
    ensureSelectionStyle(false);
    if (lastHoveredElement) {
      lastHoveredElement = null;
      if (canUseIpc) ipcRenderer.send('webview-ipc-relay', 'webview-hover', null);
    }
  }
});

// DOM mutation detection: notify renderer when layout may have changed (e.g. modal open/close)
if (canUseIpc) {
  let mutationDebounce: ReturnType<typeof setTimeout> | null = null;

  const setupMutationObserver = () => {
    if (!document.body) return;
    const observer = new MutationObserver((mutations) => {
      // Only react to structural changes or style/class changes that affect layout
      const relevant = mutations.some(m =>
        m.type === 'childList' ||
        (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class'))
      );
      if (!relevant) return;

      if (mutationDebounce) clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(() => {
        ipcRenderer.send('webview-ipc-relay', 'dom-mutation', true);
      }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  };

  if (document.body) {
    setupMutationObserver();
  } else {
    document.addEventListener('DOMContentLoaded', setupMutationObserver);
  }
}

// Scroll detection: notify renderer while scrolling
let scrollEndTimeout: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('scroll', () => {
  if (!canUseIpc) return;
  ipcRenderer.send('webview-ipc-relay', 'webview-scrolling', true);
  if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
  scrollEndTimeout = setTimeout(() => {
    ipcRenderer.send('webview-ipc-relay', 'webview-scrolling', false);
  }, 150);
}, { capture: true, passive: true });

// Cleanup pending async operations on page unload
window.addEventListener('beforeunload', () => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (scrollEndTimeout) { clearTimeout(scrollEndTimeout); scrollEndTimeout = null; }
  if (hoverDebounceTimeout) { clearTimeout(hoverDebounceTimeout); hoverDebounceTimeout = null; }
});

// Returns the visible rect of an element after clipping against viewport and overflow ancestors.
// Returns null if fully clipped (not visible).
const getClippedRect = (el: HTMLElement): { top: number; left: number; width: number; height: number } | null => {
  const r = el.getBoundingClientRect();
  let clipped = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };

  // Clip against viewport
  clipped = {
    top: Math.max(clipped.top, 0),
    left: Math.max(clipped.left, 0),
    right: Math.min(clipped.right, window.innerWidth),
    bottom: Math.min(clipped.bottom, window.innerHeight),
  };
  if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) return null;

  // Clip against scroll/overflow ancestors
  let parent = el.parentElement;
  while (parent && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const ov = style.overflow + style.overflowX + style.overflowY;
    if (ov.includes('hidden') || ov.includes('scroll') || ov.includes('auto') || ov.includes('clip')) {
      const pr = parent.getBoundingClientRect();
      clipped = {
        top: Math.max(clipped.top, pr.top),
        left: Math.max(clipped.left, pr.left),
        right: Math.min(clipped.right, pr.right),
        bottom: Math.min(clipped.bottom, pr.bottom),
      };
      if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) return null;
    }
    parent = parent.parentElement;
  }

  return {
    top: clipped.top,
    left: clipped.left,
    width: clipped.right - clipped.left,
    height: clipped.bottom - clipped.top,
  };
};

if (canUseIpc) ipcRenderer.on('get-rects', (_event, selectors: string[]) => {
  const rects: Record<string, any> = {};
  const offset = getIframeOffset();
  lastSentRects = ''; // 매 요청마다 항상 최신 rects를 전송

  selectors.forEach(selector => {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) return;

      const visible = getClippedRect(el);
      if (!visible || visible.width <= 0 || visible.height <= 0) return;

      // Check if covered by another element (e.g. modal).
      // Use both center and top-left corner: only hide if both points are covered
      // to avoid false positives on thin/small elements.
      const isCoveredAt = (x: number, y: number): boolean => {
        const topEl = document.elementFromPoint(x, y);
        return topEl !== null && !el.contains(topEl) && !topEl.contains(el);
      };
      const cx = visible.left + visible.width / 2;
      const cy = visible.top + visible.height / 2;
      const cornerX = visible.left + Math.min(4, visible.width / 2);
      const cornerY = visible.top + Math.min(4, visible.height / 2);
      if (isCoveredAt(cx, cy) && isCoveredAt(cornerX, cornerY)) return;

      rects[selector] = {
        top: Math.round(visible.top + offset.y),
        left: Math.round(visible.left + offset.x),
        width: Math.round(visible.width),
        height: Math.round(visible.height),
        borderRadius: window.getComputedStyle(el).borderRadius,
      };
    } catch (e) {
      console.warn(`[GTM Assistant] Failed to process selector "${selector}":`, e);
    }
  });

  const currentRectsStr = JSON.stringify(rects);
  if (currentRectsStr === lastSentRects) return;

  lastSentRects = currentRectsStr;
  ipcRenderer.send('webview-ipc-relay', 'rects-update', rects);
});
