# M5 installed-app verification

Date: 2026-09-22

## Automated installed Android scope

Historical scope: PR #203 introduced an `android-installed-smoke` job, but PR #204 removed that flaky job and its script. Native CI is now manual-only. The list below is the intended installed-app matrix, not evidence of a currently active or passing automated gate:

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

## Native-auth implementation follow-up

The current native-auth branch adds secure session storage, system-browser Concept2 development authorization, owner/state/expiry checks, and an HTTPS-to-app code return. Its unit and bundle checks do not close the installed-app gates above. Rollout/configuration and the new-binary requirement are recorded in [mobile delivery](../mobile-delivery.md#development-first-native-auth-implementation).
