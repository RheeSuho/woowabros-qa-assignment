# 문제4: AI를 활용한 QA 자동화 생산성 도구

## 제안 도구 2가지

---

## Tool 1. CI 실패 로그 자동 분류기

### 배경

CI에서 테스트가 실패하면 QA 엔지니어가 로그를 직접 열어 "이게 Flaky인지, 인프라 문제인지, 진짜 버그인지" 판단해야 합니다. 로그가 수십 개 쌓이면 이 분류 작업 자체에 상당한 시간이 소모됩니다.

### 동작 구조

```
CI 실패 로그 (txt)
       ↓
Claude API (CLASSIFIER_SYSTEM_PROMPT)
       ↓
JSON: { classification, confidence, summary, root_cause, recommended_action }
       ↓
터미널 출력 + (확장 시) Slack 알림 / Jira 자동 생성
```

### 분류 기준

| 분류 | 설명 | 예시 |
|------|------|------|
| `INFRA` | 인프라·환경 문제. 코드와 무관. | ADB 연결 실패, 에뮬레이터 부팅 타임아웃 |
| `FLAKY` | 타이밍 의존적 간헐적 실패. 재실행하면 통과할 수 있음. | 요소 탐색 타임아웃, 재실행 시 통과 기록 |
| `REAL_BUG` | 실제 기능 결함. 재실행해도 동일하게 실패. | assertion 실패 (기대값 ≠ 실제값) |

### 실행 방법

```bash
# 의존성 설치
npm install

# API 키 없이 바로 실행 (Mock 모드)
npm run classify:mock
npm run generate:mock

# 실제 API 호출 시 (API 키 필요)
cp .env.example .env  # ANTHROPIC_API_KEY 입력
npm run classify
npm run generate
```

### 실행 결과 예시

```
🔍 CI 실패 로그 자동 분류기
총 3개 로그 분석 중...

────────────────────────────────────────────────────────────
📄 flaky.txt
분류: ⚡ Flaky 테스트  (신뢰도: HIGH)
요약: 홈 화면 로딩 지연으로 인한 요소 탐색 타임아웃 (5000ms 초과)
원인: CI 환경에서 기기 성능으로 인해 rv_store_list가 5초 내에 렌더링되지 않음.
권고: waitUntilLoaded() timeout 증가, CI 기기 스펙 검토.

📄 infra.txt
분류: 🔧 인프라 문제  (신뢰도: HIGH)
요약: Android 에뮬레이터 부팅 실패로 인한 ADB 연결 오류
원인: 에뮬레이터가 120초 내에 부팅되지 않아 ADB 연결 거부.
권고: 에뮬레이터 타임아웃 증가 또는 Device Farm 사용.

📄 real-bug.txt
분류: 🐛 실제 버그  (신뢰도: HIGH)
요약: 결제 완료 후 주문 상태가 "접수 대기"가 아닌 "결제 실패"
원인: 3회 모두 동일한 AssertionError. Flaky가 아닌 일관된 실패.
권고: 결제 API 응답 로그 확인 후 개발팀 버그 리포트 접수.
```

### 파일 구조

```
src/failure-classifier/
├── classifier.ts        # 메인 로직 (API 호출 + 출력)
├── prompts.ts           # 분류 프롬프트 설계
└── sample-logs/
    ├── infra.txt        # 인프라 실패 샘플
    ├── flaky.txt        # Flaky 실패 샘플
    └── real-bug.txt     # 실제 버그 샘플
```

---

## Tool 2. API 명세 → TC 자동 생성기

### 배경

새 API가 추가될 때마다 QA 엔지니어가 Swagger 명세를 보고 수작업으로 테스트 케이스를 작성합니다. 정상/경계값/에러/동시성 케이스를 빠짐없이 설계하는 데 시간이 걸리고, 담당자에 따라 커버리지 편차가 생깁니다.

> 문제2에서 작성한 B마트 재고 API 명세(`stock-api.yaml`)를 입력 샘플로 사용했습니다.  
> 문제2에서 수동으로 설계한 16개 TC와 AI가 생성한 TC를 비교해볼 수 있습니다.

### 동작 구조

```
OpenAPI YAML 명세
       ↓
Claude API (TC_GENERATOR_SYSTEM_PROMPT)
       ↓
JSON: { api, total, test_cases: [{ id, category, title, request, expected_status, ... }] }
       ↓
터미널 출력 + generated-tcs.json 저장
```

### 실행 방법

```bash
# 실제 API 호출
npm run generate

# Mock 모드 (API 키 없이 결과 확인)
npm run generate -- --mock
```

### 실행 결과 예시

```
🤖 API 명세 → TC 자동 생성기
명세 파일: stock-api.yaml

📋 B마트 재고 API — 총 11개 TC 생성

【정상】
  🔴 TC-01  재고 있는 상품 조회 시 200과 soldOut=false 반환
       요청: GET /v1/products/P001/stock
       기대: 200 — { stock: 10, soldOut: false }
  ...

【동시성】
  🔴 TC-11  재고 1개 상품에 2요청 동시 도달 → 1건 성공 1건 품절
       요청: POST /v1/orders
       기대: 1건 201 COMPLETED, 1건 409 OUT_OF_STOCK

💾 전체 결과 저장: generated-tcs.json
```

### 파일 구조

```
src/tc-generator/
├── generator.ts             # 메인 로직
├── prompts.ts               # TC 생성 프롬프트 설계
└── sample-specs/
    └── stock-api.yaml       # 문제2 API 명세 (입력 샘플)
```

---

## 공통

### 기술 스택

| 역할 | 도구 |
|------|------|
| LLM | Claude Haiku (claude-haiku-4-5-20251001) |
| 언어 | TypeScript |
| 런타임 | Node.js + ts-node |
| AI SDK | @anthropic-ai/sdk |

### 확장 방향

- **Slack 알림 연동**: 분류 결과를 CI 완료 시 Slack 채널에 자동 전송
- **Jira 자동 생성**: REAL_BUG 분류 시 Jira 이슈 자동 생성
- **다른 명세 형식**: Postman Collection, REST assured 등도 입력 가능하도록 확장

---

## AI 도구 활용

본 문제는 **Claude Code** (Anthropic)를 활용해 작성했습니다.

| 단계 | 활용 내용 | 직접 결정한 부분 |
|------|----------|----------------|
| 아이디어 선정 | 후보 아이디어 나열 및 비교 검토 | "실패 로그 분류"와 "API 명세 → TC 생성" 2가지 채택 판단 |
| 프롬프트 설계 | `prompts.ts` 초안 생성 | 분류 기준(INFRA/FLAKY/REAL_BUG) 정의, JSON 출력 포맷 설계 |
| 코드 구현 | TypeScript 보일러플레이트, Anthropic SDK 연동 코드 | Mock 모드 추가 여부, 샘플 로그 내용 작성 |

> 이 문제 자체가 AI 도구를 활용한 QA 생산성 도구를 만드는 문제인 만큼, Claude Code로 개발하는 과정 자체가 "AI 도구로 QA 자동화 생산성을 높이는 경험"이기도 했습니다.
