# 문제3: E2E 자동화 코드 리뷰 및 리팩토링

## 원본 코드 문제점 분석

```kotlin
// 원본
@Test
fun testOrderFlow() {
    val shopItem = device.wait(Until.findObject(By.textContains("치킨")), 5000)
    shopItem.click()
    val menuItem = device.wait(Until.findObject(By.textContains("후라이드")), 3000)
    menuItem.click()
    val orderBtn = device.wait(Until.findObject(By.textContains("주문하기")), 3000)
    orderBtn.click()
    val payBtn = device.wait(Until.findObject(By.textContains("결제")), 3000)
    payBtn.click()
    Thread.sleep(5000)
    val statusText = device.wait(Until.findObject(By.textContains("접수 대기")), 3000)
    Assert.assertNotNull(statusText)
}
```

### 안정성 문제

| # | 문제 | 위치 | 설명 |
|---|------|------|------|
| 1 | **NPE 위험** | 모든 `.click()` 호출 | `device.wait()`는 타임아웃 시 `null`을 반환함. 반환값을 null 체크 없이 바로 `.click()`하면 `NullPointerException` 발생. CI에서는 UI 렌더링이 느려 더 자주 발생. |
| 2 | **하드코딩 대기** | `Thread.sleep(5000)` | 결제 API 응답이 5초보다 느리면 실패(Flaky), 5초보다 빠르면 그만큼 낭비. 네트워크 상태가 불안정한 CI 환경에서 특히 취약. |
| 3 | **오매칭 위험** | `By.textContains("결제")` | "결제" 텍스트가 배너, 이전 화면의 잔상, 다른 버튼에 있을 경우 의도치 않은 요소를 클릭할 수 있음. |
| 4 | **사전 조건 미검증** | `@Before` 없음 | 앱이 열려 있지 않거나, 로그인이 안 된 상태이거나, 이전 테스트의 주문이 완료되지 않은 상태에서 시작하면 모든 단계가 실패. |

### 유지보수성 문제

| # | 문제 | 설명 |
|---|------|------|
| 5 | **Page Object 부재** | 전체 주문 플로우(가게 선택 → 메뉴 → 주문 → 결제 → 완료)가 단일 메서드에 집중. 화면 구조가 바뀌면 어떤 부분을 수정해야 하는지 파악하기 어렵고, 다른 테스트에서 재사용 불가. |
| 6 | **매직 스트링 산재** | `"치킨"`, `"후라이드"`, `"주문하기"`, `"결제"`, `"접수 대기"` 등이 코드 전체에 흩어져 있음. 상수로 관리하지 않으면 변경 시 전체 검색·수정 필요. |
| 7 | **텍스트 기반 locator 의존** | `By.textContains()`는 UI 문구가 바뀌거나(기획 변경, A/B 테스트), 다국어 지원 시 즉시 깨짐. Resource ID를 사용하면 텍스트가 바뀌어도 영향 없음. |

### 신뢰성 문제

| # | 문제 | 설명 |
|---|------|------|
| 8 | **약한 assertion** | `Assert.assertNotNull(statusText)` — `device.wait()`는 요소를 찾으면 객체를 반환하고, 못 찾으면 null을 반환. 이 assertion은 "요소 객체가 null이 아닌가"만 확인. 화면에 실제로 "접수 대기" 텍스트가 노출되는지, 아니면 "주문 취소"나 "결제 실패" 상태인지는 검증하지 않음. |
| 9 | **실패 시 진단 수단 없음** | 스크린샷도 없고, 어느 단계에서 실패했는지 알 수 없음. CI 로그만으로는 "NullPointerException at line 5" 정도만 파악 가능. 재현이 어려운 Flaky는 더욱 추적 불가. |
| 10 | **테스트 격리 없음** | `@After`에서 주문 취소 등 cleanup이 없음. 이 테스트가 남긴 주문 상태가 다음 테스트에 영향을 줄 수 있음 (예: 재주문 불가 상태). |

---

## 리팩토링 설계

### 파일 구조

```
src/androidTest/kotlin/com/baemin/e2e/
├── base/
│   └── BasePage.kt                  # 공통 wait/click 유틸, null 안전 처리
├── pages/
│   ├── StoreListPage.kt             # 가게 목록 화면
│   ├── StoreMenuPage.kt             # 가게 메뉴 화면
│   ├── OrderConfirmPage.kt          # 주문하기 확인 화면
│   ├── PaymentPage.kt               # 결제 화면
│   └── OrderStatusPage.kt           # 주문 현황 화면 + assertion
├── rules/
│   └── ScreenshotOnFailureRule.kt   # 실패 시 자동 스크린샷
├── support/
│   └── TestData.kt                  # 테스트 데이터 상수 + OrderStatus enum
└── tests/
    └── OrderFlowTest.kt             # 테스트 클래스
```

### 핵심 변경사항

#### 1. Null 안전 처리 (안정성)

```kotlin
// Before: null 체크 없이 바로 클릭 → NPE
val shopItem = device.wait(Until.findObject(By.textContains("치킨")), 5000)
shopItem.click()

// After: null이면 명확한 오류 메시지로 즉시 실패
protected fun waitFor(selector: BySelector, timeout: Long = DEFAULT_TIMEOUT): UiObject2 =
    device.wait(Until.findObject(selector), timeout)
        ?: error("[${this::class.simpleName}] 요소를 찾지 못했습니다 (${timeout}ms 초과): $selector")
```

#### 2. 조건부 대기 (안정성)

```kotlin
// Before: 무조건 5초 대기
Thread.sleep(5000)

// After: 결제 완료 화면이 나타나는 즉시 진행. 최대 15초까지 허용.
// waitUntilLoaded()가 NETWORK_TIMEOUT(15_000L)으로 화면 진입 요소 대기
fun waitUntilLoaded(): OrderStatusPage {
    waitFor(STATUS_SCREEN, NETWORK_TIMEOUT)
    return this
}
```

#### 3. Resource ID 기반 locator (유지보수성)

```kotlin
// Before: 텍스트 변경 시 즉시 깨짐
By.textContains("결제")

// After: 화면 구조(resource ID)가 바뀌지 않는 한 유지. 텍스트 변경 영향 없음.
val PAYMENT_BUTTON = By.res("com.baemin.android", "btn_payment")
```

#### 4. 명확한 assertion (신뢰성)

```kotlin
// Before: 요소 null 여부만 확인. 실제 텍스트 내용 미검증.
Assert.assertNotNull(statusText)

// After: 실제 표시된 텍스트를 읽어서 기대 상태와 정확히 비교
fun assertStatus(expected: OrderStatus): OrderStatusPage {
    val actual = getText(STATUS_TEXT)
    Assert.assertEquals(
        "주문 상태가 일치하지 않습니다. 기대: ${expected.displayText}, 실제: $actual",
        expected.displayText, actual
    )
    return this
}
```

#### 5. 리팩토링된 테스트 (가독성)

```kotlin
@Test
fun `정상_주문_플로우_결제_완료_후_접수_대기_상태_확인`() {
    storeListPage
        .waitUntilLoaded()
        .selectStore(TestData.STORE_NAME)        // → StoreMenuPage
        .waitUntilLoaded()
        .selectMenu(TestData.MENU_NAME)
        .tapOrderButton()                         // → OrderConfirmPage
        .waitUntilLoaded()
        .completePayment()                        // → PaymentPage
        .waitUntilLoaded()
        .assertStatus(OrderStatus.WAITING_FOR_ACCEPTANCE)
        .assertOrderNumberVisible()
}
```

---

## Flaky 테스트 원인 추적 순서

이 테스트가 CI에서 간헐적으로 실패한다면 아래 순서로 추적합니다.

### Step 1. 실패 패턴 파악

CI 로그에서 다음을 확인합니다.

- **실패 빈도**: 10회 중 몇 회? 완전히 랜덤인지, 특정 시간대(피크 타임)에 몰리는지
- **실패 단계**: 어느 라인/어느 화면에서 실패하는지
- **에러 유형**: `NullPointerException`(요소 못 찾음) vs `AssertionError`(요소는 찾았는데 값이 다름)

> 원본 코드에는 스크린샷이 없어 이 단계에서 정보가 거의 없음.
> 리팩토링 후에는 `ScreenshotOnFailureRule`이 실패 시점의 화면을 자동 저장.

### Step 2. 실패 단계별 원인 가설

| 실패 단계 | 가능한 원인 |
|-----------|------------|
| `selectStore("치킨")` 실패 | 홈 화면 로딩 미완료, 추천 가게 순서 변동, 네트워크 지연으로 목록 미표시 |
| `selectMenu("후라이드")` 실패 | 가게 진입 후 메뉴 로딩 미완료, 해당 메뉴 일시 품절로 UI 변경 |
| `completePayment()` 실패 | 결제 버튼 locator가 다른 "결제" 텍스트와 충돌 (원본 코드의 경우) |
| `assertStatus` 실패 | 결제 API 응답 지연(Thread.sleep이 5초로 부족), 서버 장애로 상태값 다름 |

### Step 3. 환경 차이 확인

- **CI 기기 vs 로컬 기기**: 기기 성능, 화면 해상도, OS 버전 차이로 UI 렌더링 속도가 다를 수 있음
- **네트워크 지연**: CI 환경에서 결제 API 응답이 로컬보다 느릴 수 있음. `Thread.sleep(5000)`은 이 경우 즉시 Flaky 원인이 됨
- **앱 상태**: 이전 테스트 실행으로 남은 로그인 세션, 장바구니, 주문 상태가 다음 테스트에 영향

### Step 4. logcat 분석

```bash
adb logcat -d | grep -E "Exception|Error|ANR|FATAL"
```

- `ANR`: UI 스레드 블로킹 → 앱이 응답하지 않아 요소 탐색 실패
- `OutOfMemoryError`: 메모리 부족으로 앱 재시작 → 테스트 상태 초기화
- 결제 관련 네트워크 에러: API 응답 지연 or 실패

### Step 5. 격리 및 수정

원인이 특정되면:

| 원인 | 조치 |
|------|------|
| `Thread.sleep` 부족 | `Until.findObject()`의 timeout으로 교체 (조건부 대기) |
| 요소 못 찾음 (NullPointerException) | Resource ID 기반 locator로 교체, timeout 값 검토 |
| 앱 초기 상태 불안정 | `@Before`에서 앱 재시작 + 홈 화면 진입 확인 |
| 이전 테스트 상태 오염 | `@After`에서 주문 취소 cleanup 추가 |
| CI 기기 성능 이슈 | CI 기기 스펙 업그레이드 또는 timeout 값을 환경변수로 주입 |

---

## AI 도구 활용

- **Claude Code**: 문제점 분석 체계화 및 Page Object 구조 설계 검토에 활용
- 코드 작성은 실제 UIAutomator/Kotlin 패턴을 직접 적용했으며, AI가 제안한 구조는 검토 후 프로젝트 맥락에 맞게 조정
