# Mobile Testing Guide

## Testing on Android Emulator (default)

The emulator automatically maps `10.0.2.2` to your laptop's localhost.

No extra configuration needed — `src/config/api.js` handles this automatically.

---

## Testing on Physical Android Phone

1. **Install ngrok**
   ```bash
   npm install -g ngrok
   # Or download from https://ngrok.com
   ```

2. **Start your backend**
   ```bash
   cd backend && npm run dev
   ```

3. **Expose it via ngrok**
   ```bash
   ngrok http 3001
   ```
   Copy the HTTPS URL, e.g. `https://abc123.ngrok-free.app`

4. **Update API config**
   Open `packages/mobile/src/config/api.js` and temporarily change:
   ```js
   // Change this line in getBaseUrl():
   return 'https://abc123.ngrok-free.app/v1';  // your ngrok URL
   ```

5. **Rebuild the app**
   ```bash
   cd packages/mobile && npx react-native run-android
   ```

6. **Connect your phone**
   - Enable USB debugging on your Android phone
   - Connect via USB
   - Run `adb devices` to verify it's detected

---

## 4-Window End-to-End Test

After all apps are built and running, do the full money flow test:

### Window 1: Admin Web (`localhost:3003`)
- Log in as superadmin (+91 9000000001, OTP 000000)
- Go to Approvals
- Approve brand account (+91 9000000010)
- Approve influencer account (+91 9000000020)

### Window 2: Brand Web (`localhost:3002`)
- Log in as brand (+91 9000000010, OTP 000000)
- Top up wallet with ₹50,000
- Create a campaign with a pay-at-store offer
- Invite @ananya_foodie to the campaign

### Window 3: Android Emulator (Influencer app)
- Log in as influencer (+91 9000000020, OTP 000000)
- Go to Offers tab
- Accept the offer from Window 2
- (Sign contract when available)

### Window 4: Android Emulator or physical phone (Follower app)
- Log in as follower (+91 9000000030, OTP 000000)
- Open @ananya_foodie's store
- Use "Pay at Store" with a ₹500 bill
- Verify discount is applied

### Expected result
- Follower pays discounted amount
- Influencer sees commission in pending_balance
- Brand sees conversion in campaign analytics
- After 30 days (cron), commission moves to influencer wallet_balance
