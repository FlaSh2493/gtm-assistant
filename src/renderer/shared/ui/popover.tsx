import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebviewElementInfo {
  tagName: string;
  className?: string;
  id?: string;
  rect: DOMRect;
  outerHTML?: string;
  selector?: string;
  recommendations?: string[];
}

interface PopoverProps {
  target: WebviewElementInfo | null;
  onClose: () => void;
  children: React.ReactNode;
}

const Popover: React.FC<PopoverProps> = ({ target, onClose, children }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }

    const rect = target.rect;
    const popoverWidth = 400; // Estimated
    const popoverHeight = 500; // Estimated

    let top = rect.bottom + 10;
    let left = rect.left;

    // Boundary checks (relative to webview container)
    // For now we use window boundaries as a proxy
    if (top + popoverHeight > window.innerHeight - 100) {
      top = rect.top - popoverHeight - 10;
    }
    if (left + popoverWidth > window.innerWidth - 450) {
      left = Math.max(10, rect.left - popoverWidth + rect.width);
    }

    if (top < 10) top = 10;
    if (left < 10) left = 10;

    setPos({ top, left });
  }, [target]);

  if (!target || !pos) return null;

  return (
    <AnimatePresence>
      <div
        className="popover-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 9999,
          pointerEvents: 'auto',
        }}
        onClick={onClose}
      >
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width: 400,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
          }}
        >
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default Popover;
