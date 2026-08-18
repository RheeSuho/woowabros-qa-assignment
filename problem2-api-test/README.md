# 문제2: B마트 재고 API 테스트 자동화

## 실행 방법

**사전 조건**: Node.js 18 이상

```bash
# 1. 디렉토리 이동
cd problem2-api-test

# 2. 의존성 설치
npm install

# 3. 전체 테스트 실행
npm test
```

**정상 실행 시 출력 예시:**

```
 RUN  v1.6.1

 ✓ src/tests/stock.test.ts        (3 tests)
 ✓ src/tests/orders.test.ts      (12 tests)
 ✓ src/tests/concurrency.test.ts  (1 test)

 Test Files  3 passed (3)
      Tests  16 passed (16)
   Duration  ~1s
```

### 인터랙티브 테스트 러너 (브라우저 UI)

API를 브라우저에서 직접 실행해볼 수 있는 테스트 러너를 제공합니다.

```bash
npx ts-node src/server/stub-server.ts
```

서버 시작 시 로컬, 네트워크, 외부 공개 주소가 모두 출력됩니다:

```
Stub server running
  Local   : http://localhost:3000
  Network : http://192.168.x.x:3000
  Public  : https://xxxx.loca.lt  ← 외부 접속용 (인터넷 어디서나)
```

- **같은 PC**: `http://localhost:3000` 접속
- **같은 네트워크의 다른 기기**: 출력된 Network 주소로 접속
- **외부 네트워크 (다른 와이파이 등)**: 출력된 Public 주소로 접속 — 별도 설정 불필요
- 드롭다운에서 케이스 선택 → **실행** 버튼으로 API 검증
- **전체 실행** 버튼으로 16개 케이스 일괄 실행

> **API 직접 실행하기:**
> - **인터랙티브 테스트 러너**: **http://localhost:3000** — 드롭다운으로 케이스 선택 후 바로 실행
>
> **초기 상품 데이터:**
> | productId | 상품명 | 초기 재고 |
> |-----------|--------|----------|
> | P001 | 떡볶이 세트 | 10개 |
> | P002 | 순대국밥 | 1개 (동시성 테스트용) |
> | P003 | 김밥 도시락 | 0개 (품절) |
>
> 재고가 바뀐 경우 `/v1/test/reset` 으로 초기 상태로 복원할 수 있습니다.

---

## 기술 스택

| 역할 | 도구 |
|------|------|
| 테스트 프레임워크 | Vitest |
| HTTP 테스트 | supertest |
| Stub 서버 | Express (직접 구현) |
| 언어 | TypeScript |

실제 서버 없이 **인메모리 Stub 서버**를 직접 구현해 실행 가능한 상태로 제출했습니다.

---

## API 명세 (자체 정의)

### GET /v1/products/:productId/stock

재고 조회. 장바구니 담기 시점에 호출되며 재고를 차감하지 않습니다.

**응답 예시 (200)**
```json
{
  "productId": "P001",
  "name": "떡볶이 세트",
  "stock": 10,
  "soldOut": false
}
```

**에러**
- `404 PRODUCT_NOT_FOUND`: 존재하지 않는 상품

---

### POST /v1/orders

주문 생성. 결제 완료 시점에 호출되며 재고를 즉시 차감합니다.

**요청 본문**
```json
{
  "productId": "P001",
  "quantity": 2,
  "customerId": "C_001"
}
```

**응답 예시 (201)**
```json
{
  "orderId": "O0001",
  "productId": "P001",
  "quantity": 2,
  "status": "COMPLETED",
  "remainingStock": 8,
  "soldOut": false
}
```

**에러**
- `400 INVALID_REQUEST`: 필수 필드 누락
- `400 INVALID_QUANTITY`: quantity가 0 이하 또는 정수가 아님
- `404 PRODUCT_NOT_FOUND`: 존재하지 않는 상품
- `409 OUT_OF_STOCK`: 품절
- `409 INSUFFICIENT_STOCK`: 요청 수량 > 현재 재고

---

### POST /v1/orders/:orderId/cancel

주문 취소. 차감된 재고를 즉시 복구하며 다른 고객이 즉시 구매 가능한 상태로 전환됩니다.

**응답 예시 (200)**
```json
{
  "orderId": "O0001",
  "status": "CANCELLED",
  "currentStock": 10,
  "availableForPurchase": true
}
```

**에러**
- `404 ORDER_NOT_FOUND`: 존재하지 않는 주문
- `409 ALREADY_CANCELLED`: 이미 취소된 주문

---

## 테스트 코드 구조 설계

```
src/
├── server/
│   ├── store.ts          # 인메모리 상태 + Mutex
│   └── stub-server.ts    # Express 엔드포인트 정의
└── tests/
    ├── fixtures/
    │   └── products.ts   # 테스트 데이터 상수
    ├── helpers/
    │   └── api.ts        # API 클라이언트 + 검증 헬퍼
    ├── stock.test.ts
    ├── orders.test.ts
    └── concurrency.test.ts
```

### fixtures/products.ts — 테스트 데이터 중앙 관리

```typescript
export const PRODUCTS = {
  NORMAL:    { productId: 'P001', initialStock: 10 },
  LOW_STOCK: { productId: 'P002', initialStock: 1  },  // 동시성 테스트용
  SOLD_OUT:  { productId: 'P003', initialStock: 0  },
  NOT_FOUND: { productId: 'P999' },
}
```

테스트 데이터를 fixture로 분리한 이유:
- `productId`, `initialStock` 값을 한 곳에서 관리 → 스텁 서버 시드 데이터 변경 시 fixture만 수정
- 테스트 코드에 매직 스트링/숫자 제거

### helpers/api.ts — API 클라이언트 + 검증 헬퍼

**API 클라이언트 헬퍼**: URL 문자열을 테스트마다 반복하지 않도록 캡슐화
```typescript
getStock(productId)       // GET /v1/products/:id/stock
createOrder(...)          // POST /v1/orders
cancelOrder(orderId)      // POST /v1/orders/:id/cancel
resetStore()              // POST /v1/test/reset (테스트 격리용)
```

**검증 헬퍼**: 반복되는 재고 확인 패턴을 한 줄로
```typescript
await expectStock('P001', 8, false)
// 내부적으로 GET stock 호출 후 stock, soldOut 두 필드를 한번에 assert
```

**테스트 격리**: 각 테스트의 `beforeEach`에서 `resetStore()`를 호출해 스토어를 초기 상태로 복원합니다. 테스트 간 상태 공유 없이 독립적으로 실행 가능합니다.

### server/store.ts — Mutex를 통한 원자적 재고 처리

동시 주문 요청이 도달했을 때 재고를 초과 차감하는 버그를 방지하기 위해 Mutex를 구현했습니다.

```
t=0ms  : 고객 A 요청 도달 → 락 획득, DB 조회 시뮬레이션 시작 (50ms)
t=30ms : 고객 B 요청 도달 → 락 대기 (A가 보유 중)
t=50ms : A 완료 → 재고 1→0 차감, 락 해제
t=50ms : B 락 획득 → 재고 확인 (0) → OUT_OF_STOCK 반환
```

**DB_DELAY_MS(50ms)는 실제 DB가 없어 임의로 설정한 시뮬레이션 값입니다.**
동시성 시나리오가 성립하려면 `B 요청 도달 시점(30ms) < DB_DELAY_MS(50ms)` 조건이 충족되어야 합니다.
A가 락을 보유한 상태에서 B가 도달해야 두 요청이 실제로 겹치기 때문입니다.

락 없이 `await`가 있으면 Node.js 이벤트 루프가 컨텍스트를 전환할 수 있어 두 요청이 모두 `stock=1`을 확인한 후 각자 차감, 최종 재고가 `-1`이 되는 문제가 발생합니다. Mutex가 이 구간을 원자적으로 보호합니다.

### 구현 범위 외 재고 처리 규칙

| 규칙 | 미구현 이유 |
|------|------------|
| 운영자 재고 수동 수정 | 과제에서 제공된 API 3개(`GET /stock`, `POST /orders`, `POST /cancel`)에 포함되지 않아 제외. `PATCH /v1/products/{productId}/stock` 엔드포인트로 구현 가능. |
| 다른 탭에서 재고 변경 즉시 반영 | WebSocket/SSE 기반 실시간 Push가 필요한 구조로, 현재 요청-응답 방식의 스텁 서버 범위를 벗어남. GET /stock 호출 시 항상 최신 재고를 반환하는 것으로 대체. |

---

## AI 도구 활용

본 문제는 **Claude Code** (Anthropic)를 활용해 작성했습니다.

| 단계 | 활용 내용 | 직접 결정한 부분 |
|------|----------|----------------|
| 설계 | 인메모리 스텁 서버 구조, Mutex 동시성 처리 방식 검토 | 스텁 서버 직접 구현 방식 채택 (WireMock 미사용), DB_DELAY_MS 값 설정 근거 |
| 코드 구현 | Express 보일러플레이트, TypeScript 타입 정의 초안 생성 | fixture/helper 분리 구조, 테스트 격리 전략 (beforeEach reset) |
| 프롬프트 | 재고 처리 규칙 중 미구현 항목(WebSocket, 운영자 수정) 문서화 표현 | 미구현 범위 판단 기준 |

> AI는 반복적인 코드 표현을 빠르게 생성하는 데 활용했으며, 테스트 전략과 동시성 설계 의도는 직접 결정했습니다.

---

## 테스트 케이스 목록 (총 14개)

| ID | 분류 | 케이스 | 예상 결과 |
|----|------|--------|----------|
| TC-01 | 재고 조회 | 재고 있는 상품 조회 | 200, soldOut=false |
| TC-02 | 재고 조회 | 재고 0인 상품 조회 | 200, soldOut=true |
| TC-03 | 재고 조회 | 존재하지 않는 상품 | 404 PRODUCT_NOT_FOUND |
| TC-04 | 주문 생성 | 정상 주문 → 재고 차감 확인 | 201, remainingStock 감소 |
| TC-05 | 주문 생성 | 재고 1개 주문 → 품절 전환 | 201, soldOut=true |
| TC-06 | 주문 생성 | 품절 상품 주문 | 409 OUT_OF_STOCK |
| TC-07 | 주문 생성 | 존재하지 않는 상품 주문 | 404 PRODUCT_NOT_FOUND |
| TC-08 | 주문 생성 | quantity=0 | 400 INVALID_QUANTITY |
| TC-09 | 주문 생성 | 수량 > 재고 | 409 INSUFFICIENT_STOCK |
| TC-10 | 주문 취소 | 정상 취소 → 재고 복구 | 200, stock 원복 |
| TC-11 | 주문 취소 | 존재하지 않는 주문 취소 | 404 ORDER_NOT_FOUND |
| TC-12 | 주문 취소 | 이미 취소된 주문 재취소 | 409 ALREADY_CANCELLED |
| TC-13 | 복구 플로우 | 취소 후 다른 고객 즉시 재주문 성공 | 재주문 201 |
| TC-14 | **동시성** | 재고 1개 + 수십ms 간격 2요청 | 1건 201, 1건 409 |
