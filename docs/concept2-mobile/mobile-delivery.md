# Mobile Delivery Specification and Status

**Goal:** Deliver the existing LC application through an independently releasable iOS/TestFlight foundation, then prove LC-owned self-hosted OTA installation and rollback.

**Architecture:** Wrap the existing Vite application with Capacitor, following ScheduleBoard's working GitHub Actions native pipeline and Capgo/Vercel update pattern. Native binary delivery and web-bundle delivery are distinct release paths with independent approval and rollback controls.

**Tech stack:** React/Vite/TypeScript, Capacitor, GitHub Actions Android/Java 21 and macOS/Xcode, App Store Connect/TestFlight, `@capgo/capacitor-updater`, self-hosted Vercel updates.

## 2026-09-21 implementation checkpoint

- Merged: Capacitor Android/iOS source projects, LC identity, Bluetooth permissions/privacy text, direct athlete `/pm5` flow, and published shared RWN/ErgLink dependencies.
- Proven in CI: full web tests/lint/build, unsigned Android debug APK compilation with Java 21, and unsigned iOS simulator compilation with CocoaPods/Xcode.
- Proven on a real PM5 through the shared browser harness: fixed-distance programming and initial variable-workout work/rest transitions.
- Not yet proven: installed LC app authentication/deep links, physical Android/iOS PM5 use, native capture persistence/LC ingestion, signing, TestFlight/Play distribution, or OTA delivery/rollback.

## Global constraints

- ADR-004 remains the direction: Capacitor, not React Native. LC now has Capacitor dependencies, Android/iOS projects, sync scripts, and unsigned native CI.
- GitHub Actions builds the binary; self-hosted Capgo/Vercel distributes compatible web bundles. **Do not reintroduce Appflow**, retired for cost.
- Android and iOS source scaffolding now advance together. Direct foreground PM5 programming and BLE permissions are implemented; background capture, force curves, capture ingestion, and automatic publishing remain out of scope.
- LC owns bundle ID, app record, profiles, endpoint and release configuration. Do not copy ScheduleBoard secrets or identity, Firebase, push, SQLite, camera/location permissions, mixed-content settings or unrelated plugins.
- Apple account actions, signing provisioning, uploads, hosted deployment and public release require operator authorization. A documentation PR authorizes none of them.
- TestFlight archive work does not require Concept2 write approval. Safe Concept2 OAuth remains required for the completed mobile foundation; reuse the server auth prerequisite in [publishing P1](publishing.md), not the publishing service itself.

## Reference inspection and reuse boundaries

Sam confirms ScheduleBoard's pipeline and live updates are reliable in use. The following local files were read on 2026-09-15 under `~/apps/scheduleboardv2/`; this is implementation evidence, not a new verification of hosted services, signing accounts or device behavior. Do not modify that repository.

| Reference | Reuse / adaptation |
|---|---|
| `capacitor.config.ts` | Updater endpoint, background rather than direct update, app-ready timeout and failure cleanup configuration. Replace identity/endpoint; explicitly retain a known-good fallback strategy. |
| `capacitor.config.production.ts` | Separate configuration exists but lacks the updater block present in the main config. Prove which config actually reaches `cap sync`; filenames do not establish build behavior. |
| `package.json` | `build:prod`, `updates:build`, iOS sync/assets/version helpers; LC's scripts should remain minimal and reproducible with its lockfile. |
| `.github/workflows/build-mobile.yml` | Manual iOS selection, upload-disabled option, macOS/Xcode archive/export, temporary signing keychain, artifact retention and store upload. Reference tag pushes can upload automatically; LC should require explicit protected release approval instead. Verify supported runner/Xcode/export options when implementing. |
| `docs/ci/MOBILE-BUILD-SECRETS.md` | Secret names/encoding conventions only. Do not follow legacy suggestions to retain a private key in the repo. |
| `updates/build-manifest.ts` | Bundles, checksums, optional signing, version metadata and generated updater response. LC production generation must fail closed without signing; do not copy an optional-signing path. |
| `updates/vercel.json`, `updates/vite.config.ts` | Separate update build, routes and cache behavior. Bundle origin/build-time public environment must be LC-specific. |
| `updates/api/updates.mjs` | Inspected response returns version, mutable root bundle URL and checksum. It does not itself enforce the manifest's native-version/channel fields. Adopt immutable version URLs and explicit compatibility/channel selection. |
| `src/lib/updatePublicKey.ts`, `src/App.tsx` | Public key declaration and updater event/app-ready calls exist. A public key file/signature artifact is not proof the native download path verifies signatures. Trace selected plugin's actual verification API before release. App-ready after component mount is not proof core routes/storage work. |

Some `updates/README.md` prose describes Appflow/future integration and is stale per the user and roadmap. Follow executable workflow/client paths and close LC safety gaps rather than adding another delivery vendor or claiming every reference safeguard is enforced.

## Apple registration and signing operator checklist

These are future operator actions. Consult current [Apple Developer account guidance](https://developer.apple.com/help/account/) and [App Store Connect guidance](https://developer.apple.com/help/app-store-connect/) at execution; account eligibility and current requirements have not been checked.

- [ ] **Owner/team:** Sam confirms active membership, authorized release operator, team access/agreements, display name and unique reverse-domain LC bundle ID. Record non-secret identifiers and approval, not passwords or private key material.
- [ ] **App ID:** operator registers an explicit identifier in Certificates, Identifiers & Profiles with only needed capabilities. Assess actual login offerings against Sign in with Apple requirements. No speculative Bluetooth/background/camera/location capabilities.
- [ ] **App record:** operator creates iOS app in App Store Connect, selecting that bundle ID, name, language, unique SKU and team access; record Apple app ID. Resolve agreement/access blockers before uploads.
- [ ] **Native identity:** implementer sets matching bundle ID/team, icons/launch assets, deployment target and marketing version/build-number policy in Capacitor/Xcode. Choose monotonically increasing build numbers that stay unique across reruns/release branches; record commit → native build mapping.
- [ ] **Signing profile:** authorized operator supplies distribution certificate and App Store provisioning profile matching LC app ID/team/capabilities. Use an approved existing certificate only if explicitly authorized; never reuse ScheduleBoard's app-specific profile.
- [ ] **CI inputs:** provision approved GitHub environment secrets: `APPLE_CERTIFICATE_P12` (base64), `APPLE_CERTIFICATE_PASSWORD` (plain), `APPLE_PROVISIONING_PROFILE` (base64), `APPLE_TEAM_ID` (identifier), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER_ID` (identifiers), `APPLE_API_KEY_P8` (base64). Confirm API role/app access needed for upload. Names/encodings are conventions, not evidence credentials exist.
- [ ] **Secret hygiene:** ephemeral signing keychain and temporary files, masked logs, least-privilege workflow permissions, protected release environment, cleanup on failure/cancellation and bounded artifact access. Do not commit `.p8`, `.p12`, provisioning profiles or update signing keys; do not echo them in logs. Record renewal/revocation owner and expiry reminder without values.
- [ ] **Archive first:** run LC workflow with upload disabled; inspect exported app identity, entitlements, version/build number and archive/IPA. Linux can build/test web code but cannot perform Xcode archive/signing; use the macOS runner.
- [ ] **TestFlight permission:** obtain separate upload approval, upload exact verified artifact, complete processing/export compliance as required, configure internal testers and install on an iPhone. External testers may require Beta App Review.
- [ ] **Public submission later:** screenshots, description, support/privacy URLs, privacy disclosures including analytics/OTA behavior, age rating, review access and account deletion where required. Confirm current [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), including downloaded-code restrictions. Public App Store submission/release is not an automatic merge/tag side effect.

## Native authentication and UX contract

Use system-browser OAuth with an LC-owned allowlisted HTTPS server callback, then an approved native return strategy (universal link preferred if LC domain association is available; registered custom scheme is an alternative requiring explicit review). The selected scheme/domain, entitlements, Supabase redirect allowlist, Concept2 registered callback and return route must be recorded together before configuration. Do not invent a final bundle ID/domain here.

Bind OAuth state to the initiating user/session/environment; validate it server-side. Return only a short-lived one-time exchange reference, not client secrets or provider refresh tokens in a URL. Reject expired/replayed/mismatched returns and arbitrary redirect destinations. Review secure native session persistence and logout cleanup; do not assume browser localStorage behavior satisfies native token-security requirements. Existing [Callback](../../src/pages/Callback.tsx) and [Concept2 client](../../src/api/concept2.ts) reference a browser `VITE_CONCEPT2_CLIENT_SECRET`; remove this relevant secret-bearing exchange/refresh path before distributing the shell.

Test cold launch and already-running return, cancellation, browser dismissal, restored session, expired session, reconnect, denied permission, offline/network interruption and sign-out/relaunch. Web login/redirect behavior must keep working. The app must show usable safe-area layout, keyboard/focus behavior and navigation on Dashboard, workout list/detail, library and support-work screens, including deep route loading and back behavior. Offline screens report unavailable data honestly; no new offline-first storage subsystem is required.

## OTA contract and operator recovery

1. **Release identity:** each signed immutable bundle identifies commit, web version/release sequence, channel, bundle hash and supported native/bridge compatibility range. Store matching build metadata; branch names alone are not release authorization. Preview/test endpoints cannot return production offers and production devices cannot consume arbitrary branch builds.
2. **Authenticity and integrity:** use the selected plugin's supported native verification mechanism and LC-owned trust key. Verify signature and expected digest before activation; checksum alone is not authenticity. Bind authenticated metadata to the bundle, allowed origin, channel and native compatibility. Reject missing/invalid signature, tampering, unexpected host, malformed metadata and incompatible versions. Production build fails if signing inputs are absent. Establish key rotation/revocation recovery, including a new native trust anchor when necessary; never ship private keys.
3. **Serving:** versioned immutable bundle URLs, consistent manifest/bundle promotion and explicit cache policy. Do not pair a cached manifest with a mutable `/bundle.zip` from another release. Validate updater request/response compatibility against the actual installed plugin; generating `minNativeVersion` without enforcing it is insufficient.
4. **Compatibility:** new native plugins, permissions, entitlements, bridge API changes or incompatible local-storage migrations require a new binary. OTA must remain compatible with the installed binary and rollback bundle. Downloaded code must comply with Apple policy; this plan is not a policy approval.
5. **Activation/readiness:** download/apply at safe lifecycle boundaries with pending writes preserved. Never activate during workout capture; enforce an application-level busy guard when capture arrives, and protect unsaved work now. Acknowledge app-ready only after core UI/storage initialization succeeds, within a measured timeout; network unavailability alone must not brick startup. A failed boot or missing acknowledgement restores the known-good/built-in bundle without clearing athlete data.
6. **Rollout/recovery:** initially test devices only, then explicit production promotion. Keep previous signed compatible artifacts and baseline native build available. Operator halts new offers, restores a signed known-good compatible offer (using a newer release sequence if needed to avoid replay protection conflict), validates endpoint/cache and verifies recovery on a device already running the bad release. A server rollback alone does not remove an installed bundle. Document manual recovery/new native release when automatic recovery is impossible. Do not couple this to publishing-service deployments.

## Implementation tasks

### M1 — Minimal LC shell and unsigned native CI

**Files:** implemented as `capacitor.config.ts`, generated `android/` and `ios/` projects, `.github/workflows/mobile-native-checks.yml`, package scripts/dependencies, and the direct PM5 route/service. A release-operations runbook remains for signed distribution work.

- [ ] Close Apple ownership/app-record/signing decisions and record them in a release runbook. LC bundle/application identity and compatible Capacitor/Node/Xcode build versions are implemented for unsigned compilation.
- [x] Add minimal Android/iOS shell dependencies and an unsigned native workflow adapted from ScheduleBoard without copying Firebase, push, camera/location, signing, store upload, or Capgo configuration.
- [ ] Add automated config checks: LC bundle ID/profile agreement, no dev server URL or client secret, only approved capabilities, unique build number, and upload disabled without approval.
- [x] Run `npm ci`, full tests, lint, build, Capacitor sync, Android Java 21 debug compilation, and iOS simulator compilation. The signed archive/export part remains unstarted.

**Exit:** partially met. Reproducible unsigned Android and iOS simulator builds exist with LC identity and no unauthorized store upload. Signed archive/export remains.

### M2 — Safe native auth and TestFlight usability proof

**Files:** modify `src/pages/Callback.tsx`, `src/api/concept2.ts`, `src/App.tsx`, `src/components/Layout.tsx` and native URL/capability configuration as required; reuse publishing P1 server auth work rather than duplicate it. Proposed focused return handler/tests: `src/services/nativeAuth.ts` and `src/services/nativeAuth.test.ts`.

- [ ] Settle return strategy and operator-approved provider/Supabase registrations. Write failing tests for wrong state, replay, malicious return URL, logout, cold/warm return and environment mismatch.
- [ ] Implement narrow native browser/link handling and session restoration; make only measured responsive/navigation fixes. Verify web callback behavior is unchanged and production assets contain no confidential OAuth configuration.
- [ ] Obtain explicit TestFlight upload approval for the verified binary. Record workflow run, commit, app/build identity, tester/device/iOS version and results in the release runbook; never include credentials.
- [ ] Execute the authentication and UX matrix above on a physical iPhone through TestFlight, including offline/error states. Fix blockers and repeat affected checks before marking the foundation's auth slice complete.

**Exit:** real TestFlight installation with working auth/navigation. Archive success alone does not satisfy this task; publishing itself need not be implemented/enabled.

### M3 — LC-owned OTA delivery and rollback proof

**Files:** create `updates/build-manifest.ts`, `updates/vercel.json`, `updates/vite.config.ts`, an updater endpoint under `updates/api/`, and `src/services/mobileUpdates.ts` with focused tests; modify shell config/App initialization and release runbook. Public trust configuration may be committed; private signing material may not.

- [ ] Adapt ScheduleBoard bundle/endpoint pattern. Define test/production separation and native compatibility enforcement; choose and prove the actual plugin verification path before enabling offers.
- [ ] Write failing endpoint/client tests for bad signature/hash, missing signature, wrong channel/native version, stale/replayed release, mutable URL mismatch and unsaved-work deferral. Configure signing to fail closed and keep the known-good fallback.
- [ ] Implement immutable signed release promotion and app-ready/failure behavior. Use approved LC Vercel resources only; do not repoint ScheduleBoard's service. Test the emitted updater response as well as the manifest.
- [ ] On test devices, prove good OTA, tampered/incompatible rejection, interrupted download, boot failure/missing-ready rollback, offline launch, retained session/data, and recovery of an already-updated device. Exercise the operator halt/restore procedure and cache handling.
- [ ] Record native build + installed web bundle + resulting fallback identities and evidence. Enable production offers only after operator approval and passing policy/security/compatibility checks; keep public store release separately gated.

**Exit:** reproducible LC OTA install and failure rollback on a physical device, not merely hosted ZIP/signature files.

## Acceptance and unresolved gates

- [ ] LC identity/team/app record/profile and approved operator documented; real signing and TestFlight results recorded.
- [ ] Workflow defaults to archive-only and secrets/artifacts are handled safely; no ScheduleBoard identity or Appflow remains in LC delivery paths.
- [ ] Safe native/web auth, cold/warm returns, logout/restoration and core screen UX pass on a TestFlight iPhone.
- [ ] Installed-binary compatibility and channel isolation are enforced, not just described by metadata.
- [ ] Signed OTA succeeds; tampering, incompatible native version and failed-ready update fail safely; rollback preserves data and is operator-reproducible.
- [ ] Current Apple policy/disclosure requirements reviewed; public release requires separate approval.

Open until implementation/operator evidence: Apple account permissions/agreements, final LC identifiers and domains, current tool/plugin compatibility, signing/trust-key ownership and rotation, native secure token storage/return strategy, tested app-ready timing, and actual OTA verification enforcement. None is inferred from ScheduleBoard's success.

[Back to resumption guide](README.md) · [Publishing track](publishing.md) · [Roadmap](../logbook-concept2-mobile-roadmap.md)
