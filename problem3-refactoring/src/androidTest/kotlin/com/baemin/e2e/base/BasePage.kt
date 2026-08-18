package com.baemin.e2e.base

import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until

abstract class BasePage(protected val device: UiDevice) {

    companion object {
        const val DEFAULT_TIMEOUT = 5_000L
        // 결제·주문 등 네트워크 응답이 포함된 화면 전환에 사용
        const val NETWORK_TIMEOUT = 15_000L
        const val POLL_TIMEOUT = 1_000L
    }

    /**
     * 요소가 나타날 때까지 대기 후 반환.
     * 원본의 `device.wait(...).click()` 패턴은 null 반환 시 NPE 발생.
     * 여기서는 null이면 즉시 명확한 오류 메시지로 실패시켜 원인 파악을 쉽게 함.
     */
    protected fun waitFor(selector: BySelector, timeout: Long = DEFAULT_TIMEOUT): UiObject2 =
        device.wait(Until.findObject(selector), timeout)
            ?: error("[${this::class.simpleName}] 요소를 찾지 못했습니다 (${timeout}ms 초과): $selector")

    /** 요소를 찾아 클릭. */
    protected fun click(selector: BySelector, timeout: Long = DEFAULT_TIMEOUT) {
        waitFor(selector, timeout).click()
    }

    /** 요소가 화면에 있는지 여부 확인 (짧은 폴링). 없어도 실패하지 않음. */
    protected fun isPresent(selector: BySelector, timeout: Long = POLL_TIMEOUT): Boolean =
        device.wait(Until.findObject(selector), timeout) != null

    /** 요소의 텍스트를 반환. */
    protected fun getText(selector: BySelector, timeout: Long = DEFAULT_TIMEOUT): String =
        waitFor(selector, timeout).text

    /** 각 페이지의 진입 기준 요소가 나타날 때까지 대기. 페이지 전환 신뢰성 보장. */
    abstract fun waitUntilLoaded(): BasePage
}
