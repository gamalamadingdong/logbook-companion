# Logbook Companion OTA delivery

This directory is the self-hosted Capgo-compatible update service for the LC mobile app. It follows the proven `scheduleboardv2/updates` deployment shape, with stricter trust and compatibility gates.

## Safety defaults

- `release.config.json` is committed with `enabled: false`. A normal build serves `channel_halted` and cannot update a device; `npm run updates:smoke:halted` proves the generated endpoint returns no bundle URL.
- The native shell pins `https://updates.logbook.readyall.org/updates/beta` and embeds `.capgo_key_v2.pub`.
- Enabled releases require the ignored RSA private key through `OTA_PRIVATE_KEY_BASE64` or `OTA_PRIVATE_KEY_FILE`.
- Capgo v2 encryption authenticates the original bundle checksum with the private key and encrypts the bundle. The native plugin uses the embedded public key to reject altered or unsigned bundles.
- Bundles use immutable URLs: `/releases/<channel>/<version>/bundle.zip`.
- The endpoint rejects the wrong app ID, channel, platform, native version, build type, emulator, malformed current version, replay, downgrade, mutable URL, or missing authentication fields.
- The plugin uses `autoUpdate: "onlyDownload"`. In beta, Diagnostics reconciles verified downloaded bundles and installs one explicitly with `CapacitorUpdater.set()` only when no PM5 row or unsaved/ingesting capture is active. Do not queue from an iOS background callback.
- `notifyAppReady()` runs before network initialization. A bundle that cannot start JavaScript before the timeout rolls back natively.

## Trust key

- Public key: `.capgo_key_v2.pub` (committed; not secret).
- Private key: `.capgo_key_v2` (ignored, mode `600`; never print or commit).
- Public-key SHA-256 fingerprint: `ecdfe83ab9deee3bb0c74af3bc2bceeca90a5495f7a5e910f857a8fad7e36b97`.
- Rotating this key requires a new App Store/TestFlight native shell before bundles signed by the new key can be offered.

Before relying on OTA, store the base64-encoded private key as `OTA_PRIVATE_KEY_BASE64` in the dedicated Vercel updates project. Keep a second encrypted operator backup outside the repository; hosted environment variables are not a recoverable backup.

## Local checks

The channel remains halted unless explicitly forced:

```bash
npm run updates:test
npm run updates:build
```

Exercise and verify the enabled path locally without changing the committed halt switch:

```bash
OTA_FORCE_BUILD=true OTA_PRIVATE_KEY_FILE=.capgo_key_v2 npm run updates:build
npm run updates:verify
npm run updates:smoke
```

`updates:verify` independently checks the encrypted bundle SHA-256 and recovers the authenticated plaintext checksum with the committed public key. `updates:smoke` exercises the built API and proves a compatible shell receives the authenticated immutable offer while an incompatible shell receives no URL. Tests also prove rejection of changed bundle bytes and forged checksum authentication.

## Dedicated Vercel project

Create a second Vercel project from this repository with:

- Root Directory: `updates`
- Domain: `updates.logbook.readyall.org`
- Environment: `OTA_PRIVATE_KEY_BASE64` containing base64 of the full private key file
- Optional explicit `OTA_BASE_URL=https://updates.logbook.readyall.org` (any other value fails the build)

`updates/vercel.json` builds the mobile web bundle from the parent project, packages and encrypts it, serves the immutable release directory, and exposes `/updates/beta`.

Do not connect this project to automatic production releases until the halted endpoint has been deployed and checked. Preview deployments may build, but only the pinned custom domain can be offered to clients.

## Publishing a beta update

1. Start from an exact reviewed commit that changes only web assets. Native dependency/config changes require another store build.
2. Increase both `version` and `releaseSequence` in `release.config.json`. Versions are never reused.
3. Set `enabled: true` and keep `compatibleNativeVersions` restricted to installed shells known to support the bundle.
4. Run the enabled local build and `updates:verify`.
5. Review the generated manifest locally; never commit `updates/dist` or `updates/web`.
6. Merge the release change and deploy the dedicated updates project.
7. POST a representative native request to `/updates/beta`; verify an incompatible native version and an emulator receive no URL.
8. On one internal TestFlight device, open Diagnostics, trigger the check, refresh until the verified bundle is listed, and choose **Install downloaded update** while idle. Verify restart, active version, build SHA, and `notifyAppReady()`.
9. Expand only after startup, login, manual logging, Training Block, and PM5 capture smoke checks pass.

`version` is the enforced replay/downgrade boundary because it is available in every native request. `releaseSequence` is operator/audit metadata and must advance with the version; it is not independently persisted by clients.

## Halting and rollback

### Immediate halt

Set `enabled: false` and deploy. New checks receive `channel_halted`; already downloaded but unscheduled bundles remain inactive until LC safely schedules them. If a bundle must never activate, publish a corrective higher version promptly.

### Automatic boot-failure rollback

If the new bundle cannot execute `notifyAppReady()` before `appReadyTimeout`, the native updater marks it failed and restores the prior bundle/builtin assets. Test this with an internal canary bundle that fails before app startup acknowledgment.

### Operator rollback

Do not point the endpoint at a lower or reused version; replay/downgrade protection will reject it. Build the known-good commit as a **new higher semver and release sequence**, verify it, and deploy it as the current beta offer.

## Store boundary

OTA can change JavaScript/CSS/static assets only. Changes to Capacitor plugins, entitlements, permissions, native configuration, native dependencies, or the embedded public key require a new signed App Store/TestFlight binary.
