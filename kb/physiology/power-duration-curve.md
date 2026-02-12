# Power-Duration Curve & Power Profile for Indoor Rowing

## What Is a Power-Duration Curve?

A **power-duration curve** (also called a mean maximal power curve) plots the maximum average power (watts) an athlete can sustain across a range of effort durations or distances. In rowing, this is most intuitive when anchored to **standard erg distances** — 500m through marathon.

The curve always slopes downward: you can produce far more watts for 500m than for a half marathon. The *shape* of the slope reveals the athlete's physiological strengths and weaknesses.

### Not the Same as a Force Curve

There are two things called "power curve" in rowing:

1. **Force curve (intra-stroke)** — The shape of force application *within a single stroke*, displayed on the PM5 monitor. Shows the bell/parabola pattern of force from catch to finish. Requires raw force data from the flywheel (available via BLE connection or ErgData, but NOT from the C2 Logbook API).

2. **Power-duration curve (across workouts)** — Your best sustainable watts at every distance/duration. This is what we build from C2 Logbook data and is the focus of this document.

## The C2 Pace-Watts Relationship

Concept2 uses a cubic relationship between pace and power:

```
watts = 2.80 / pace³
pace = ³√(2.80 / watts)
```

Where `pace` is time in seconds per meter (i.e., split_seconds / 500).

**Example**: A 2:05/500m split = 125 seconds / 500 meters = 0.25 pace → watts = 2.80 / 0.25³ = 179.2W

This is a standard formula published by Concept2. The constant 2.80 accounts for the flywheel and damper physics of the C2 erg.

**Key insight**: Because of the cubic relationship, small pace improvements yield large watts improvements. Going from 2:00 to 1:58/500m is a much larger watts jump than going from 2:10 to 2:08.

Source: [Concept2 Watts Calculator](https://www.concept2.com/indoor-rowers/training/calculators/watts-calculator)

## Standard Tests & Distances

The power profile uses a mix of **time-based** and **distance-based** standard tests. Both are core to erg culture.

| Point | Test | Type | Duration/Distance | Energy system |
|---|---|---|---|---|
| Max watts | Single stroke | Manual entry | ~1-2s | Neuromuscular peak (ATP-PC) |
| 1:00 | 1-minute test | Time | 60s (~300-400m) | Anaerobic power |
| 500m | 500m test | Distance | ~1:20–2:00 | Anaerobic capacity |
| 1,000m | 1k test | Distance | ~3:00–4:00 | Anaerobic + VO2max |
| 2,000m | 2k test **(anchor)** | Distance | ~6:00–8:00 | VO2max |
| 5,000m | 5k test | Distance | ~17:00–22:00 | Threshold |
| 6,000m | 6k test | Distance | ~20:00–26:00 | Threshold endurance |
| 30:00 | 30-minute test | Time | 30min (~7500-8500m) | Aerobic power |
| 10,000m | 10k test | Distance | ~35:00–45:00 | Aerobic endurance |
| Half Marathon (21,097m) | HM test | Distance | ~1:15–1:45 | Aerobic base |
| Marathon (42,195m) | FM test | Distance | ~2:40–3:30 | Economy |

The 2k is the **universal anchor** in rowing. All training zones, benchmarks, and performance comparisons revolve around the 2k.

### Time-based tests

The **1-minute test** and **30-minute test** are standard C2 benchmarks with official rankings on the C2 logbook. They fill gaps that distance-based tests miss:
- 1:00 isolates pure anaerobic power (shorter than 500m, fully glycolytic)
- 30:00 isolates aerobic power at threshold (doesn't map cleanly to any single distance)

For charting, time-based tests are plotted at the distance actually covered (varies per athlete). This means their X-axis position shifts with fitness, which is correct — a faster athlete's 1-minute test point sits further right.

### Max watts

Max watts (peak single-stroke power) is the ceiling of the curve. However, it's rarely captured in a standard logged workout — most athletes learn their max watts from a few all-out strokes while watching the PM5 display, not from a formal piece.

**How we handle it:**
- **Manual entry** on the user profile (like the 2k baseline)
- **Suggested value**: Scan all stroke data and find the highest single-stroke watts. Present this as a suggestion: "We found 487W in your 2k on Jan 15 — is this close to your max?"
- **If not entered**: Start the curve at the 1-minute test. Don't fabricate the top anchor.

## Expected Power Ratios (2k-Relative Model)

For a physiologically balanced rower, power at each test follows predictable ratios relative to 2k watts. These ratios come from the underlying energy system contributions and are broadly consistent across ability levels:

| Test | Expected % of 2k watts | Range (variance) | Primary limiter |
|---|---|---|---|
| Max watts | 200–250% | ±20% | Neuromuscular recruitment, technique |
| 1:00 test | 145–160% | ±8% | Anaerobic power, glycolytic capacity |
| 500m | 130–140% | ±5% | Anaerobic capacity, creatine-phosphate |
| 1,000m | 115–120% | ±4% | Anaerobic capacity, lactate tolerance |
| 2,000m | 100% | (anchor) | VO2max, lactate threshold interaction |
| 5,000m | 80–85% | ±3% | Anaerobic threshold (lactate clearance) |
| 6,000m | 75–80% | ±3% | Threshold endurance |
| 30:00 test | 72–78% | ±3% | Aerobic power, lactate steady state |
| 10,000m | 70–75% | ±3% | Aerobic power, economy |
| Half Marathon | 65–70% | ±3% | Aerobic base, fat oxidation |
| Marathon | 60–65% | ±3% | Aerobic economy, fuel efficiency |

**Note on max watts**: The variance is much larger because max watts depends heavily on technique, body mass, and neuromuscular factors. Heavier athletes tend to have higher max watts relative to their 2k. The ratio is most useful for tracking individual changes over time rather than cross-athlete comparison.

**How to use these ratios**: If an athlete's actual ratio at a distance is significantly outside the expected range, it indicates a training gap or a strength.

### Example

Athlete with a 2k at 200W:
- 500m at 280W → 140% (top of expected range — strong sprinter)
- 6k at 130W → 65% (below expected 75–80% — aerobic deficit)
- **Interpretation**: Strong anaerobic system, weak aerobic base. Prescription: increase UT2 volume.

## Power Profile Types

Based on how an athlete's actual ratios compare to the expected model, they can be classified into profiles:

### Sprinter Profile
- **Pattern**: Short-distance ratios *above* expected, long-distance ratios *below* expected
- **Curve shape**: Steep dropoff — high peak power, rapid decline
- **What it means**: Well-developed anaerobic system (ATP-PC, glycolytic capacity) but aerobic base hasn't kept pace. The athlete performs relatively better in sprint events.
- **Typical cause**: Training biased toward high-intensity intervals without sufficient aerobic volume
- **Impact on 2k**: The 2k is limited by aerobic capacity. The athlete may have a strong first 500m but fades significantly in the back half.
- **Prescription**: Increase UT2/UT1 volume (60–90min steady state, 3-4x/week). Reduce intensity sessions temporarily to build floor.

### Diesel Profile
- **Pattern**: Long-distance ratios *above* expected, short-distance ratios *below* expected
- **Curve shape**: Flat — modest peak power, very gradual decline
- **What it means**: Strong aerobic engine but underdeveloped neuromuscular power and anaerobic capacity. The athlete is relatively stronger in long events.
- **Typical cause**: High-volume training without sprint or power work. Common in athletes who come from endurance backgrounds (running, cycling).
- **Impact on 2k**: The 2k is limited by peak power at the start and sprint finish. The athlete may negative-split races well but lose ground in the first 500m.
- **Prescription**: Add sprint intervals (8x500m, 10x30s all-out), power development (AN zone), and race-start practice. Maintain aerobic base.

### Threshold Gap
- **Pattern**: Sprint and endurance ratios within expected ranges, but mid-range distances (5k/6k) underperform
- **Curve shape**: Concave "dip" in the middle of the curve
- **What it means**: The athlete has both top-end power and a base, but their lactate clearance / threshold capacity is the weak link. They struggle to sustain efforts in the 15–25 minute range.
- **Typical cause**: Polarized training without enough threshold work. Sprint sessions and long steady state but missing the middle.
- **Impact on 2k**: Moderate — the 2k draws on VO2max which overlaps threshold. But 5k/6k tests will significantly underperform relative to 2k.
- **Prescription**: Add threshold intervals (4x2000m @ AT, 3x10min @ AT, 5k time trials). The AT zone (75–85% of 2k watts) is the target.

### Balanced Profile
- **Pattern**: All ratios within expected ranges
- **Curve shape**: Smooth, predictable decline following the model
- **What it means**: Well-rounded physiological development. No single system is the obvious limiter.
- **Prescription**: Target the weakest distance for the biggest marginal gain, or raise the whole curve through general fitness. Focus on the specific distance most relevant to upcoming racing.

## Data Sources for Building the Curve

### From the C2 Logbook API (via sync)

Each synced workout provides:

1. **Aggregate data**: Total distance, total time, average watts, average split — gives one point on the curve at whatever distance the workout covered.

2. **Per-interval data** (`workout.intervals[]`): Each interval has distance, time, watts, stroke_rate, heart_rate. A 4x2000m workout gives four data points at 2000m.

3. **Per-stroke data** (`strokes[]`): Stroke-by-stroke with cumulative time (`t` in deciseconds), cumulative distance (`d` in meters), power (`p` — either watts directly or pace in deciseconds/500m when >300), SPM (`spm`), heart rate (`hr`). This is the richest data and enables:
   - Extracting best-effort power at any sub-workout duration via sliding window
   - Confirming interval-level data
   - Finding "hidden" bests (e.g., your best 5-min power buried in a 30-min piece)

### Stroke Data Nuances

- **`p` field ambiguity**: The `p` field in stroke data is sometimes watts (when ≤300) and sometimes pace in deciseconds per 500m (when >300). Heuristic: `p > 300 → pace, convert with paceToWatts()`. This is already handled in `powerBucketing.ts`.

- **Stroke duration estimation**: Each stroke's duration is estimated as `60 / spm`. Combined with watts, this gives work (joules) per stroke.

- **Work vs rest discrimination**: During interval workouts, rest strokes are interspersed with work strokes. `getWorkStrokes()` filters these using interval boundaries. Critical for accurate power calculations.

- **Not all workouts have stroke data**: The `stroke_data` boolean on `C2ResultDetail` indicates availability. Older workouts or those done without ErgData may lack stroke-level data. For these, fall back to aggregate watts + total duration.

### Test vs Training Distinction

Not every workout represents a best effort. A 30-minute UT2 session is deliberately below max — it shouldn't define the athlete's 10k capability.

**Identifying tests/max efforts**:
- Standard distance pieces (standalone 2k, 5k, 6k, etc.)
- Known benchmark interval patterns (4x500m, 8x500m, 4x2000m, 5x1500m)
- Workouts where the training zone is AT or higher
- Significantly higher watts than other workouts at similar distances

**Two views**:
- **All efforts**: Complete picture including training. Shows the floor of performance.
- **Tests only**: Verified max efforts. Shows true capacity at each distance.
- The *gap* between these two views is itself informative — if training efforts are far below test efforts, the athlete could push harder in training (or the tests are outliers).

## Training Prescriptions by Profile

| Profile | Primary Zone to Target | Suggested Workouts | Weekly Emphasis |
|---|---|---|---|
| Sprinter | UT2 (aerobic base) | 60–90min steady state, 3x20min/3:00r | Add 2-3 UT2 sessions/week; reduce AN/TR temporarily |
| Diesel | AN/TR (top-end power) | 8x500m/3:00r, 10x1:00/1:00r all-out, race starts | Add 1-2 sprint sessions/week; maintain UT2 volume |
| Threshold Gap | AT (lactate clearance) | 4x2000m/3:00r, 3x10min/3:00r, 5k time trial | Add 1-2 AT sessions/week; maintain UT2 and occasional TR |
| Balanced | Weakest distance | Target workouts at the specific distance lagging most | Maintain distribution; focus on race-specific distances |

### Zone Pacing Reference

All training paces are derived from the 2k baseline:

| Zone | Relation to 2k | Watts % of 2k | Typical HR |
|---|---|---|---|
| UT2 | 2k split + 20–30s | 55–65% | 55–70% HRmax |
| UT1 | 2k split + 10–18s | 65–75% | 70–80% HRmax |
| AT | ~6k pace (2k + 0–10s) | 75–85% | 80–90% HRmax |
| TR | ~2k pace | 85–95% | 85–95% HRmax |
| AN | Faster than 2k | 95–105%+ | ~95–100% HRmax |

## Curve Interpretation Heuristics

### Curve Steepness
- **Steep curve** (>60% drop from 500m to HM): Anaerobic-dominant profile. Sprint capability outstrips endurance.
- **Flat curve** (<40% drop from 500m to HM): Aerobic-dominant profile. Great base, limited top-end.
- **Moderate curve** (40–60% drop): Balanced. Normal for well-trained rowers.

### Data Completeness
Common gaps and what to do about them:
- **No 500m/1k data**: Sprint distances are rarely tested in isolation. Look for interval splits (e.g., best single 500m from an 8x500m). Suggest: "Row a standalone 500m or 8x500m test to complete your sprint profile."
- **No data beyond 6k**: Long-duration data often missing. Suggest: "Try a 10k or half marathon to understand your endurance ceiling."
- **Interval-only data**: Many rowers never do standalone pieces at standard distances. Use best individual interval splits and session averages. Note lower confidence for these estimates.

### Progress Tracking
Compare curves over time windows:
- **Curve rising uniformly**: General fitness improving — all systems adapting
- **Short end rising, long end flat**: Intensity work paying off but aerobic base stagnant
- **Long end rising, short end flat**: Base building working but need to reintroduce intensity
- **Curve narrowing (flattening)**: Aerobic development catching up to anaerobic — common during base phase

## References

- Concept2 Watts Calculator: `W = 2.80 / (sec/m)³` — [concept2.com/training/calculators/watts-calculator](https://www.concept2.com/indoor-rowers/training/calculators/watts-calculator)
- ErgMonkey — Power curve analysis for indoor rowing: [ergmonkey.com](https://ergmonkey.com/2025/01/understanding-power-curves-in-indoor-rowing/)
- C2 Forum — Force curve discussion (JaapvanE, maintainer of OpenRowingMonitor): [c2forum.com/viewtopic.php?t=209282](https://www.c2forum.com/viewtopic.php?t=209282)
- Rowing training zones & periodization: See `kb/physiology/rowing-training-physiology.md` and `kb/physiology/zones-and-pacing.md`
