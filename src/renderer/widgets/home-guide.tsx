import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const guideSteps = [
  {
    step: '1',
    title: 'URL 입력 후 분석 시작',
    desc: '검수할 웹사이트 URL을 입력하고 "분석 시작"을 누르세요. 사이트가 내장 브라우저에서 열립니다.',
  },
  {
    step: '2',
    title: '전원 버튼으로 어시스턴트 활성화',
    desc: '상단 헤더 오른쪽의 전원(⏻) 버튼을 켜면 어시스턴트가 활성화됩니다. 끄면 오버레이와 감지 기능이 모두 비활성화됩니다.',
  },
  {
    step: '3',
    title: 'Cmd 키를 누른 채로 요소에 호버',
    desc: '페이지에서 Cmd 키를 누르고 있으면 요소에 파란색 아웃라인이 표시됩니다. 이 상태에서 클릭하면 해당 요소에 태그 스펙을 추가할 수 있습니다.',
  },
  {
    step: '4',
    title: '플로팅 버튼으로 서랍 열기',
    desc: '화면 우측 하단의 🏷 플로팅 버튼을 클릭하면 어시스턴트 서랍이 열립니다. 등록된 스펙 목록을 확인하고 관리할 수 있습니다.',
  },
  {
    step: '5',
    title: 'GTM JSON 내보내기',
    desc: '"GTM JSON" 버튼을 눌러 현재 스펙을 GTM에 가져올 수 있는 JSON 파일로 내보냅니다. 앱에서 삭제한 항목은 파일에서 제외되며, 내보내기 완료 후 로컬에서도 완전히 삭제됩니다.',
  },
  {
    step: '6',
    title: 'GTM JSON 불러오기',
    desc: '"불러오기" 버튼으로 GTM에서 내보낸 JSON 파일을 가져옵니다. GTM에만 있는 항목은 자동으로 추가되고, 동일한 항목은 스킵됩니다. 내용이 다르거나 삭제 충돌이 있는 항목은 직접 선택해 병합할 수 있습니다.',
  },
  {
    step: '7',
    title: '전체 데이터 초기화',
    desc: '서랍 하단의 "전체 데이터 초기화" 버튼을 누르면 저장된 모든 스펙 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없으니 주의하세요.',
  },
];

const HomeGuide: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="guide-section"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.55 }}
    >
      <button className="guide-toggle" onClick={() => setOpen(!open)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={15} />
          <span>사용 방법</span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="guide-steps"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {guideSteps.map((g) => (
              <div key={g.step} className="guide-step">
                <div className="guide-step-num">{g.step}</div>
                <div>
                  <div className="guide-step-title">{g.title}</div>
                  <div className="guide-step-desc">{g.desc}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HomeGuide;
