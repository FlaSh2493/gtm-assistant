import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { motion, AnimatePresence } from 'framer-motion';

const HoverOutline: React.FC = () => {
  const { hoveredElement, config } = useGTMAssistant();
  const [rect, setRect] = useState<DOMRect | null>(null);

  if (!config.showHover) return null;

  useEffect(() => {
    if (hoveredElement) {
      setRect(hoveredElement.getBoundingClientRect());
      
      const handleScroll = () => {
        setRect(hoveredElement.getBoundingClientRect());
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    } else {
      setRect(null);
    }
  }, [hoveredElement]);

  if (!hoveredElement || !rect) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          border: '2px solid #3b82f6',
          borderRadius: window.getComputedStyle(hoveredElement).borderRadius,
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
          pointerEvents: 'none',
          zIndex: 2147483646,
          transition: 'all 0.1s ease-out',
        }}
      />
    </AnimatePresence>
  );
};

export default HoverOutline;
