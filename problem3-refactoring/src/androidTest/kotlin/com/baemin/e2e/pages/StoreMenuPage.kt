package com.baemin.e2e.pages

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.baemin.e2e.base.BasePage

class StoreMenuPage(device: UiDevice) : BasePage(device) {

    private companion object {
        val MENU_LIST = By.res("com.baemin.android", "rv_menu_list")
        val MENU_ITEM_NAME = By.res("com.baemin.android", "tv_menu_name")
        val ORDER_BUTTON = By.res("com.baemin.android", "btn_order")
    }

    override fun waitUntilLoaded(): StoreMenuPage {
        waitFor(MENU_LIST)
        return this
    }

    fun selectMenu(menuName: String): StoreMenuPage {
        click(MENU_ITEM_NAME.textContains(menuName))
        return this
    }

    fun tapOrderButton(): OrderConfirmPage {
        click(ORDER_BUTTON)
        return OrderConfirmPage(device)
    }
}
