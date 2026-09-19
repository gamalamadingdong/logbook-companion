# LC → RWN → PM5 programming boundary

Status: next implementation slice after the PM5 connectivity/capture checkpoint.

## Existing capabilities to reuse

1. LC parses RWN into `WorkoutStructure`.
2. `src/utils/rwnPm5Lowering.ts` lowers supported structures into `ActiveWorkoutSpec` with `exact`, `prompt_only`, or `unsupported` outcomes.
3. ErgLink's audited CSAFE core builds validated PM5 commands, applies byte stuffing/checksums, inspects GATT capabilities, and parses PM5 acceptance/rejection responses.
4. The mobile PM5 connection already owns BLE permissions, device selection, notifications, and capture lifecycle.

`src/utils/ergLinkAdapter.ts` predates the reviewed lowering path and contains overlapping defaults. It is not the missing service. Do not add a third conversion path; retire or route it through `lowerWorkoutStructureToPm5` when implementation begins.

## Missing service

The missing boundary is a mobile programming coordinator, not a remote ErgLink network service:

```text
LC plan/template/RWN
        ↓
WorkoutStructure
        ↓
lowerWorkoutStructureToPm5
        ↓
ActiveWorkoutSpec + exact/prompt-only/unsupported
        ↓
mobile PM5 programming coordinator
        ↓
CSAFE frames → GATT RX → GATT TX acknowledgement
```

The coordinator must:

- assign one programming request ID and retain the source RWN/template/assignment identity;
- refuse `unsupported` lowerings and require explicit confirmation for `prompt_only` lowerings;
- verify connected PM5 model/firmware and advertised GATT capabilities;
- choose the transport operation from actual characteristic properties;
- send only a reviewed frame strategy, including values larger than the legacy 20-byte documentation limit;
- subscribe/read the response path before dispatch so a response cannot be missed;
- parse PM5 `ok`, `reject`, `bad`, and `not_ready` outcomes;
- report accepted configuration separately from workout start and completed capture;
- remain independent of Concept2 Logbook OAuth and publication.

## Result contract

The eventual result should distinguish at least:

- `accepted`: PM5 acknowledged the complete configuration;
- `prompt_only`: PM5 received the native portion; athlete/coach prompts remain;
- `unsupported`: lowering or PM5 capabilities cannot represent the request;
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

The service is ready for LC mobile only when one request can be traced from source RWN through lowering, PM5 acknowledgement, actual completed capture, and LC-owned workout acknowledgement without inventing measurements or losing source identity.
