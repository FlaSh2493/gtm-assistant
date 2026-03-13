import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, Shield, Layout, ClipboardCheck } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (url: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onNavigate(url.trim());
    }
  };

  return (
    <div className="home-screen">
      <div className="home-bg-glow"></div>
      
      <motion.div 
        className="home-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="home-logo">🏷</div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          GTM GA Assistant
        </motion.h1>
        <motion.p 
          className="home-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          웹사이트의 GTM 태그와 GA4 이벤트를 <br />
          전문적으로 검수하고 관리하세요.
        </motion.p>

        <motion.form 
          className="home-search-box"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="search-input-wrapper">
            <Globe className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder="검수할 사이트 URL을 입력하세요 (예: google.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="home-start-btn">
            분석 시작 <ArrowRight size={18} />
          </button>
        </motion.form>

        <motion.div 
          className="home-features"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="feature-item">
            <div className="feature-icon"><Layout size={20} /></div>
            <span>명세 작성</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><ClipboardCheck size={20} /></div>
            <span>GTM 검수</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><Shield size={20} /></div>
            <span>정합성 확인</span>
          </div>
        </motion.div>
      </motion.div>
      
      <div className="home-footer">
        © 2026 GTM GA Assistant. All rights reserved.
      </div>
    </div>
  );
};

export default HomeScreen;
