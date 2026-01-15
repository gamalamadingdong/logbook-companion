# Concept2 Workout Schema Reference

## Top Level Fields

| Name | Required | Type | Description | Example |
|------|----------|------|-------------|---------|
| **type** | Yes | string | Machine type. Must be one of: `rower`, `skierg`, `bike`, `dynamic`, `slides`, `paddle`, `water`, `snow`, `rollerski`, `multierg`. | `rower` |
| **date** | Yes | datetime | End of workout date/time (yyyy-mm-dd hh:mm:ss). | `2015-05-01 14:32:12` |
| **timezone** | No | string | TZ database format. | `America/New_York` |
| **distance** | Yes | integer | Work distance in meters. (Excludes rest). | `5000` |
| **time** | Yes | integer | Work time in tenths of a second (deciseconds). | `1200` (2 mins) |
| **weight_class** | Depends | string | `H` (Heavyweight) or `L` (Lightweight). Required for rower/dynamic/slides. | `H` |
| **comments** | No | string | User comments/notes. | |
| **privacy** | No | string | `private`, `partners`, `logged_in`, `everyone`. | `partners` |
| **workout_type** | No | string | Structure of workout. Must be one of: `unknown`, `JustRow`, `FixedDistanceSplits`, `FixedTimeSplits`, `FixedCalorie`, `FixedWattMinute`, `FixedTimeInterval`, `FixedDistanceInterval`, `FixedCalorieInterval`, `FixedWattMinuteInterval`, `VariableInterval`, `VariableIntervalUndefinedRest`. | `FixedDistanceSplits` |
| **stroke_rate** | No | integer | Average SPM. | `36` |
| **heart_rate** | No | object | `{ average, min, max, ending, recovery }` | |
| **stroke_count** | No | integer | Total strokes in workout. | `236` |
| **calories_total** | No | integer | Total calories. | `436` |
| **wattminutes_total** | No | integer | Total watt-minutes. | `878` |
| **drag_factor** | No | integer | Average drag factor. | `115` |
| **rest_distance** | Depends | integer | Total rest distance (meters). | `335` |
| **rest_time** | Depends | integer | Total rest time (deciseconds). | `600` |
| **verified** | Optional | boolean | Verified by trusted client. | `false` |
| **verification_code** | Optional | string | Verification code string. | |
| **workout** | No | array | Array of objects containing split or interval data. See [Split/Interval Workouts](#splitinterval-workouts). | |
| **stroke_data** | No | array | Array of objects containing stroke data. See [Strokes](#strokes). | |
| **metadata** | No | object | Meta data object. See [Metadata](#metadata). | |
| **targets** | No | object | Workout targets. See [Targets](#targets). | |

## Split/Interval Workouts

Splits and intervals are an array of objects in the `workout` field.

| Name | Required | Type | Description | Example |
|------|----------|------|-------------|---------|
| **distance** | Yes | integer | Work distance in meters. (Excludes rest). | `5000` |
| **time** | Yes | integer | Work time in tenths of a second (deciseconds). | `1200` |
| **stroke_rate** | No | integer | Average stroke rate. | `34` |
| **calories_total** | No | integer | Total calories. | `26` |
| **wattminutes_total** | No | integer | Total Watt-Minutes. | `120` |
| **heart_rate** | No | object | `{ average, min, max, ending, rest, recovery }` | |
| **type** | Yes | string | Interval type. One of: `time`, `distance`, `calorie`, `wattminute`. | `time` |
| **rest_time** | Yes | integer | Rest time in tenths of a second. | `300` |
| **rest_distance** | No | integer | Rest distance in meters (Variable intervals only). | `50` |
| **machine** | No | string | Machine type override for MultiErg. | `rower` |

## Targets

Targets can be at the workout level (fixed pieces) or interval level (variable intervals).

| Name | Required | Type | Description | Example |
|------|----------|------|-------------|---------|
| **stroke_rate** | No | integer | stroke_rate (0-255). | `30` |
| **heart_rate_zone** | No | integer | Zone (0-5). | `4` |
| **pace** | No | integer | Target Pace in deciseconds per 500m (or 1000m for Bike). | `1020` |
| **watts** | No | integer | Target Watts (0-999). | `400` |
| **calories** | No | integer | Target Calories (0-9999). | `1300` |

*Note: Only one of watts, calories, or pace can be present.*

## Strokes

Strokes are an array of objects in `stroke_data`.

| Name | Required | Type | Description | Example |
|------|----------|------|-------------|---------|
| **t** | No | integer | Time in deciseconds (e.g. 23 = 2.3s). | `23` |
| **d** | No | integer | Distance in decimeters (e.g. 155 = 15.5m). | `155` |
| **p** | No | integer | Pace in deciseconds/500m (or /1000m for Bike). | `971` |
| **spm** | No | integer | Strokes Per Minute. | `35` |
| **hr** | No | integer | Heart Rate. | `156` |

*Note: Time and distance are incremental for each stroke, starting at 0 for each interval.*

## Metadata

Can be sent as headers or body.

| Name | Description | Example |
|------|-------------|---------|
| **client_version** | Client version. | `1.2.34` |
| **pm_version** | PM version (3, 4, 5). | `5` |
| **firmware_version** | Firmware version. | `707` |
| **serial_number** | Monitor serial number. | `430395351` |
| **device** | Device name. | `iPhone 6` |
| **device_os** | OS. | `iOS` |
| **device_os_version** | OS Version. | `8.3` |
| **erg_model_type** | 0=D/E/Row/Dyn, 1=C/B, 2=A. | `1` |
| **hr_type** | BT, ANT, Apple. | `Apple` |
| **other** | Custom logging info (e.g. USB). | `USB` |