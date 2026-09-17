# Completed interval fixtures

These are synthetic, server-owned completed results for device-free mapping and Concept2 Online Validator checks. They are not PM5 captures and their UUIDs are not persisted LC workout IDs. Nothing in the development UI or Edge Function can publish them directly.

Render a payload from the shared mapper with:

```bash
node scripts/render_concept2_fixture.mjs fixed_distance_intervals_2x500m
```

Other names: `fixed_time_intervals_3x120s`, `variable_intervals_mixed`. The output has explicit private visibility, heavyweight class, and no verification claim. Before any development POST, a fixture must be bound to a new owned durable LC test workout and pass through the existing fenced publication state machine. The returned Concept2 result ID must then be read back and linked to that actual LC UUID.

The `CompletedWorkoutV2` contract retains slots for a lossless source-evidence reference and normalized samples. These fixtures deliberately have no PM5 telemetry. Capture storage, sample integrity checks and `stroke_data` projection still require real device evidence.
