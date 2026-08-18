package com.baemin.e2e.pages

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.baemin.e2e.base.BasePage

class PaymentPage(device: UiDevice) : BasePage(device) {

    private companion object {
        val PAYMENT_SCREEN = By.res("com.baemin.android", "layout_payment")
        val CONFIRM_BUTTON = By.res("com.baemin.android", "btn_confirm_payment")
    }

    override fun waitUntilLoaded(): PaymentPage {
        waitFor(PAYMENT_SCREEN)
        return this
    }

    fun confirmPayment(): OrderStatusPage {
        click(CONFIRM_BUTTON)
        /**
         * 원본: Thread.sleep(5000) — 5초 무조건 대기.
         * - 5초 안에 응답이 오면 나머지 시간은 낭비
         * - 서버/네트워크 지연으로 5초 초과 시 실패 (Flaky의 가장 흔한 원인)
         *
         * 개선: OrderStatusPage.waitUntilLoaded()에서 결제 완료 화면이
         * 나타날 때까지 NETWORK_TIMEOUT(15초)까지 대기. 나타나는 즉시 진행.
         */
        return OrderStatusPage(device)
    }
}
