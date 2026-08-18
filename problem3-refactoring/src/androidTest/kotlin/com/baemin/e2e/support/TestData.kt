package com.baemin.e2e.support

/** 테스트에 사용하는 데이터 상수. 매직 스트링 제거 및 일괄 관리. */
object TestData {
    const val STORE_NAME = "치킨"
    const val MENU_NAME = "후라이드"
    const val PACKAGE_NAME = "com.baemin.android"
}

/** 주문 상태 enum. assertNotNull 대신 명시적 상태 검증에 사용. */
enum class OrderStatus(val displayText: String) {
    WAITING_FOR_ACCEPTANCE("접수 대기"),
    ACCEPTED("주문 접수"),
    COOKING("조리 중"),
    DELIVERING("배달 중"),
    DELIVERED("배달 완료"),
}
