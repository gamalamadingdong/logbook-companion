# LC → RWN → PM5 programming boundary

Status: direct athlete programming is implemented in LC and compiles for Android and iOS. The shared browser/PM5 path has real fixed-distance and variable-interval programming evidence; physical Android/iOS LC installation and PM5 proof remain.

## Existing capabilities to reuse

1. LC parses RWN into `WorkoutStructure`.
2. Published `@readyall/rwn@0.2.1` translates supported structures into a PM5 workout with `exact`, `prompt_only`, or `unsupported` outcomes.
3. Published `@readyall/erglink@0.2.0` owns the monitor-driver contract, audited PM5 CSAFE core, command-aware 20-byte packetization, response parsing, capture accumulator, and Capacitor driver.
4. LC owns the athlete `/pm5` flow, Bluetooth permissions, device selection, RWN confirmation, and programming receipt display. Capture persistence/LC ingestion remains separate.

`src/utils/ergLinkAdapter.ts` predates the reviewed translation path and contains overlapping defaults. It is not the missing service. Do not add a third conversion path; retire or route it through `translateWorkoutToPm5`.

## Service boundary

The boundary is a mobile programming coordinator, not a remote ErgLink network service:

```text
LC plan/template/RWN
        ↓
WorkoutStructure
        ↓
translateWorkoutToPm5
        ↓
ActiveWorkoutSpec + exact/prompt-only/unsupported
        ↓
mobile PM5 programming coordinator
        ↓
CSAFE frames → GATT RX → GATT TX acknowledgement
```

The coordinator must:

- assign one programming request ID and retain the source RWN/template/assignment identity;
- refuse `unsupported` translations and require explicit confirmation for `prompt_only` translations;
- verify connected PM5 model/firmware and advertised GATT capabilities;
- choose the transport operation from actual characteristic properties;
- retain the documented 20-byte PM control-value limit and packetize only at complete CSAFE command boundaries;
- subscribe/read the response path before dispatch so a response cannot be missed;
- parse PM5 `ok`, `reject`, `bad`, and `not_ready` outcomes;
- report accepted configuration separately from workout start and completed capture;
- remain independent of Concept2 Logbook OAuth and publication.

## Implemented checkpoint

- The shared RWN package owns PM5 translation; LC no longer owns a competing implementation.
- The shared ErgLink package owns the device-family contract plus PM5 protocol and Capacitor driver; LC does not copy CSAFE or BLE implementation details.
- LC exposes a protected **Connect PM5** route for local discovery, connection, diagnostics, live metrics, RWN programming, and disconnect.
- Exact workouts dispatch directly, prompt-only workouts require inline confirmation, unsupported or partially parsed variable workouts fail closed, and no coach session or Supabase programming relay is required.
- The Android and iOS Capacitor projects include Bluetooth permission/privacy configuration.
- GitHub Actions proves the web gates, an unsigned Android debug build on Java 21, and an unsigned iOS simulator build with CocoaPods/Xcode.
- The merged coach-session relay remains available for boathouse/group operation, but it is secondary rather than the primary athlete experience.
- Every request carries a stable request ID, timestamp, original RWN, lowering mode, and notes.
- ErgLink deduplicates request IDs, serializes programming, converts variable-workout rest steps into PM5 work/rest commands, and writes received/final receipts into participant data.
- LC displays each participant's latest PM5 programming status.
- Both BLE transports serialize CSAFE exchanges and select read versus notify from actual GATT capabilities.
- The real browser/PM5 path successfully programmed 2,000 m, then a speed pyramid whose first 250 m, 1:30 rest, and next 500 m transition were exercised, then 2,000 m again.

Still required: install the LC build on physical Android/iOS hardware, prove installed-app authentication/deep links, exercise the supported programming matrix and rejection/not-ready/reconnect paths through LC, and then connect completed capture persistence to LC ingestion.

## Result contract

The eventual result should distinguish at least:

- `accepted`: PM5 acknowledged the complete configuration;
- `prompt_only`: PM5 received the native portion; athlete/coach prompts remain;
- `unsupported`: translation or PM5 capabilities cannot represent the request;
- `rejected`: PM5 explicitly rejected a frame;
- `not_ready`: PM5 state does not allow programming yet;
- `transport_error`: BLE disconnected, timed out, or returned malformed evidence.

Keep request, frame/response evidence, and capture identity separate. Programming proves intended configuration; the completed PM5 capture proves what actually happened.

## First hardware matrix

Use direct PM5 results as the comparison baseline, then program through the service:

1. 100 m fixed distance;
2. 0:30 fixed time;
3. fixed-distance intervals with timed rest;
4. fixed-time intervals with timed rest;
5. variable distance/time intervals;
6. one unsupported or prompt-only RWN extension;
7. rejection/not-ready behavior;
8. disconnect between frames and retry without duplicate programming.

For each accepted workout, compare PM5 screen configuration, split/interval notifications, paired end summaries, and the resulting `PM5CompletedCaptureV1`.

## Exit gate

The service is ready for LC mobile only when one request can be traced from source RWN through translation, local PM5 acknowledgement, actual completed capture, and LC-owned workout acknowledgement without a coach session, invented measurements, or lost source identity.
