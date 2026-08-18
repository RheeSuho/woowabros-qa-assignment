package com.baemin.e2e.pages

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.baemin.e2e.base.BasePage

class StoreListPage(device: UiDevice) : BasePage(device) {

    private companion object {
        /**
         * Resource ID를 1순위로 사용.
         * By.textContains()는 UI 문구/다국어 변경 시 즉시 깨지므로 최후 수단.
         * 실제 앱의 ID는 Layout Inspector 또는 `uiautomatorviewer`로 확인.
         */
        val STORE_LIST = By.res("com.baemin.android", "rv_store_list")
        val STORE_ITEM_NAME = By.res("com.baemin.android", "tv_store_name")
    }

    override fun waitUntilLoaded(): StoreListPage {
        waitFor(STORE_LIST)
        return this
    }

    /**
     * 가게 목록에서 storeName을 포함하는 가게를 선택.
     * 원본: By.textContains("치킨") — 화면 어디서나 "치킨" 텍스트를 잡을 수 있어 오매칭 위험.
     * 개선: resource ID로 가게 이름 영역을 특정 후 텍스트 필터링.
     */
    fun selectStore(storeName: String): StoreMenuPage {
        click(STORE_ITEM_NAME.textContains(storeName))
        return StoreMenuPage(device)
    }
}
