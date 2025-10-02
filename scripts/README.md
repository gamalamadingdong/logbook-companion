# Build Scripts

Automated build versioning scripts for mobile app deployments.

## 📱 Mobile Version Management

### iOS Build Increment
```bash
npm run version:ios
```

Automatically increments the `CURRENT_PROJECT_VERSION` in your Xcode project for App Store submissions.

**When to use:**
- Before building for App Store upload
- App Store requires a unique build number for each submission
- Run this before `npm run ios:release`

### Android Build Increment
```bash
npm run version:android
```

Automatically increments the `versionCode` in your Android `build.gradle` for Play Store submissions.

**When to use:**
- Before building for Play Store upload
- Play Store requires a unique versionCode for each submission
- Run this before `npm run android:release`

### Increment Both Platforms
```bash
npm run version:increment
```

Runs both iOS and Android version increments in sequence.

## 🎯 Source

Extracted from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2) production deployment automation.

## 📝 Notes

- These scripts modify native project files automatically
- Build numbers must always increase for app store submissions
- Version number (e.g., "1.0.0") is separate from build number
- Build numbers are integers (1, 2, 3, etc.)

## ⚙️ Integration with CI/CD

These scripts can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Increment iOS Build
  run: npm run version:ios

- name: Build iOS Release
  run: npm run ios:release
```
