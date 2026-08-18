package com.baemin.e2e.pages

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.baemin.e2e.base.BasePage
import com.baemin.e2e.support.OrderStatus
import org.junit.Assert

class OrderStatusPage(device: UiDevice) : BasePage(device) {

    private companion object {
        val STATUS_SCREEN = By.res("com.baemin.android", "layout_order_status")
        val STATUS_TEXT = By.res("com.baemin.android", "tv_order_status")
        val ORDER_NUMBER = By.res("com.baemin.android", "tv_order_number")
    }

    /**
     * 결제 완료 후 주문 현황 화면까지 NETWORK_TIMEOUT 동안 대기.
     * 원본의 Thread.sleep(5000) → waitFor(NETWORK_TIMEOUT)으로 교체:
     * 화면이 나타나는 즉시 다음 단계로 진행하고, 15초 안에 안 나타나면 명확히 실패.
     */
    override fun waitUntilLoaded(): OrderStatusPage {
        waitFor(STATUS_SCREEN, NETWORK_TIMEOUT)
        return this
    }

    /**
     * 주문 상태 텍스트를 검증.
     *
     * 원본: Assert.assertNotNull(statusText)
     *   → device.wait()는 타임아웃 시 null을 반환하므로, 이 assertion은
     *     "요소를 찾았는가(=null이 아닌가)"만 확인. 실제 텍스트 내용은 검증하지 않아
     *     다른 상태(예: "주문 취소", "결제 실패")에서도 통과할 수 있음.
     *
     * 개선: 실제 표시된 텍스트를 읽어서 기대 상태와 정확히 비교.
     */
    fun assertStatus(expected: OrderStatus): OrderStatusPage {
        val actual = getText(STATUS_TEXT)
        Assert.assertEquals(
            "주문 상태가 일치하지 않습니다. 기대: ${expected.displayText}, 실제: $actual",
            expected.displayText,
            actual
        )
        return this
    }

    /** 주문 번호가 화면에 표시되는지 추가 검증. */
    fun assertOrderNumberVisible(): OrderStatusPage {
        val orderNumber = getText(ORDER_NUMBER)
        Assert.assertFalse("주문 번호가 비어 있습니다", orderNumber.isBlank())
        return this
    }
}
