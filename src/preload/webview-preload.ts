import { ipcRenderer } from 'electron';

// This script will be injected into the <webview>
// It acts like the old content script, but sends data to the renderer via IPC

const isTopFrame = window === window.top;
console.log(`🚀 [GTM GA Assistant] Webview Preload Injected (${isTopFrame ? 'Top Frame' : 'Subframe: ' + window.location.href})`);

// 클릭 차단 여부 - spec 모드일 때 true. 기본값은 false로 설정 (안전성).
let specModeActive = false;
let selectionEnabled = false;

ipcRenderer.on('set-spec-mode', (_event, active: boolean) => {
  specModeActive = active;
  console.log('[webview-preload] specModeActive:', specModeActive);
});

ipcRenderer.on('set-selection-enabled', (_event, enabled: boolean) => {
  selectionEnabled = enabled;
  console.log('[webview-preload] selectionEnabled:', selectionEnabled);
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

document.addEventListener('mouseover', (e) => {
  const target = e.target as HTMLElement;
  if (!target) return;

  const offset = getIframeOffset();
  const rect = target.getBoundingClientRect();
  
  console.log(`[webview-preload] ${isTopFrame ? 'Top' : 'Sub'} hover:`, target.tagName, 'offset:', offset);
  
  if (!selectionEnabled) return;

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
    selector: getSelector(target),
    recommendations: getSelectorRecommendations(target),
    isSubframe: !isTopFrame,
    frameUrl: window.location.href
  });
});

// 마우스 이벤트 차단 (mousedown, mouseup)
const blockEventInSpecMode = (e: MouseEvent) => {
  if (specModeActive) {
    e.preventDefault();
    e.stopPropagation();
  }
};

document.addEventListener('mousedown', blockEventInSpecMode, true);
document.addEventListener('mouseup', blockEventInSpecMode, true);

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target) return;

  if (specModeActive) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!selectionEnabled) return;

  const offset = getIframeOffset();
  const rect = target.getBoundingClientRect();

  console.log(`[webview-preload] ${isTopFrame ? 'Top' : 'Sub'} click:`, target.tagName, 'offset:', offset);
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
    selector: getSelector(target),
    recommendations: getSelectorRecommendations(target),
    isSubframe: !isTopFrame,
    frameUrl: window.location.href
  });
}, true);


// IPC Handler for messages from renderer
ipcRenderer.on('highlight-element', (_event, selector) => {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

ipcRenderer.on('get-rects', (_event, selectors: string[]) => {
  console.log('[webview-preload] get-rects', selectors);
  const rects: Record<string, any> = {};
  const offset = getIframeOffset();
  
  selectors.forEach(selector => {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          rects[selector] = {
            top: rect.top + offset.y,
            left: rect.left + offset.x,
            width: rect.width,
            height: rect.height,
            borderRadius: window.getComputedStyle(el).borderRadius
          };
        }
      }
    } catch (e) { /* ignore */ }
  });
  console.log('[webview-preload] sending rects-update', rects);
  ipcRenderer.sendToHost('rects-update', rects);
});

