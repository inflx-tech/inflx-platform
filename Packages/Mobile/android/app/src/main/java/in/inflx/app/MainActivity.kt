package `in`.inflx.app

import android.os.Bundle
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // react-native-screens 4: lets Android rebuild screens after the app was killed in the
    // background instead of crashing (its README, Android setup).
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
    // Edge-to-edge on every Android version. Android 15 and 16 force it on an app that targets
    // them (and ignore any request to fit inside the bars); doing it everywhere means every
    // phone behaves the same. src/components/shell/SystemBarFrame.js paints the two bars and
    // keeps the screens between them, as before.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    // An edge-to-edge window is not shrunk for the keyboard any more, so the content is
    // padded by the part of the keyboard that rises above the navigation bar. Where the
    // phone still shrinks the window itself, the keyboard no longer overlaps it and this
    // padding is 0, so the two never add up. The insets are passed on untouched.
    val content = findViewById<android.view.View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
      view.setPadding(0, 0, 0, maxOf(0, keyboard - bars))
      insets
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "InflxMobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
