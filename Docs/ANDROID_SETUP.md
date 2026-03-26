# Android Emulator Setup

## One-time setup

1. **Install Android Studio**
   Download from https://developer.android.com/studio

2. **Create a virtual device**
   - Open Android Studio
   - Go to **Tools → Device Manager**
   - Click **Create Device**
   - Select: **Pixel 6** → **Android 14 (API 34)**
   - Click **Finish**

3. **Install React Native dependencies**
   ```bash
   cd packages/mobile
   npm install
   ```

4. **Set ANDROID_HOME** (if not set by Android Studio)
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

---

## Running the app

1. **Start the emulator**
   Open Android Studio → Device Manager → ▶ Start

2. **Start the backend** (in terminal 1)
   ```bash
   cd INFLX/backend && npm run dev
   ```

3. **Start Metro bundler** (in terminal 2)
   ```bash
   cd INFLX/packages/mobile && npx react-native start
   ```

4. **Run on emulator** (in terminal 3)
   ```bash
   cd INFLX/packages/mobile && npx react-native run-android
   ```

The app installs on the emulator and opens automatically.

---

## The emulator maps `10.0.2.2` → your laptop's `localhost`

The API config in `src/config/api.js` automatically uses `http://10.0.2.2:3001/v1` for Android emulator builds. No manual change needed.

---

## Troubleshooting

**"SDK location not found"**
```bash
echo "sdk.dir=$ANDROID_HOME" > packages/mobile/android/local.properties
```

**Metro bundler port conflict**
```bash
npx react-native start --port 8082
```

**App crashes on startup**
- Check Metro bundler terminal for JS errors
- Check `adb logcat` for native errors
