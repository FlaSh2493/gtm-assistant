import { useCallback } from 'react';
import { useGTMAssistant } from '../GTMAssistant';

export const useSelector = () => {
  const { config } = useGTMAssistant();

  const isUnique = (selector: string): boolean => {
    try {
      const elements = document.querySelectorAll(selector);
      return elements.length === 1;
    } catch (e) {
      return false;
    }
  };

  const generateSelector = useCallback((element: HTMLElement): string => {
    // 1. Try configured data attributes
    for (const attr of config.selector.dataAttributes) {
      const val = element.getAttribute(attr);
      if (val) {
        const sel = `[${attr}="${val}"]`;
        if (isUnique(sel)) return sel;
      }
    }

    // 2. Try ID
    if (element.id && !/^\d/.test(element.id)) {
      const sel = `#${element.id}`;
      if (isUnique(sel)) return sel;
    }

    // 3. Try Name
    const name = element.getAttribute('name');
    if (name) {
      const sel = `[name="${name}"]`;
      if (isUnique(sel)) return sel;
    }

    // 4. Try other data attributes (excluding common dynamic ones)
    const attrs = element.attributes;
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.startsWith('data-') && !config.selector.dataAttributes.includes(attr.name)) {
            const sel = `[${attr.name}="${attr.value}"]`;
            if (isUnique(sel)) return sel;
        }
    }

    // 5. Try Class names (BEM or meaningful classes)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter(c => c && !/^(Mui|jsx-|css-)/.test(c));
      for (const cls of classes) {
        const sel = `.${cls}`;
        if (isUnique(sel)) return sel;
      }
      
      // Try combination of classes
      if (classes.length > 1) {
          const sel = `.${classes.join('.')}`;
          if (isUnique(sel)) return sel;
      }
    }

    // 6. Fallback: Full Path (nth-of-type)
    return getPathSelector(element);
  }, [config.selector.dataAttributes]);

  const getPathSelector = (element: HTMLElement): string => {
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

  return { generateSelector, isUnique };
};
