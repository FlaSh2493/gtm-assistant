import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PopoverProps {
  target: HTMLElement | null;
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

    const rect = target.getBoundingClientRect();
    const popoverWidth = 400; // Estimated
    const popoverHeight = 500; // Estimated

    let top = rect.bottom + 10;
    let left = rect.left;

    // Boundary checks
    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - 10;
    }
    if (left + popoverWidth > window.innerWidth) {
      left = window.innerWidth - popoverWidth - 20;
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
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 2147483647,
          pointerEvents: 'auto', // Blocks clicks to the page
        }}
        onClick={onClose}
        onMouseOver={(e) => {
          // Prevent hover outline from triggering on elements behind the overlay
          e.stopPropagation();
        }}
      >
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          onMouseOver={(e) => e.stopPropagation()}
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
