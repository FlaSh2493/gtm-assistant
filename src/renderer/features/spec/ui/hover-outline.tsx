import React from 'react';
import { useGTMAssistant } from '../../../app/providers';
import { motion, AnimatePresence } from 'framer-motion';

const HoverOutline: React.FC = () => {
  const { hoveredElement, config } = useGTMAssistant();

  if (!config.showHover || !hoveredElement || config.mode !== 'spec') return null;

  const { rect } = hoveredElement;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{
          opacity: 1,
          scale: 1,
          boxShadow: [
            'inset 0 0 0 1.5px rgba(59, 130, 246, 0.8), 0 0 12px rgba(59, 130, 246, 0.3)',
            'inset 0 0 0 2.5px rgba(59, 130, 246, 0.9), 0 0 20px rgba(59, 130, 246, 0.5)',
            'inset 0 0 0 1.5px rgba(59, 130, 246, 0.8), 0 0 12px rgba(59, 130, 246, 0.3)'
          ]
        }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          },
          opacity: { duration: 0.2 },
          scale: { duration: 0.2 }
        }}
        style={{
          position: 'absolute',
          top: Number(rect.top),
          left: Number(rect.left),
          width: Number(rect.width),
          height: Number(rect.height),
          borderRadius: '8px',
          pointerEvents: 'none',
          zIndex: 9998,
          boxSizing: 'border-box',
        }}
      />
    </AnimatePresence>
  );
};

export default HoverOutline;
