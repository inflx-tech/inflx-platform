package `in`.inflx.app

import android.app.Application
import android.content.res.Configuration
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.soloader.SoLoader
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(AppConfigPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED

        // ── OTA bundle loader ───────────────────────────────────────────────
        // If OtaUpdater.js wrote a fresh JS bundle to the app's private files
        // directory AND marked it ready via the sidecar file, load that one
        // instead of the bundle baked into the APK. Falls back to the APK's
        // built-in bundle when no OTA bundle exists (first launch, or after
        // a fresh install before the first manifest check).
        override fun getJSBundleFile(): String? {
          if (BuildConfig.DEBUG) return super.getJSBundleFile()
          val otaDir = File(applicationContext.filesDir, "ota")
          val ready  = File(otaDir, "ready.marker")
          val bundle = File(otaDir, "bundle.js")
          return if (ready.exists() && bundle.exists() && bundle.length() > 0) {
            bundle.absolutePath
          } else {
            super.getJSBundleFile()
          }
        }
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
  }
}
