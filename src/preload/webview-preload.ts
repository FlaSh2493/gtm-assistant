import { ipcRenderer } from 'electron';

// This script will be injected into the <webview>
// It acts like the old content script, but sends data to the renderer via IPC

const isTopFrame = window === window.top;
const PRELOAD_VERSION = '1.0.5-shield';

const canUseIpc = process.isMainFrame;

if (!canUseIpc) {
  // 서브프레임에서는 IPC 불가 - postMessage 브릿지만 사용
  console.log(`[GTM GA Assistant] Subframe without IPC: ${window.location.href}`);
}
console.log(`🚀 [GTM GA Assistant] Webview Preload Injected v${PRELOAD_VERSION} (${isTopFrame ? 'Top Frame' : 'Subframe: ' + window.location.href})`);

// 클릭 차단 여부 - spec 모드일 때 true. 기본값은 false로 설정 (안전성).
let specModeActive = false;
let selectionEnabled = false;
let lastHoveredElement: HTMLElement | null = null;
let hoverDebounceTimeout: any = null;
let rafId: number | null = null;
let lastSentRects: string = ''; // JSON stringified for easy deep comparison

if (canUseIpc) ipcRenderer.on('set-spec-mode', (_event, active: boolean) => {
  specModeActive = active;
});

const ensureSelectionStyle = (enabled: boolean) => {
  let styleEl = document.getElementById('gtm-assistant-selection-style');
  if (enabled) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gtm-assistant-selection-style';
      // Force pointer-events and change cursor for better feedback
      styleEl.textContent = `* { pointer-events: auto !important; }`;
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
  // 1. Send request to top frame
  window.top?.postMessage({ type: 'GTM_ASSISTANT_GET_OFFSET' }, '*');
  
  // 2. Listen for response from parent frames
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'GTM_ASSISTANT_OFFSET_RESPONSE') {
      iframeOffsetX = e.data.x;
      iframeOffsetY = e.data.y;
    }
  });
}

// 3. Top frame (or parent) listens for request and calculates
window.addEventListener('message', (e) => {
  if (e.data?.type === 'GTM_ASSISTANT_GET_OFFSET') {
    // Find which iframe sent the message
    const iframes = document.querySelectorAll('iframe');
    let senderIframe: HTMLIFrameElement | null = null;
    
    for (const iframe of Array.from(iframes)) {
      if (iframe.contentWindow === e.source) {
        senderIframe = iframe;
        break;
      }
    }

    if (senderIframe) {
      const rect = senderIframe.getBoundingClientRect();
      const parentOffsetX = isTopFrame ? 0 : iframeOffsetX;
      const parentOffsetY = isTopFrame ? 0 : iframeOffsetY;
      
      const totalX = rect.left + parentOffsetX;
      const totalY = rect.top + parentOffsetY;

      // Send the absolute offset back to that specific iframe
      senderIframe.contentWindow?.postMessage({
        type: 'GTM_ASSISTANT_OFFSET_RESPONSE',
        x: totalX,
        y: totalY
      }, '*');
    }
  }
});

const getIframeOffset = () => {
  return { x: iframeOffsetX, y: iframeOffsetY };
};

const isUnique = (selector: string): boolean => {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch (e) {
    return false;
  }
};

const getSelectorRecommendations = (element: HTMLElement): string[] => {
  const recommendations: string[] = [];
  const tagName = element.tagName.toLowerCase();
  const escape = (val: string) => (window.CSS && window.CSS.escape ? window.CSS.escape(val) : val.replace(/([!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1'));

  // 1. ID
  if (element.id) {
    const idSelector = `#${escape(element.id)}`;
    if (isUnique(idSelector)) recommendations.push(idSelector);
    const idAttrSelector = `[id="${element.id.replace(/"/g, '\\"')}"]`;
    if (isUnique(idAttrSelector)) recommendations.push(idAttrSelector);
  }

  // 2. Data Attributes
  const dataAttrs = ['data-testid', 'data-cy', 'data-action', 'data-analytics', 'data-id', 'data-name', 'data-gtm-id'];
  for (const attr of dataAttrs) {
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
      const classSelector = `.${escape(cls)}`;
      if (isUnique(classSelector)) recommendations.push(classSelector);
      const tagClass = `${tagName}.${escape(cls)}`;
      if (isUnique(tagClass)) recommendations.push(tagClass);
    }
    if (classes.length >= 2) {
      const combined = `.${classes.slice(0, 2).map(escape).join('.')}`;
      if (isUnique(combined)) recommendations.push(combined);
    }
  }

  // 4. Hierarchical Fallback
  const fallback = getSelector(element);
  if (fallback) recommendations.push(fallback);

  return [...new Set(recommendations)].slice(0, 6);
};

const getSelector = (element: HTMLElement): string => {
  if (element.id && !/^\d/.test(element.id)) return `#${element.id}`;
  const dataAttrs = ['data-testid', 'data-cy', 'data-action'];
  for (const attr of dataAttrs) {
    const val = element.getAttribute(attr);
    if (val) return `[${attr}="${val}"]`;
  }

  const path: string[] = [];
  let cur: HTMLElement | null = element;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    let selector = cur.nodeName.toLowerCase();
    if (cur.parentElement) {
      const siblings = Array.from(cur.parentElement.children).filter(e => e.nodeName === cur!.nodeName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(cur) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    path.unshift(selector);
    cur = cur.parentElement as HTMLElement | null;
    if (cur?.nodeName === 'BODY' || cur?.nodeName === 'HTML') break;
  }
  return path.join(' > ');
};

const getOffsetRect = (el: HTMLElement) => {
  const offset = getIframeOffset();
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + offset.y,
    left: rect.left + offset.x,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom + offset.y,
    right: rect.right + offset.x,
    x: rect.x + offset.x,
    y: rect.y + offset.y,
  };
};

const handleHover = (target: HTMLElement, includeRecommendations: boolean = true) => {
  if (!canUseIpc) return;
  ipcRenderer.send('webview-ipc-relay', 'webview-hover', {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    rect: getOffsetRect(target),
    selector: includeRecommendations ? getSelector(target) : '',
    recommendations: includeRecommendations ? getSelectorRecommendations(target) : [],
    isSubframe: !isTopFrame,
    frameUrl: window.location.href,
    isPartial: !includeRecommendations
  });
};

const handleClick = (target: HTMLElement) => {
  if (!canUseIpc) return;
  ipcRenderer.send('webview-ipc-relay', 'webview-click', {
    tagName: target.tagName,
    rect: getOffsetRect(target),
    outerHTML: target.outerHTML.substring(0, 1000),
    selector: getSelector(target),
    recommendations: getSelectorRecommendations(target),
    isSubframe: !isTopFrame,
    frameUrl: window.location.href
  });
};

// --- Event Listeners (Capturing Phase) ---

document.addEventListener('pointermove', (e) => {
  // selectionEnabled는 set-selection-enabled IPC로만 관리 (e.metaKey로 변경 금지 - 루프 방지)
  if (!selectionEnabled) {
    if (!specModeActive && e.target) {
      handleHover(e.target as HTMLElement);
    }
    return;
  }

  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const rawTarget = elements.find(el => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT') as HTMLElement | undefined;
    const target = rawTarget as HTMLElement;

    if (target && target !== document.documentElement && target !== document.body) {
      if (target !== lastHoveredElement) {
        lastHoveredElement = target;
        handleHover(target, false);

        if (hoverDebounceTimeout) clearTimeout(hoverDebounceTimeout);
        hoverDebounceTimeout = setTimeout(() => {
          if (lastHoveredElement === target) {
            handleHover(target, true);
          }
        }, 150);
      }
    } else {
      if (lastHoveredElement) {
        lastHoveredElement = null;
        if (canUseIpc) ipcRenderer.send('webview-ipc-relay', 'webview-hover', null);
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
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// Meta(Cmd) 키 상태를 renderer에 전달 (webview 포커스 중에도 cmd 감지)
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


// DOM mutation detection: notify renderer when layout-affecting changes occur (e.g. modal open/close)
if (canUseIpc) {
  let mutationDebounce: any = null;
  const setupMutationObserver = () => {
    if (!document.body) return;
    const observer = new MutationObserver(() => {
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

// Scroll detection: notify renderer to hide overlays while scrolling
let scrollEndTimeout: any = null;
window.addEventListener('scroll', () => {
  if (!canUseIpc) return;
  ipcRenderer.send('webview-ipc-relay', 'webview-scrolling', true);
  if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
  scrollEndTimeout = setTimeout(() => {
    ipcRenderer.send('webview-ipc-relay', 'webview-scrolling', false);
  }, 150);
}, { capture: true, passive: true });

// Returns the visible rect of an element after clipping against all scroll/overflow ancestors.
// Returns null if the element is fully clipped (not visible).
const getClippedRect = (el: HTMLElement): { top: number; left: number; width: number; height: number } | null => {
  let r = el.getBoundingClientRect();
  let clipped = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };

  // Clip against viewport
  clipped = {
    top: Math.max(clipped.top, 0),
    left: Math.max(clipped.left, 0),
    right: Math.min(clipped.right, window.innerWidth),
    bottom: Math.min(clipped.bottom, window.innerHeight),
  };
  if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) return null;

  // Clip against each scroll/overflow ancestor
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
  lastSentRects = ''; // 항상 최신 rects를 전송 (캐시 무효화)

  selectors.forEach(selector => {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        const visible = getClippedRect(el);
        if (visible && visible.width > 0 && visible.height > 0) {
          // 모달/오버레이가 덮고 있으면 숨김: 요소 중심점에서 elementFromPoint로 확인
          const centerX = visible.left + visible.width / 2;
          const centerY = visible.top + visible.height / 2;
          const topEl = document.elementFromPoint(centerX, centerY);
          const isCovered = topEl !== null && !el.contains(topEl) && !topEl.contains(el);
          if (isCovered) return;

          rects[selector] = {
            top: Math.round(visible.top + offset.y),
            left: Math.round(visible.left + offset.x),
            width: Math.round(visible.width),
            height: Math.round(visible.height),
            borderRadius: window.getComputedStyle(el).borderRadius
          };
        }
      }
    } catch (e) { /* ignore */ }
  });

  const currentRectsStr = JSON.stringify(rects);
  if (currentRectsStr === lastSentRects) {
    return;
  }
  
  lastSentRects = currentRectsStr;
  ipcRenderer.send('webview-ipc-relay', 'rects-update', rects);
});

