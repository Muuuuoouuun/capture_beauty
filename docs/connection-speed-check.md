# UI-프론트 ↔ 서버 구동 연결 상태 및 속도 점검

## 점검 목적
다음 단계 진행 전에, 먼저 다음 두 가지를 확인합니다.
1. 프론트엔드(Next.js UI)와 서버(API 라우트)의 실행/연결 상태
2. 초기 구동 및 응답 속도 점검 가능 여부

## 실행 점검 결과

### 1) 의존성 설치
- 실행 명령: `npm install`
- 결과: 실패 (`403 Forbidden`)
- 원인: npm registry 접근 권한/정책 제한으로 패키지 설치 불가

### 2) 구동 연결 상태
- `npm install`이 실패하여 `next dev -p 4001` 실행 전제(모듈 설치)가 충족되지 않음
- 따라서 현재 환경에서는 UI와 API가 실제로 떠 있는지(연결/렌더/응답) 런타임 검증 불가

### 3) 속도 점검 상태
- 서버 미기동 상태로 `TTFB`, `/api/*` 응답시간, 첫 페이지 로딩 시간 측정 불가
- 즉, 속도 수치는 현재 환경에서 산출할 수 없음

## 코드 기준 연결 구조 자체는 정상
- Next App Router 기반으로 UI 페이지와 API 라우트가 동일 앱 내에 구성됨
- 검색/목록/상세 API 엔드포인트가 명확히 분리되어 있어, 런타임만 가능하면 연결 검증이 바로 가능한 상태

## 즉시 실행 가능한 다음 단계 (환경 복구 후)
1. `npm install`
2. `npm run dev` (포트 4001)
3. 연결 확인
   - `GET http://localhost:4001/`
   - `GET http://localhost:4001/search`
   - `GET http://localhost:4001/api/tools`
   - `GET http://localhost:4001/api/search?problem=communication`
4. 속도 측정(권장)
   - `curl -w`로 `/`, `/api/tools`, `/api/search`의 TTFB/total time 10회 평균
   - 브라우저 DevTools로 LCP/CLS/JS payload 점검

## 속도 개선 우선순위 제안
1. 검색 최적화: problem/badge 인덱스성 데이터 구조(서버 DB 전환 시 GIN/BTREE 조합)
2. API 응답 축소: 리스트 카드용 필드 최소화 (summary DTO)
3. 렌더 최적화: 검색 결과 카드 가상화(아이템 수 증가 대비)
4. 캐시 전략: 자주 조회되는 `/api/tools`에 캐시 헤더 적용

## 결론
- 현재 환경은 레지스트리 접근 제한으로 **구동 연결 및 속도 실측 불가**
- 다만 코드 구조상 UI-서버 연결 동선은 마련되어 있으며, 환경만 복구되면 즉시 실측 가능한 상태
