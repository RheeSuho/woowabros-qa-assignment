package com.baemin.e2e.pages

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.baemin.e2e.base.BasePage

/** 주문하기 확인 바텀시트 / 화면. */
class OrderConfirmPage(device: UiDevice) : BasePage(device) {

    private companion object {
        val ORDER_SHEET = By.res("com.baemin.android", "bottom_sheet_order")
        val PAYMENT_BUTTON = By.res("com.baemin.android", "btn_payment")
    }

    override fun waitUntilLoaded(): OrderConfirmPage {
        waitFor(ORDER_SHEET)
        return this
    }

    fun completePayment(): PaymentPage {
        /**
         * 원본: By.textContains("결제") — "결제" 텍스트가 화면 내 다른 요소(배너, 탭 등)에도
         * 존재하면 의도치 않은 요소를 클릭할 수 있음.
         * 개선: resource ID로 결제 버튼을 정확히 특정.
         */
        click(PAYMENT_BUTTON)
        return PaymentPage(device)
    }
}
