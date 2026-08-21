package com.baemin.e2e.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.baemin.e2e.pages.StoreListPage
import com.baemin.e2e.rules.ScreenshotOnFailureRule
import com.baemin.e2e.support.OrderStatus
import com.baemin.e2e.support.TestData
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OrderFlowTest {

    private lateinit var device: UiDevice
    private lateinit var storeListPage: StoreListPage

    /**
     * 실패 시 자동 스크린샷 저장.
     * 원본에는 실패 진단 수단이 전혀 없어 CI 실패 원인 파악 불가.
     */
    @get:Rule
    val screenshotRule by lazy { ScreenshotOnFailureRule(device) }

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

        // 앱 기동 및 홈 화면 진입 확인 (사전 조건 검증)
        // 원본에는 이 과정이 없어 앱이 열려 있지 않거나 다른 화면에 있으면 즉시 실패
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val launchIntent = context.packageManager
            .getLaunchIntentForPackage(TestData.PACKAGE_NAME)
            ?: error("${TestData.PACKAGE_NAME} 앱을 찾을 수 없습니다. 기기에 설치되어 있는지 확인하세요.")

        context.startActivity(launchIntent)
        device.wait(Until.hasObject(By.pkg(TestData.PACKAGE_NAME).depth(0)), 5_000L)

        storeListPage = StoreListPage(device)
    }

    /**
     * 정상 주문 플로우: 가게 선택 → 메뉴 선택 → 주문하기 → 결제 → 접수 대기 확인.
     *
     * 원본 코드와의 차이:
     * - 각 단계가 Page Object로 분리되어 화면별 책임이 명확함
     * - 모든 대기가 조건부 (나타나는 즉시 진행, 최대 timeout까지 대기)
     * - assertion이 상태 텍스트 내용까지 검증
     * - 실패 시 어느 단계에서 어떤 요소를 못 찾았는지 메시지로 즉시 파악 가능
     */
    /**
     * 테스트 종료 후 홈 화면으로 복귀.
     * 완료된 주문이 앱에 남아있어도 다음 테스트는 @Before에서 앱을 재시작하므로
     * 화면 상태 오염은 방지됨. 주문 데이터 자체는 서버에 남지만 이 테스트 범위 밖.
     */
    @After
    fun tearDown() {
        device.pressHome()
    }

    @Test
    fun `정상_주문_플로우_결제_완료_후_접수_대기_상태_확인`() {
        storeListPage
            .waitUntilLoaded()
            .selectStore(TestData.STORE_NAME)   // → StoreMenuPage
            .waitUntilLoaded()
            .selectMenu(TestData.MENU_NAME)
            .tapOrderButton()                    // → OrderConfirmPage
            .waitUntilLoaded()
            .completePayment()                   // → PaymentPage
            .waitUntilLoaded()
            .confirmPayment()                    // → OrderStatusPage
            .waitUntilLoaded()
            .assertStatus(OrderStatus.WAITING_FOR_ACCEPTANCE)
            .assertOrderNumberVisible()
    }
}
