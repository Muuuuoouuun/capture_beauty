# Capture Beauty

예쁘게 캡쳐되는 앱 — 사진에 필름카메라 감성 프레임과 타임스탬프를 더해 다운로드할 수 있는 웹 도구입니다.

## 기능

- **업로드**: 드래그 앤 드롭 또는 클릭으로 사진 업로드
- **프레임**: 없음 / 폴라로이드 / 필름 보더(스프로킷 홀) 3종
- **타임스탬프**: 클래식 LED(90년대 필름카메라 감성) / 미니멀 화이트 / 장소+날짜 3종
- **위치 지정**: 4개 코너 중 선택
- **다운로드**: 합성된 이미지를 PNG로 저장

모든 합성은 브라우저의 Canvas API로 클라이언트에서 처리되며, 별도 서버 업로드가 없습니다.

## 프로젝트 구조

```
src/
  app/            # Next.js App Router 페이지
  components/     # UI 컴포넌트 (Uploader, CanvasPreview, ControlPanel, DownloadButton)
  lib/canvas/      # 프레임/스탬프 렌더링 코어 로직
  lib/presets/     # 프레임/스탬프 프리셋 정의
  types/           # 공용 타입 정의
```

## 개발

```bash
npm install
npm run dev       # http://localhost:3000
npm run lint
npm run typecheck
npm run build
```

## 기술 스택

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS
