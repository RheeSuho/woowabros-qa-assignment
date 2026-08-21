# 우아한형제들 Senior QA Engineer 사전과제

## 목차

- [문제1: 테스트 자동화 전략 설계 (서술)](docs/problem1-strategy.md)
- [문제2: B마트 재고 API 테스트 자동화](#문제2-b마트-재고-api-테스트-자동화)
- [문제3: E2E 자동화 코드 리뷰 및 리팩토링](#문제3-e2e-자동화-코드-리뷰-및-리팩토링)
- [문제4: AI 생성 코드 검증 자동화](#문제4-ai-생성-코드-검증-자동화)

---

## 문제1: 테스트 자동화 전략 설계

📂 [docs/problem1-strategy.md](docs/problem1-strategy.md)

**설계 의도**
- 2주 오픈 일정을 고려해 ROI 기준으로 자동화 대상을 선별 — API 통합 70% 우선, E2E 10%는 Happy Path만
- Flaky 감지·격리·재시도·원인 분석 4단계 정책으로 CI 안정성 확보
- 수동으로 남겨야 하는 항목(Push 알림 UX, 탐색적 테스트 등)을 명확히 구분해 자동화 과잉 투자 방지

---

## 문제2: B마트 재고 API 테스트 자동화

📂 [problem2-api-test/README.md](problem2-api-test/README.md)

**설계 의도**
- 실제 서버 없이 인메모리 스텁 서버(Express)를 직접 구현해 실행 가능한 상태로 제출
- Mutex 패턴으로 동시 주문 시 재고 초과 차감을 방지하는 원자적 처리 구현
- `fixture / helper / test` 3계층으로 분리해 테스트 데이터와 검증 로직을 재사용 가능하게 설계
- 브라우저 UI(https://woowabros-qa-assignment-1.onrender.com/) 에서 TC를 직접 실행해볼 수 있도록 인터랙티브 테스트 러너 제공

---

## 문제3: E2E 자동화 코드 리뷰 및 리팩토링

📂 [problem3-refactoring/README.md](problem3-refactoring/README.md)

**설계 의도**
- 원본 코드의 문제점 10개를 안정성·유지보수성·신뢰성 3가지 관점으로 분류해 분석
- Page Object Model로 화면별 책임을 분리하고, `BasePage.waitFor()`로 null 안전 처리를 통일
- `Thread.sleep(5000)` → `Until.findObject(NETWORK_TIMEOUT)` 조건부 대기로 교체해 Flaky 원인 제거
- `assertNotNull` → 실제 텍스트 내용까지 비교하는 `assertStatus(OrderStatus.WAITING_FOR_ACCEPTANCE)`로 검증 강화
- `ScreenshotOnFailureRule`로 실패 시 자동 스크린샷 저장해 CI 디버깅 가능

**참고**: 실제 배달의민족 앱 없이는 실행 불가. 과제 요구사항("설계 의도가 드러나는 완성된 코드 형태면 충분")에 따라 코드 형태로 제출.

---

## 문제4: AI 생성 코드 검증 자동화

📂 [problem4-ai-tools/README.md](problem4-ai-tools/README.md)

과제 요구사항(1가지)을 초과해 2가지 도구를 구현했습니다.

**Tool 1 — CI 실패 로그 자동 분류기**
- CI 실패 로그를 입력하면 INFRA / FLAKY / REAL_BUG로 자동 분류 + 원인 요약 + 권고 조치 출력
- 문제3의 Flaky 분석 프로세스를 AI가 자동화하는 구조

**Tool 2 — API 명세 → TC 자동 생성기**
- Swagger YAML 명세를 입력하면 정상·경계값·에러·동시성 케이스를 자동 생성
- 문제2에서 직접 설계한 B마트 재고 API 명세를 샘플 입력으로 사용

**실행 방법 요약**
```bash
cd problem4-ai-tools && npm install
cp .env.example .env  # ANTHROPIC_API_KEY 입력
npm run classify      # 실패 로그 분류기 실행
npm run generate      # TC 생성기 실행

# API 키 없이 결과 확인 (Mock 모드)
npm run classify -- --mock
npm run generate -- --mock
```

---

## AI 도구 활용 내역

본 과제는 [Claude Code](https://claude.ai/code) (Anthropic)를 활용해 작성했습니다.

| 항목 | 활용 방식 |
|------|----------|
| 문제1 전략 서술 | 실무 경험 기반 초안 작성 후 Claude와 구조화 및 표현 다듬기 |
| 문제2 코드 구현 | 설계 의도 직접 결정 후 Claude로 보일러플레이트 생성 및 검토 |
| 문제3 리팩토링 | 문제점 직접 식별 후 Claude로 Kotlin 코드 표현 정리 |
| 문제4 프로토타입 | 아이디어 및 프롬프트 설계 직접 작성 후 Claude로 코드 구현 |

> AI 도구는 작성 보조로 활용했으며, 전략적 판단과 설계 의도는 지원자 본인의 실무 경험을 기반으로 합니다.
