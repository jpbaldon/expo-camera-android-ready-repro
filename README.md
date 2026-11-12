# expo-camera Android `onCameraReady` repro

Minimal app for an Expo SDK bug report.

On Android, `expo-camera` fires `onCameraReady` when CameraX reports `CameraState.Type.OPEN`. After a facing change or a picture↔video rebind, that can happen while the capture session is still being configured. A `recordAsync()` started from `onCameraReady` and stopped after a few hundred milliseconds can then fail with CameraX `ERROR_NO_VALID_DATA` (`Video recording Failed: Unknown error`).

This repo is a blank `create-expo-app` (SDK 58) plus `expo-camera`. It does not include any other app code.

## How it was created

```text
npx create-expo-app@latest expo-camera-android-ready-repro --template blank --yes
cd expo-camera-android-ready-repro
npx expo install expo-camera
```

`App.js` is the only application source that was edited. `app.json` adds the `expo-camera` config plugin and an Android application id so `npx expo run:android` can produce a development build.

## Steps to reproduce

Platform: Android (physical device).  
Environment: development build (`npx expo run:android`), not Expo Go.  
Package manager: npm.

1. Clone this repository and run `npm install`.
2. Connect an Android phone and run `npx expo run:android`.
3. Grant camera and microphone when asked.
4. Tap **Run sequence**.

The sequence, for each step, waits for `onCameraReady` and then:

- **video steps:** calls `recordAsync()` immediately and `stopRecording()` after 300ms
- **picture rebind:** does not record; switches `mode` back to `video`

Expected: each video `recordAsync` resolves with a file URI. After a facing or picture↔video rebind, `onCameraReady` means the new preview is showing frames.

Actual (unpatched Android): after a rebind, `onCameraReady` can fire while the session is still opening. A 300ms recording started then can fail with `ERROR_NO_VALID_DATA` / `Video recording Failed: Unknown error`. Failures are printed on screen and in logcat (`adb logcat -s ReactNativeJS`).

## Related

- https://github.com/expo/expo/issues/50878 is the same class of bug on **web** (ready before a capturable frame). It does not cover Android.
- Current `main` still emits `onCameraReady` from `CameraState.Type.OPEN` in `ExpoCameraView.observeCameraState`.
