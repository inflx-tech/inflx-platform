package `in`.inflx.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class AppConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppConfig"

    override fun getConstants(): Map<String, Any> {
        val constants = HashMap<String, Any>()
        val ctx = reactApplicationContext
        val resId = ctx.resources.getIdentifier("app_role", "string", ctx.packageName)
        constants["APP_ROLE"] = if (resId != 0) ctx.getString(resId) else "follower"
        return constants
    }
}
