# Concept2 interval validator inputs

Copy one complete JSON block at a time into the [Concept2 Online Validator](https://log.concept2.com/developers/validator) with **Use Strict Checking** enabled. Use the code-block copy button if your viewer provides one. Each payload is a single line generated from Logbook Companion's named fixtures and shared mapper. They are synthetic validation inputs, not persisted LC workouts or PM5 captures; do not POST them to the development or production API.

The space between date and time inside each `date` value is required. Each `timezone` value is `America/New_York` with no embedded whitespace.

## Fixed-distance intervals: 2 × 500 m

```json
{"type":"rower","date":"2026-09-17 12:00:00","timezone":"America/New_York","distance":1000,"time":2400,"workout_type":"FixedDistanceInterval","rest_distance":0,"rest_time":600,"workout":{"intervals":[{"type":"distance","distance":500,"time":1200,"rest_time":600},{"type":"distance","distance":500,"time":1200,"rest_time":0}]},"weight_class":"H","privacy":"private","comments":"Logbook Companion workout ID: 11111111-2222-4333-8444-555555555555"}
```

## Fixed-time intervals: 3 × 2:00

```json
{"type":"rower","date":"2026-09-17 13:00:00","timezone":"America/New_York","distance":1500,"time":3600,"workout_type":"FixedTimeInterval","rest_distance":0,"rest_time":900,"workout":{"intervals":[{"type":"time","distance":480,"time":1200,"rest_time":450},{"type":"time","distance":500,"time":1200,"rest_time":450},{"type":"time","distance":520,"time":1200,"rest_time":0}]},"weight_class":"H","privacy":"private","comments":"Logbook Companion workout ID: 22222222-3333-4444-8555-666666666666"}
```

## Variable intervals: mixed distance and time

```json
{"type":"rower","date":"2026-09-17 14:00:00","timezone":"America/New_York","distance":1200,"time":3000,"workout_type":"VariableInterval","rest_distance":40,"rest_time":450,"workout":{"intervals":[{"type":"distance","distance":500,"time":1200,"rest_time":300,"rest_distance":25},{"type":"time","distance":700,"time":1800,"rest_time":150,"rest_distance":15}]},"weight_class":"H","privacy":"private","comments":"Logbook Companion workout ID: 33333333-4444-4555-8666-777777777777"}
```
