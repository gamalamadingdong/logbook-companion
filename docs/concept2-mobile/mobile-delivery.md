# Mobile Delivery Specification and Status

**Goal:** Deliver the existing LC application through an independently releasable iOS/TestFlight foundation, then prove LC-owned self-hosted OTA installation and rollback.

**Architecture:** Wrap the existing Vite application with Capacitor, following ScheduleBoard's working GitHub Actions native pipeline and Capgo/Vercel update pattern. Native binary delivery and web-bundle delivery are distinct release paths with independent approval and rollback controls.

**Tech stack:** React/Vite/TypeScript, Capacitor, GitHub Actions Android/Java 21 and macOS/Xcode, App Store Connect/TestFlight, `@capgo/capacitor-updater`, self-hosted Vercel updates.

## 2026-09-21 implementation checkpoint

- Merged: Capacitor Android/iOS source projects, LC identity, Bluetooth permissions/privacy text, direct athlete `/pm5` flow, and published shared RWN/ErgLink dependencies.
- Proven in CI: full web tests/lint/build, unsigned Android debug APK compilation with Java 21, and unsigned iOS simulator compilation with CocoaPods/Xcode.
- Proven on a real PM5 through the shared browser harness: fixed-distance programming and initial variable-workout work/rest transitions.
- Proven in CI: signed iOS archive and IPA export for the staging mobile build. Not yet proven: installed LC app authentication/deep links, physical Android/iOS PM5 use, TestFlight/Play installation, or OTA delivery/rollback.

## Global constraints

- ADR-004 remains the direction: Capacitor, not React Native. LC now has Capacitor dependencies, Android/iOS projects, sync scripts, and unsigned native CI.
- GitHub Actions builds the binary; self-hosted Capgo/Vercel distributes compatible web bundles. **Do not reintroduce Appflow**, retired for cost.
- Android and iOS source scaffolding now advance together. Direct foreground PM5 programming and BLE permissions are implemented; background capture, force curves, capture ingestion, and automatic publishing remain out of scope.
- LC owns bundle ID, app record, profiles, endpoint and release configuration. Do not copy ScheduleBoard secrets or identity, Firebase, push, SQLite, camera/location permissions, mixed-content settings or unrelated plugins.
- Apple account actions, signing provisioning, uploads, hosted deployment and public release require operator authorization. A documentation PR authorizes none of them.
- TestFlight archive work does not require Concept2 write approval. Safe Concept2 OAuth remains required for the completed mobile foundation; reuse the server auth prerequisite in [publishing P1](publishing.md), not the publishing service itself.

## Development-first native auth implementation

2026-09-22: implementation is present in the current branch, not deployed or proven on an installed device. The first beta uses Concept2 development, not production.

- `mobile:build` / `mobile:sync` explicitly use Vite's `mobile` mode. Inherited production metadata cannot select the legacy production callback/API modules or bundle their credentials. The production-only callback is isolated in `LegacyConcept2Callback.tsx`; its eventual server-auth replacement remains a promotion gate.
- Supabase sessions and PKCE verifiers use `@aparajita/capacitor-secure-storage` on native platforms (device-local Keychain/Keystore, no iCloud synchronization and no plaintext fallback). Previously stored WebView sessions are not migrated: beta users sign in again. Browser storage behavior is unchanged.
- `/auth/callback` explicitly owns Supabase code exchange, with automatic URL detection disabled there and on native. StrictMode effect replay reuses the in-flight exchange. Native signup/recovery returns use `logbookcompanion://app/auth/callback`.
- Native Concept2 launch uses `@capacitor/browser`, retaining the initiating LC owner, opaque development state, and ten-minute expiry in secure storage before opening the browser.
- Concept2 still redirects to the configured HTTPS `<C2_DEVELOPMENT_ORIGIN>/callback`. The web page offers **Return to Logbook Companion**, forwarding only its single-use authorization code and opaque state to the fixed `logbookcompanion://app/callback` route. The external browser does not need the app's Supabase session and never receives provider access/refresh tokens from LC.
- The app validates the pending owner/state/expiry and consumes its local attempt before authenticated server exchange. The existing service-role-only RPC independently consumes the hashed user-bound state and fences credential rotation; no schema change is required. Uncertain exchange outcomes are not automatically retried.
- Closing the browser is not assumed to cancel an authorization: dismissal can race a valid deep link. Pending state remains bounded by expiry, explicit denial/logout, or replacement by a new attempt.
- Native lifecycle events control Supabase auto-refresh. Logout clears the local pending flow/session without disconnecting the server-owned Concept2 account. Native URL logging no longer prints callback queries; token-in-URL/legacy SSO bootstrap handoffs are rejected on native.

### Operator rollout order

1. Review and deploy the web callback from this branch to the existing development site. Do not promote to production yet.
2. With separate approval, deploy `concept2-development-auth` and its complete shared dependencies through Supabase MCP, retaining `verify_jwt=true` and in-handler user verification.
3. Enable the new server configuration `C2_DEVELOPMENT_NATIVE_ENABLED=true` only for the reviewed development function rollout. Default is disabled. Existing development origin/client ID/client secret remain server-owned and unchanged; callers cannot override them. Native CORS accepts only `http://localhost` (current Android configuration) and `capacitor://localhost` (iOS), not arbitrary origins or localhost ports.
4. Confirm the existing Concept2 development HTTPS callback and add the exact native Supabase callback to the Auth redirect allowlist under operator approval. Validate signup/recovery return queries against the actual allowlist and email templates; this branch does not edit them.
5. Build a new binary with the Browser and Secure Storage plugins. An OTA bundle cannot add them to an old shell. Install and execute the native authentication matrix below.
6. Record cold/warm returns, canceled consent, browser dismissal, replay/expired/wrong-user returns, sign-out/relaunch, offline launch, and iOS/Android secure-storage behavior. Production write approval, PM5 evidence, signing, and public release remain independent.

Live inspection used `Supabase-execute_sql` for `c2_development_auth`, `user_integrations`, and `c2_development_auth_operation`; relevant generated columns/RPC arguments align. Both tables have RLS enabled, development credentials have no client policies, and the operation RPC is service-role-only. `Supabase-list_edge_functions` confirmed the existing development function uses JWT verification. No credential rows, live writes, schema changes, secret changes, or deployments were performed.

Local evidence includes focused auth tests, full web regression checks, Edge Function type-checking, and a mobile build with synthetic production credential sentinels that excludes those credentials and production auth endpoints. Both native projects synchronize the plugins. Installed-device behavior remains unproven; iOS compilation requires the macOS toolchain.

Local verification on 2026-09-22:

| Check | Outcome |
| --- | --- |
| Focused native storage/return/navigation/config + development auth tests | 83 passed |
| `npm run lint -- --quiet`, `npm run build`, `npm run test:run -- --reporter=dot` | Passed; 643 tests across 62 files; existing lint/chunk warnings remain |
| `deno check supabase/functions/concept2-development-auth/index.ts` | Passed |
| Production-metadata web build, followed by `mobile:build` with synthetic credentials | Legacy modules retained for web; excluded from mobile |
| `python -X utf8 scripts/check_c2_staging_bundle.py` after mobile build | Passed; explicit UTF-8 mode needed on this Windows host |
| `npx cap sync android`, `npx cap sync ios` | Plugin wiring updated; Windows cannot run CocoaPods/Xcode |
| Android `assembleDebug`, Java 21, existing SDK passed via process-local `ANDROID_HOME` | Passed; no permanent environment change |
| Browser callback UI at 320 px, using synthetic code/state and denied consent | Fixed app return and visible error recovery; query cleared; no horizontal overflow; 44 px actions |
| Operator authentication in a phone-sized web-browser viewport | User reported success on 2026-09-22; this does not exercise an installed native app |

The automated checks did not send a real OAuth request, publish a workout, install an app, or prove Keychain/Keystore behavior on a device. The operator's browser smoke is separate evidence, not native authentication proof.

### Promotion is not a URL-only change

Promote the reviewed code, not development tokens or synthetic results. Before a production release, replace the legacy production auth selection with the server-owned path, provision production-only provider credentials/callbacks, define production data isolation, and obtain fresh athlete OAuth consent. Keep production publishing disabled until Concept2 approval and a controlled production smoke. Do not point production builds at development credential/result tables.

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

### Archive-only pipeline checkpoint (2026-09-22)

The operator registered `org.readyall.logbookcompanion` and its App Store Connect record, generated a new team distribution certificate/P12 and LC-specific distribution profile, and added the seven `APPLE_*` repository secret names. The final archive run proved those signing inputs without exposing their values.

Both native source projects and Capacitor now use that registered identifier. Existing debug installs with the earlier `com.readyall.logbookcompanion` identifier are a different app; no local-data migration is implied. The `logbookcompanion://app/...` auth scheme is unchanged. Remove an older debug install before native-return testing so two installed apps do not compete for that scheme; uninstalling remains an explicit operator action.

`.github/workflows/ios-beta-archive.yml` is a manual, archive-only recipe:

- Activate the recipe and its two `.github/scripts/` helpers on default branch `main` with a **CI-only change**, not a merge of staging's application code. Keep the same files in staging for traceability.
- Dispatch the workflow on `main`. It preserves the reviewed signing helper, then explicitly checks out **staging** for the application build. Source SHA and recipe SHA are recorded separately.
- The job reads the existing GitHub **Production** environment's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables. That label does not select a production application/provider. The app is built with `mobile:build`, so Concept2 remains development-only.
- The source must already contain the reviewed native-auth slice and registered bundle ID. Missing configuration, a service-role client key, or an identity mismatch fails before loading private signing material.
- Only the four signing secrets are referenced. Upload API secrets are deliberately unused; there is no upload command or push/tag trigger.
- Signing happens in a temporary keychain. The helper requires the correct LC app/team, an unexpired iOS App Store profile (not debug/ad hoc/enterprise), and exactly one matching valid imported signing identity.
- The native build number is the UTC Unix timestamp assigned to this serialized run, avoiding source-file counter edits and giving reruns a fresh number. The source marketing version is retained.
- Export uses `app-store-connect` with destination `export`. Artifacts contain only the IPA and build metadata, retained for seven days; no private signing files are uploaded. Cleanup attempts every named signing file even if keychain removal fails and reports failures.

The existing GitHub Production environment has **no required reviewers or branch restrictions**; it is not an approval gate. This first recipe therefore cannot upload. TestFlight upload needs a separately reviewed/authorized follow-up after the archive is validated. Existing Vercel staging/main routing and ScheduleBoard signing secrets are untouched. A CI-only commit on main may cause Vercel to rebuild the same production app code, but does not promote staging features.

The operator's key material stays outside Git. Do not copy ScheduleBoard's app-specific profile into LC, and do not revoke or replace ScheduleBoard's working inputs before replacement signing is proven.

First archive run: [35778061551](https://github.com/gamalamadingdong/logbook-companion/actions/runs/35778061551). App checks, CocoaPods sync, certificate/password import, profile identity/expiry/certificate matching, and cleanup passed. Xcode archive failed because global command-line signing settings were inherited by Pods and the profile was installed in the pre-Xcode-16 directory. No IPA was produced or uploaded.

The correction restores ScheduleBoard's proven Podfile rule (`CODE_SIGNING_ALLOWED=NO` for Pods), configures manual signing only on the App target's Release configuration through CocoaPods' `xcodeproj` editor, uses the validated profile name, and installs/cleans the profile under `~/Library/Developer/Xcode/UserData/Provisioning Profiles` for Xcode 26. It does not enable automatic provisioning or change signing credentials.

Second archive run: [35782509101](https://github.com/gamalamadingdong/logbook-companion/actions/runs/35782509101). Target-scoped signing worked and Xcode successfully created the signed archive. Export then failed because `ExportOptions.plist` still mapped the app to the profile UUID. The final correction maps `provisioningProfiles` to the exact validated profile name, matching the working App-target setting and current manual-export examples. No signing material changed.

Final archive run: [35784015794](https://github.com/gamalamadingdong/logbook-companion/actions/runs/35784015794) passed every step. It built staging commit `e32584bff0fdc77002cf5055e5afdbd42c7b97ab`, signed and exported `org.readyall.logbookcompanion` version `1.0`, build `1790110903`, verified the archive signature plus archive/IPA identity and bundled Capacitor configuration, uploaded the IPA and provenance JSON as the seven-day artifact `lc-ios-staging-e32584bff0fdc77002cf5055e5afdbd42c7b97ab-35784015794-1`, and removed temporary signing material. Metadata records `concept2Environment=development` and `uploaded=false`; no TestFlight upload or staging-to-main application promotion occurred.

### Manual TestFlight upload

The separate **iOS TestFlight Upload** workflow runs only when manually dispatched on `main` with `archive_run_id`, the exact `expected_build`, and `confirm_upload=true`. It does not rebuild the app or modify its signature.

The helper requires a successful manual `iOS Beta Archive` run from this repository's main branch, checks the downloaded artifact's GitHub SHA-256 digest, verifies staging/development provenance, and compares the IPA's bundle/version/configuration to that provenance. Only then does the job load the three App Store Connect upload secrets. A temporary private-key file is used for Apple's validation and one upload call, then removed by both an exit trap and an always-run cleanup step.

For later builds: manually archive staging, review its artifact/build metadata, then explicitly dispatch the upload workflow with those identifiers. Uploads are serialized and not retried automatically. If an upload response is uncertain, check App Store Connect before rerunning; the same build may already be accepted. GitHub's Production environment is the configuration source, not a protected approval gate.

This uploads to App Store Connect for TestFlight processing; it does not select testers, declare export compliance, submit public App Review, release the app, promote staging to main, or deploy Supabase. The operator handles Apple processing/tester setup. The development native-auth function rollout, native-origin enablement, Supabase redirect registration, and installed-device testing remain separate prerequisites for full native Concept2 sign-in.

- [ ] **Owner/team:** Sam confirms active membership, authorized release operator, team access/agreements, display name and unique reverse-domain LC bundle ID. Record non-secret identifiers and approval, not passwords or private key material.
- [ ] **App ID:** operator registers an explicit identifier in Certificates, Identifiers & Profiles with only needed capabilities. Assess actual login offerings against Sign in with Apple requirements. No speculative Bluetooth/background/camera/location capabilities.
- [ ] **App record:** operator creates iOS app in App Store Connect, selecting that bundle ID, name, language, unique SKU and team access; record Apple app ID. Resolve agreement/access blockers before uploads.
- [ ] **Native identity:** implementer sets matching bundle ID/team, icons/launch assets, deployment target and marketing version/build-number policy in Capacitor/Xcode. Choose monotonically increasing build numbers that stay unique across reruns/release branches; record commit → native build mapping.
- [ ] **Signing profile:** authorized operator supplies distribution certificate and App Store provisioning profile matching LC app ID/team/capabilities. Use an approved existing certificate only if explicitly authorized; never reuse ScheduleBoard's app-specific profile.
- [ ] **CI inputs:** provision approved GitHub environment secrets: `APPLE_CERTIFICATE_P12` (base64), `APPLE_CERTIFICATE_PASSWORD` (plain), `APPLE_PROVISIONING_PROFILE` (base64), `APPLE_TEAM_ID` (identifier), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER_ID` (identifiers), `APPLE_API_KEY_P8` (base64). Confirm API role/app access needed for upload. Names/encodings are conventions, not evidence credentials exist.
- [ ] **Secret hygiene:** ephemeral signing keychain and temporary files, masked logs, least-privilege workflow permissions, protected release environment, cleanup on failure/cancellation and bounded artifact access. Do not commit `.p8`, `.p12`, provisioning profiles or update signing keys; do not echo them in logs. Record renewal/revocation owner and expiry reminder without values.
- [x] **Archive first:** archive/export passed in run `35784015794`; bundle ID, version/build, signature, IPA identity, runtime configuration and provenance were checked. Linux can build/test web code but cannot perform Xcode archive/signing; use the macOS runner.
- [ ] **TestFlight permission:** obtain separate upload approval, upload exact verified artifact, complete processing/export compliance as required, configure internal testers and install on an iPhone. External testers may require Beta App Review.
- [ ] **Public submission later:** screenshots, description, support/privacy URLs, privacy disclosures including analytics/OTA behavior, age rating, review access and account deletion where required. Confirm current [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), including downloaded-code restrictions. Public App Store submission/release is not an automatic merge/tag side effect.

## Native authentication and UX contract

Use system-browser OAuth with an LC-owned allowlisted HTTPS server callback, then an approved native return strategy (universal link preferred if LC domain association is available; registered custom scheme is an alternative requiring explicit review). The selected scheme/domain, entitlements, Supabase redirect allowlist, Concept2 registered callback and return route must be recorded together before configuration. Do not invent a final bundle ID/domain here.

Bind OAuth state to the initiating user/session/environment; validate it server-side. Return only a short-lived one-time exchange reference, not client secrets or provider refresh tokens in a URL. Reject expired/replayed/mismatched returns and arbitrary redirect destinations. Review secure native session persistence and logout cleanup; do not assume browser localStorage behavior satisfies native token-security requirements. The legacy production-only callback and API still reference browser `VITE_CONCEPT2_CLIENT_SECRET`; the mobile build excludes those modules, but the production web cutover must remove that legacy behavior before promotion.

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

- [x] Close Apple ownership/app-record/signing decisions and record them in the delivery checkpoint. LC bundle/application identity and signing inputs are proven by archive/export run `35784015794`.
- [x] Add minimal Android/iOS shell dependencies and an unsigned native workflow adapted from ScheduleBoard without copying Firebase, push, camera/location, signing, store upload, or Capgo configuration.
- [ ] Add automated config checks: LC bundle ID/profile agreement, no dev server URL or client secret, only approved capabilities, unique build number, and upload disabled without approval.
- [x] Run `npm ci`, full tests, lint, build, Capacitor sync, Android Java 21 debug compilation, iOS simulator compilation, and signed iOS archive/export.

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

- [ ] LC identity/team/app record/profile and signed archive are documented; TestFlight installation results remain.
- [ ] Workflow defaults to archive-only and secrets/artifacts are handled safely; no ScheduleBoard identity or Appflow remains in LC delivery paths.
- [ ] Safe native/web auth, cold/warm returns, logout/restoration and core screen UX pass on a TestFlight iPhone.
- [ ] Installed-binary compatibility and channel isolation are enforced, not just described by metadata.
- [ ] Signed OTA succeeds; tampering, incompatible native version and failed-ready update fail safely; rollback preserves data and is operator-reproducible.
- [ ] Current Apple policy/disclosure requirements reviewed; public release requires separate approval.

Open until implementation/operator evidence: Apple account permissions/agreements, final LC identifiers and domains, current tool/plugin compatibility, signing/trust-key ownership and rotation, native secure token storage/return strategy, tested app-ready timing, and actual OTA verification enforcement. None is inferred from ScheduleBoard's success.

[Back to resumption guide](README.md) · [Publishing track](publishing.md) · [Roadmap](../logbook-concept2-mobile-roadmap.md)
