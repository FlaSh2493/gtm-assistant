# GTM GA Assistant

Google Tag Manager(GTM)와 Google Analytics(GA) 구현을 효율적으로 관리하기 위한 데스크톱 애플리케이션입니다. Electron과 React로 만들었습니다.

**버전:** 2.0.0

## 기능

### 🎯 Spec Mode (명세 작성)
GTM과 GA의 측정 명세를 작성하고 관리합니다. 웹사이트 요소 위에 마우스를 올리면 자동으로 측정 문서를 생성하고 정확한 위치를 기록합니다.

### 📖 View Mode (명세 조회)
저장된 명세를 읽기 전용으로 확인합니다. 팀원들과 측정 명세를 공유하되 수정은 방지할 수 있습니다.

### ✅ Verification Mode (검증)
설치된 태그가 측정 명세와 일치하는지 검증합니다. 웹사이트 구현이 계획된 측정 전략을 준수하는지 확인합니다.

## GTM GA Assistant가 필요한 이유?

GTM과 GA를 다룰 때의 불편함을 해결합니다:

- **탭 전환 없이** - 여러 개발자 도구를 오가지 않고 앱에서 바로 태그 확인
- **복잡한 설정 간소화** - 복잡한 GTM 컨테이너 설정을 시각적으로 명확하게 관리
- **팀 협업** - 측정 계획을 팀원과 공유하고 추적
- **로컬 & 빠름** - 클라우드 의존 없이 오프라인에서 풀 속도로 작업

## 기술 스택

- **프레임워크:** [Electron](https://www.electronjs.org/) + [React](https://react.dev/)
- **언어:** [TypeScript](https://www.typescriptlang.org/)
- **스타일:** [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **빌드:** [Vite](https://vitejs.dev/)
- **저장소:** [electron-store](https://github.com/sindresorhus/electron-store)
- **아이콘:** [Lucide React](https://lucide.dev/)

## 아키텍쳐

최적의 성능과 명확한 책임 분리를 위해 이중 WebContentsView 아키텍쳐를 사용합니다:

```
┌─────────────────────────────────────┐
│   Electron BaseWindow                │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ uiView (React UI 레이어)      │  │
│  │ - Spec/View/Verification UI  │  │
│  │ - 배지 & 오버레이             │  │
│  │ (투명 배경)                   │  │
│  └──────────────────────────────┘  │
│           ↕ IPC 채널               │
│  ┌──────────────────────────────┐  │
│  │ guestView (대상 웹사이트)     │  │
│  │ - 웹사이트 콘텐츠            │  │
│  │ - 실제 DOM & 이벤트          │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

이 방식의 장점:
- **독립적 렌더링** - UI와 웹사이트가 별도의 스레드에서 렌더링
- **명확한 포커스 관리** - 어느 레이어가 입력을 받을지 명확함
- **이벤트 간섭 없음** - UI 클릭이 웹사이트에 영향을 주지 않음
- **부드러운 성능** - 배지 애니메이션이 웹사이트 스크롤에 영향을 주지 않음

## 설치

### 필수 요구사항
- Node.js 16+
- npm 또는 pnpm

### 설정

```bash
# 의존성 설치
npm install
# 또는
pnpm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run electron:build

# 린트 실행
npm run lint
```

## 사용법

### 앱 시작

```bash
npm run dev
```

앱이 열리면 사용 가능한 모드를 보여주는 홈 화면이 표시됩니다.

### Spec Mode (명세 작성)

1. **대상 웹사이트 열기** - 문서화하고 싶은 웹사이트의 URL 입력
2. **측정 명세 생성** - "새 명세 생성"을 클릭하거나 기존 명세 열기
3. **웹사이트 네비게이션** - 문서화할 요소를 찾기 위해 웹사이트 탐색
4. **측정 항목 추가** - 요소 위에 마우스를 올려 배지를 배치하고 문서 생성
5. **명세 저장** - 명세가 자동으로 로컬 저장소에 저장됨

### View Mode (명세 조회)

1. **명세 선택** - 목록에서 저장된 명세 선택
2. **명세 읽기** - 측정 세부사항을 읽기 전용으로 확인
3. **공유** - 팀원과 공유하기 위해 명세 내보내기

### Verification Mode (검증)

1. **명세 로드** - 검증할 명세 선택
2. **웹사이트 탐색** - 대상 웹사이트 네비게이션
3. **구현 확인** - 앱이 설치된 태그를 강조 표시하고 명세와 비교
4. **결과 확인** - 제대로 구현된 측정과 누락된 측정 확인

## 프로젝트 구조

```
src/
├── main/              # Electron 메인 프로세스
├── renderer/          # React 애플리케이션
│   ├── features/      # 기능 모듈 (spec, verification, overlay)
│   ├── components/    # 재사용 가능한 UI 컴포넌트
│   ├── context/       # 앱 상태 관리 React Context
│   ├── shared/        # 공유 유틸리티 및 설정
│   └── entities/      # 데이터 모델 및 저장소
├── preload/           # IPC 통신용 Preload 스크립트
└── shared/            # 공유 타입 및 유틸리티
```

## 주요 기능 구현

### 배지 위치 계산
스마트 위치 지정 알고리즘:
- 배지가 뷰포트 밖으로 나가지 않도록 함
- 요소가 화면 가장자리에 있을 때 자동 조정
- 중첩/겹친 요소 처리
- 요소 호버 시 부드러운 애니메이션

### GTM/GA 파싱
다음 항목의 포괄적인 파싱:
- GTM 컨테이너 스크립트
- Google Analytics 태그
- 데이터 레이어 이벤트
- 커스텀 변수 및 트리거

### 로컬 저장소
다음 항목의 영구 저장:
- 측정 명세
- 설정 선호도
- 최근 조회한 명세

## 개발

### 새 기능 추가

1. `src/renderer/features/`에 기능 폴더 생성
2. 기존 패턴 따르기: `components/`, `hooks/`, `services/`
3. 상태 관리에 React Context 사용
4. 필요할 때 IPC로 메인 프로세스와 통신

### IPC 통신

렌더러 프로세스에서 메인 프로세스로 메시지 보내기 예:

```typescript
// 렌더러 프로세스에서
window.electron.send('channel-name', data);

// 메인 프로세스에서 (preload)
ipcRenderer.on('channel-name', (event, data) => {
  // 메시지 처리
});
```

### 배포용 빌드

```bash
npm run electron:build
```

다음을 생성합니다:
- macOS용 `.dmg`
- Windows용 `.exe` 설치 프로그램
- Linux용 `.AppImage`

## 아키텍쳐 진화

이 프로젝트는 중대한 아키텍쳐 개선을 거쳤습니다:

**v1.0** - WebView 기반 접근
- UI와 웹사이트가 하나의 DOM 트리에 있음
- 포커스 관리 문제 빈발
- 이벤트 전파 충돌

**v2.0** - WebContentsView 아키텍쳐
- UI와 웹사이트를 위한 별도의 렌더 프로세스
- 명확한 책임 경계
- 성능과 안정성 대폭 개선

전체 개발 이야기는 [BLOG_POST.md](./BLOG_POST.md)에서 읽을 수 있습니다.

## 핵심 교훈

1. **좋은 아키텍쳐가 기능 수보다 중요** - 안정적인 설계가 자신감 있는 개발을 가능하게 함
2. **근본 원인을 해결하자** - 코드 레벨의 증상 해결은 확장되지 않음
3. **초기 설계에 투자하자** - 나중의 기술 부채를 지수적으로 줄임
4. **명확한 책임 분리** - 복잡성을 감소시키고 유지보수성 개선

## 기여

Pull Request를 환영합니다. 큰 변경사항의 경우 먼저 Issue를 열어 제안하신 변경사항을 논의해주세요.

## 라이센스

MIT

---

더 나은 GTM/GA 관리를 위해 🎯 만들어졌습니다
