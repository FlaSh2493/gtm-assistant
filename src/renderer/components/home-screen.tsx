import React from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, Shield, Layout, ExternalLink } from 'lucide-react';
import GtmLogo from './gtm-logo';

interface HomeScreenProps {
  url: string;
  onUrlChange: (url: string) => void;
  onNavigate: (url: string, mode?: 'spec' | 'verify') => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ url, onUrlChange, onNavigate }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onNavigate(url.trim());
    }
  };

  const quickLinks = [
    { name: 'Google Tag Manager', url: 'https://tagmanager.google.com', icon: <Layout size={16} /> },
    { name: 'Google Analytics', url: 'https://analytics.google.com', icon: <Shield size={16} /> },
  ];

  return (
    <div className="home-screen">
      <div className="home-bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <motion.div
        className="home-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="home-logo"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <GtmLogo size={80} />
        </motion.div>

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
              placeholder="검수할 사이트 URL을 입력하세요"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="home-start-btn">
            분석 시작 <ArrowRight size={18} />
          </button>
        </motion.form>

        <div className="home-secondary-actions">
          <motion.div
            className="quick-links"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="section-label"><ExternalLink size={14} /> 바로가기</div>
            <div className="links-grid">
              {quickLinks.map((link) => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="link-item">
                  {link.icon}
                  <span>{link.name}</span>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div className="home-footer">
        © 2026 GTM GA Assistant. All rights reserved.
      </div>
    </div>
  );
};

export default HomeScreen;
