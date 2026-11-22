# Aquafulness

A first-person swimming experience built with Vite, Three.js and WebGL. Float on a procedural ocean, swim at your own pace and shape the conditions around you.

## Run locally

Requires Node.js 22.12 or later and a WebGL-capable browser.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. `npm run build` produces the static site in `dist/`; `npm run preview` serves that build locally.

Drag the **Swim** and **Look around** sticks with a mouse or touch. On a keyboard, use WASD to swim and the arrow keys to look. The two middle sticks set wave direction and current direction/strength; they retain their position when released (drag the current back to the center to stop it). Open **Environment settings** for weather, wind, wave height, water color, seabed color and depth. Depth and seabed color affect the simulated shallow-water color; this is a surface experience rather than a diving simulation.

## Codespaces and Docker

Open the repository in a GitHub Codespace. The dev container installs dependencies and starts Vite, forwarding port 5173 for live testing. To start it manually, run `npm run dev -- --host 0.0.0.0`.

For a production container:

```sh
docker build -t aquafulness .
docker run --rm -p 8080:80 aquafulness
```

Visit `http://localhost:8080`.

## Android

The checked-in Capacitor project uses application ID `com.aquafulness.app`. Install JDK 21, Android Studio and Android SDK 36, then:

```sh
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug bundleRelease
```

The debug APK and unsigned release AAB are in `android/app/build/outputs/`. You can also open `android/` in Android Studio after syncing. Change the application ID before distributing if it is not owned by your Play account, and increment `versionCode` in `android/app/build.gradle` for each release.

The Build workflow uploads the web build, debug APK and unsigned AAB as artifacts. Play publishing is **opt-in**: configure a GitHub environment named `play-store`, add environment secrets `ANDROID_KEYSTORE_BASE64` (base64 of the upload keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `PLAY_SERVICE_ACCOUNT_JSON` (the Play service account JSON). Grant the service account access to the app in Play Console, create the app and complete any initial Play Console setup, then manually run the workflow with **publish** checked. It signs the bundle and uploads a draft to the internal testing track; promotion and store listing remain in Play Console. Protect the environment with reviewers as appropriate. Never commit signing keys or service account credentials.
