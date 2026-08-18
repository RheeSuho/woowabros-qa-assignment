package com.baemin.e2e.rules

import android.os.Environment
import android.util.Log
import androidx.test.uiautomator.UiDevice
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import java.io.File

/**
 * 테스트 실패 시 자동으로 스크린샷을 저장하는 JUnit Rule.
 * 원본 코드에는 실패 시 진단 수단이 전혀 없어 CI 실패 원인 파악이 불가능했음.
 * 이 Rule을 @Rule로 등록하면 실패 시점의 화면 상태를 자동으로 캡처함.
 */
class ScreenshotOnFailureRule(private val device: UiDevice) : TestWatcher() {

    override fun failed(e: Throwable, description: Description) {
        val tag = description.methodName ?: "unknown"
        val timestamp = System.currentTimeMillis()
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "test-failures"
        ).also { it.mkdirs() }
        val file = File(dir, "${tag}_${timestamp}.png")

        val saved = device.takeScreenshot(file)
        if (saved) {
            Log.e("ScreenshotRule", "실패 스크린샷 저장됨: ${file.absolutePath}")
        } else {
            Log.e("ScreenshotRule", "스크린샷 저장 실패")
        }
    }
}
