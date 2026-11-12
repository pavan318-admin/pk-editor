# PK Editor — Web + Android starter

PK Editor is a local-first video-editing application starter built with React, TypeScript, Vite, FFmpeg.wasm and Capacitor.

## Current working features
- Responsive web UI with light/dark themes
- Import local video, image and audio assets
- Video preview and playback
- Basic clip selection and timeline asset lanes
- Trim-range controls
- Playback speed and volume controls
- MP4 export using FFmpeg.wasm (browser downloads the FFmpeg core on first export)
- Text overlay in preview
- Speech-to-text caption capture using browser Speech Recognition where supported
- Android packaging path through Capacitor

## Important current limitations
This is a first functional foundation, not yet a full professional nonlinear editor:
- The first export pipeline exports the selected video clip and applies trim, speed and volume. It does not yet composite multiple clips, overlay music, burn text/subtitles into the exported file, or render transitions.
- The timeline currently manages/selects assets; drag-and-drop clip arrangement and frame-accurate split editing are future milestones.
- Speech recognition is browser-dependent and may require internet/service support. It is not an offline AI transcription model.
- AI background removal, object removal, generative effects and cloud collaboration are not implemented. They require dedicated models/services and explicit privacy/security decisions.
- FFmpeg.wasm can use substantial RAM. Long/high-resolution videos may fail on phones. Test short clips first.
- Use only media you own or have permission to edit.

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- Android Studio only if building the Android APK

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite.

## Build web app
```bash
npm run build
npm run preview
```
The production website is generated in `dist/`.

## Deploy to GitHub Pages
This Vite project uses `base: './'`, which supports relative asset paths. Build with `npm run build`, then deploy the `dist/` folder using GitHub Actions or your preferred static hosting workflow.
For a repository subpath, verify the deployment path and router configuration before publishing.

## Build Android app
Install Android Studio and the Android SDK, then:
```bash
npm install
npx cap add android
npm run android:sync
npm run android:open
```
In Android Studio, wait for Gradle sync, choose a device/emulator, and run the app. To create a signed release APK/AAB, configure a signing key in Android Studio. Never commit signing keys or passwords to GitHub.

## Privacy and security
- Imported media is processed locally in the browser in this starter.
- There is no user account, remote media upload, or cloud project sync by default.
- Do not put private API keys in frontend source code or GitHub.
- For future cloud accounts, use a backend with row-level security, private storage buckets, server-side authorization, and short-lived signed URLs.
- Review FFmpeg and all dependency licenses before commercial distribution. FFmpeg's licensing depends on build configuration.

## Suggested next milestones
1. Add a proper multi-clip timeline with drag/drop, reorder, split and ripple delete.
2. Add audio track mixing and synchronized export.
3. Render text, captions, filters and transitions into output.
4. Add waveform generation and thumbnail strips.
5. Add true AI features using an opt-in backend/model, with consent and clear data-retention settings.
6. Add project autosave/versioning and encrypted cloud sync if required.
