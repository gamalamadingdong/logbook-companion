# M5 installed-app verification

Date: 2026-09-22

## Automated installed Android scope

The `android-installed-smoke` CI job installs the exact unsigned debug APK produced by the Android build job into an API 35 x86_64 emulator and exercises:

1. bundled cold launch;
2. warm custom-scheme delivery of `logbookcompanion://app/pm5` into the React navigation bridge;
3. Android hardware Back delivery into the bridge;
4. cold custom-scheme delivery to `/auth/callback`;
5. bundled cold launch with Wi-Fi and mobile data disabled.

The app registers the same `logbookcompanion` scheme on Android and iOS. URL parsing accepts only `logbookcompanion://app/...`, rejects other schemes/hosts and unsafe callback destinations, and routes both launch URLs and warm `appUrlOpen` events through React Router.

## Operator configuration

Before sending Supabase invite or recovery links to an installed build, add this exact redirect to the approved Supabase Auth redirect allowlist:

`logbookcompanion://app/auth/callback`

That live configuration is not changed by this branch.

## Not proven by emulator CI

- real Supabase email/password, guest, invite, or recovery UI/session behavior;
- iOS runtime URL delivery and back/navigation behavior;
- OS Bluetooth permission prompts;
- PM5 discovery, programming, capture, SQLite persistence, or LC ingestion;
- signed TestFlight/Play installation.

Those require operator credentials, an iOS/Android device, or physical PM5 access. E6 remains the physical PM5 end-to-end gate.
