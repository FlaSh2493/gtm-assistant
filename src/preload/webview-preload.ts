import { ipcRenderer } from 'electron';

// This script will be injected into the <webview>
// It acts like the old content script, but sends data to the renderer via IPC

const isTopFrame = window === window.top;
const PRELOAD_VERSION = '1.0.5-shield';
console.log(`🚀 [GTM GA Assistant] Webview Preload Injected v${PRELOAD_VERSION} (${isTopFrame ? 'Top Frame' : 'Subframe: ' + window.location.href})`);

// 클릭 차단 여부 - spec 모드일 때 true. 기본값은 false로 설정 (안전성).
let specModeActive = false;
let selectionEnabled = false;
let lastHoveredElement: HTMLElement | null = null;
let hoverDebounceTimeout: any = null;
let rafId: number | null = null;
let lastSentRects: string = ''; // JSON stringified for easy deep comparison

ipcRenderer.on('set-spec-mode', (_event, active: boolean) => {
  specModeActive = active;
});

const ensureSelectionStyle = (enabled: boolean) => {
  let styleEl = document.getElementById('gtm-assistant-selection-style');
  if (enabled) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gtm-assistant-selection-style';
      // Force pointer-events and change cursor for better feedback
      styleEl.textContent = `
        * { pointer-events: auto !important; }
        body, html { cursor: crosshair !important; }
      `;
      document.head.appendChild(styleEl);
    }
  } else {
    styleEl?.remove();
  }
};

const ensureSelectionShield = (enabled: boolean) => {
  let shield = document.getElementById('gtm-selection-shield');
  if (enabled) {
    if (!shield) {
      shield = document.createElement('div');
      shield.id = 'gtm-selection-shield';
      Object.assign(shield.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        cursor: 'crosshair',
        background: 'transparent',
        pointerEvents: 'auto',
        display: 'block',
        border: 'none',
        margin: '0',
        padding: '0'
      });
      
      const parent = document.body || document.documentElement;
      parent.appendChild(shield);
      
      shield.addEventListener('pointermove', (e) => {
        if (!selectionEnabled) return;

        // CMD(Meta)를 누르고 있을 때만 호버 발동
        if (!e.metaKey) {
          if (lastHoveredElement) {
            lastHoveredElement = null;
            ipcRenderer.sendToHost('webview-hover', null);
          }
          return;
        }

        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const elements = document.elementsFromPoint(e.clientX, e.clientY);
          const target = elements.find(el => el.id !== 'gtm-selection-shield' && el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT') as HTMLElement;

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
              ipcRenderer.sendToHost('webview-hover', null);
            }
          }
        });
      });

      shield.addEventListener('pointerdown', (e) => {
        if (!selectionEnabled || !e.metaKey) return;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const rawTarget = elements.find(el => el.id !== 'gtm-selection-shield' && el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT');
        const target = (rawTarget as HTMLElement)?.closest('a, button, input, select, textarea') || rawTarget;
        if (target && target !== document.documentElement && target !== document.body) {
          handleClick(target as HTMLElement);
        }
      });
    } else {
      shield.style.display = 'block';
    }
  } else {
    if (shield) shield.style.display = 'none';
  }
};

ipcRenderer.on('set-selection-enabled', (_event, enabled: boolean) => {
  selectionEnabled = enabled;
  ensureSelectionStyle(enabled);
  ensureSelectionShield(enabled);
});

const getIframeOffset = () => {
  let offsetX = 0;
  let offsetY = 0;
  try {
    let curr: any = window;
    while (curr !== window.top) {
      if (curr.frameElement) {
        const rect = curr.frameElement.getBoundingClientRect();
        offsetX += rect.left;
        offsetY += rect.top;
        curr = curr.parent;
      } else {
        // Cross-origin boundary - cannot go further up
        break;
      }
    }
  } catch (e) {
    // Cross-origin or other restriction
  }
  return { x: offsetX, y: offsetY };
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
    // Try both #id and [id="..."]
    const idSelector = `#${escape(element.id)}`;
    if (isUnique(idSelector)) recommendations.push(idSelector);
    
    // Some IDs might start with numbers or have dots, [id="..."] is very stable
    const idAttrSelector = `[id="${element.id.replace(/"/g, '\\"')}"]`;
    if (isUnique(idAttrSelector)) recommendations.push(idAttrSelector);
  }

  // 2. Data Attributes (Priority for analytics/test tags)
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
  if (fallback) {
    recommendations.push(fallback);
  }

  return [...new Set(recommendations)].slice(0, 6);
};

const getSelector = (element: HTMLElement): string => {
  // Simplistic selector generator for fallback
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

const handleHover = (target: HTMLElement, includeRecommendations: boolean = true) => {
  const offset = getIframeOffset();
  const rect = target.getBoundingClientRect();
  
  ipcRenderer.sendToHost('webview-hover', {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    rect: {
      top: rect.top + offset.y,
      left: rect.left + offset.x,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + offset.y,
      right: rect.right + offset.x,
      x: rect.x + offset.x,
      y: rect.y + offset.y
    },
    selector: includeRecommendations ? getSelector(target) : '',
    recommendations: includeRecommendations ? getSelectorRecommendations(target) : [],
    isSubframe: !isTopFrame,
    frameUrl: window.location.href,
    isPartial: !includeRecommendations
  });
};

document.addEventListener('mouseover', (e) => {
  if (selectionEnabled) return; // Handled by shield
  if (specModeActive) return; // spec 모드에서는 shield가 cmd+hover를 처리
  const target = e.target as HTMLElement;
  if (!target) return;
  handleHover(target);
});

// 마우스 이벤트 차단 (mousedown, mouseup)
const blockEventInSpecMode = (e: MouseEvent) => {
  // Alt, Cmd(Meta), Ctrl 키를 누르고 클릭하면 무조건 허용 (강제 내비게이션용)
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  
  if (specModeActive && selectionEnabled) {
    e.preventDefault();
    e.stopPropagation();
  }
};

const handleClick = (target: HTMLElement) => {
  const offset = getIframeOffset();
  const rect = target.getBoundingClientRect();

  ipcRenderer.sendToHost('webview-click', {
    tagName: target.tagName,
    rect: {
      top: rect.top + offset.y,
      left: rect.left + offset.x,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + offset.y,
      right: rect.right + offset.x,
      x: rect.x + offset.x,
      y: rect.y + offset.y
    },
    outerHTML: target.outerHTML.substring(0, 1000),
    selector: getSelector(target as HTMLElement),
    recommendations: getSelectorRecommendations(target as HTMLElement),
    isSubframe: !isTopFrame,
    frameUrl: window.location.href
  });
};

document.addEventListener('pointerdown', (e) => {
  if (selectionEnabled) return; // Handled by shield
  
  // Use elementFromPoint for the most reliable target identification on disabled elements
  // This bypasses many browser-level restrictions on 'disabled' elements.
  const rawTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
  const target = rawTarget?.closest('a, button, input, select, textarea') || rawTarget;
  
  // 1. Block events first
  const mouseEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: e.clientX,
    clientY: e.clientY
  });
  blockEventInSpecMode(mouseEvent as any);

  // 2. Handle selection
  if (!selectionEnabled) return;
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  if (!target) return;

  handleClick(target as HTMLElement);
}, true);

document.addEventListener('mouseup', blockEventInSpecMode, true);

document.addEventListener('click', (e) => {
  // Alt, Cmd(Meta), Ctrl 키를 누르고 클릭하면 무조건 허용
  if (e.altKey || e.metaKey || e.ctrlKey) return;

  if (specModeActive && selectionEnabled) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);


// IPC Handler for messages from renderer
ipcRenderer.on('highlight-element', (_event, selector) => {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// Meta(Cmd) 키 상태를 renderer에 전달 (webview 포커스 중에도 cmd 감지)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Meta') ipcRenderer.sendToHost('webview-cmd-key', { pressed: true });
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Meta') ipcRenderer.sendToHost('webview-cmd-key', { pressed: false });
});

// Scroll detection: notify renderer to hide overlays while scrolling
let scrollEndTimeout: any = null;
window.addEventListener('scroll', () => {
  ipcRenderer.sendToHost('webview-scrolling', true);
  if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
  scrollEndTimeout = setTimeout(() => {
    ipcRenderer.sendToHost('webview-scrolling', false);
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

ipcRenderer.on('get-rects', (_event, selectors: string[]) => {
  const rects: Record<string, any> = {};
  const offset = getIframeOffset();

  selectors.forEach(selector => {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        const visible = getClippedRect(el);
        if (visible && visible.width > 0 && visible.height > 0) {
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
  ipcRenderer.sendToHost('rects-update', rects);
});

