package `in`.inflx.app

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

/**
 * OtaUpdaterModule
 *
 * React-Native-facing native module that downloads a new JS bundle from
 * a URL (typically a Cloudflare R2 presigned URL returned by the
 * backend manifest endpoint), verifies its SHA-256 hash against the
 * expected value from the manifest, and atomically writes the bundle +
 * ready-marker into the app's private files directory.
 *
 * Layout on disk (per app — private storage, wiped on uninstall):
 *   <filesDir>/ota/bundle.js       ← the new JS bundle
 *   <filesDir>/ota/ready.marker    ← sidecar; presence means bundle is valid
 *   <filesDir>/ota/bundle.tmp      ← scratch during download, deleted on success
 *
 * MainApplication.getJSBundleFile() reads the above on every app start:
 *   - ready.marker + bundle.js present → load the OTA bundle
 *   - else → load the bundle baked into the APK
 */
class OtaUpdaterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "OtaUpdater"

  @ReactMethod
  fun install(opts: ReadableMap, promise: Promise) {
    val url     = opts.getString("url")
    val hash    = if (opts.hasKey("hash")) opts.getString("hash") else null
    val version = if (opts.hasKey("version")) opts.getInt("version") else -1

    if (url.isNullOrBlank()) {
      promise.reject("E_NO_URL", "Missing url")
      return
    }

    val ctx = reactApplicationContext
    thread(name = "ota-install") {
      val otaDir  = File(ctx.filesDir, "ota")
      val bundle  = File(otaDir, "bundle.js")
      val tmp     = File(otaDir, "bundle.tmp")
      val ready   = File(otaDir, "ready.marker")
      try {
        if (!otaDir.exists()) otaDir.mkdirs()
        // Clear stale marker while we work — if we crash mid-download,
        // the next launch will use the previous good bundle (or baked-in).
        ready.delete()

        // Download
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout    = 60_000
        conn.instanceFollowRedirects = true
        conn.connect()
        if (conn.responseCode !in 200..299) {
          promise.reject("E_HTTP", "HTTP ${conn.responseCode}")
          return@thread
        }

        val digest = MessageDigest.getInstance("SHA-256")
        conn.inputStream.use { input ->
          FileOutputStream(tmp).use { out ->
            val buf = ByteArray(8192)
            while (true) {
              val n = input.read(buf)
              if (n <= 0) break
              out.write(buf, 0, n)
              digest.update(buf, 0, n)
            }
          }
        }

        // Verify hash (caller supplies "sha256:<hex>" or just "<hex>")
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        if (!hash.isNullOrBlank()) {
          val expected = hash.removePrefix("sha256:").trim().lowercase()
          if (actual != expected) {
            tmp.delete()
            promise.reject("E_HASH", "Bundle hash mismatch (expected $expected, got $actual)")
            return@thread
          }
        }

        // Atomic-ish swap: replace bundle.js with the freshly downloaded temp,
        // then write the marker.
        if (bundle.exists()) bundle.delete()
        if (!tmp.renameTo(bundle)) {
          promise.reject("E_RENAME", "Could not move bundle.tmp → bundle.js")
          return@thread
        }
        ready.writeText("v=$version\nhash=$actual\n")

        Log.i("OtaUpdater", "Installed bundle v$version (${bundle.length()} bytes)")
        val result = Arguments.createMap().apply {
          putBoolean("ok", true)
          putInt("version", version)
          putDouble("size", bundle.length().toDouble())
        }
        promise.resolve(result)
      } catch (e: Throwable) {
        tmp.delete()
        Log.w("OtaUpdater", "install failed: ${e.message}", e)
        promise.reject("E_INSTALL", e.message ?: "install failed")
      }
    }
  }

  /**
   * Wipes the OTA bundle + marker. After this, the NEXT app launch falls
   * back to the bundle baked into the APK. Useful as a rescue path
   * ("something is very wrong, reset to factory bundle").
   */
  @ReactMethod
  fun reset(promise: Promise) {
    try {
      val otaDir = File(reactApplicationContext.filesDir, "ota")
      File(otaDir, "ready.marker").delete()
      File(otaDir, "bundle.js").delete()
      File(otaDir, "bundle.tmp").delete()
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("E_RESET", e.message ?: "reset failed")
    }
  }
}
