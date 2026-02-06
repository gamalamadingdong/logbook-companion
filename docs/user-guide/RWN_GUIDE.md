# RWN Guide: Rowers Workout Notation

Learn the universal language that powers Logbook Companion's automatic analytics.

## Why RWN Matters

### The Power of a Universal Language

Imagine if every coach, every training plan, and every logbook used a different way to describe workouts:
- Coach A writes: "Eight by five hundred meters, one minute rest"
- Coach B writes: "8 reps @ 500m w/ 60s recovery"  
- Coach C writes: "8×500 (1')"

They're all the same workout, but **computers can't recognize that**. This means:
- ❌ No automatic workout matching
- ❌ No progress tracking across platforms
- ❌ Manual work to group similar workouts

**RWN solves this** with one standardized notation: `8x500m/1:00r`

### Real-World Benefits

**For Athletes:**
- Write `8x500m/1:00r` once → System tracks it forever
- All your 8x500m workouts automatically grouped
- Instant comparison: "Did I beat my last attempt?"
- Works across Concept2, training plans, and coaching apps

**For Coaches:**
- Write workout once in RWN → Athletes can copy-paste to PM5
- Track team performance on specific workouts
- Share templates that work universally
- No ambiguity in workout prescription

### The Magic of Automatic Matching

Here's what happens when you use RWN:

```
1. You row a workout on your Concept2
   ↓
2. Sync to Logbook Companion
   ↓
3. System reads: "8 intervals × 500m with 1:00 rest"
   ↓
4. Converts to RWN: "8x500m/1:00r"
   ↓
5. Finds matching template
   ↓
6. Links them together
   ↓
7. ✨ You get instant analytics ✨
   - All previous attempts
   - Your PR
   - Trend chart
   - Comparison tool
```

**Without RWN:** You'd have to manually tag every workout and group them yourself.  
**With RWN:** It happens automatically, every time.

## Learning Path: Start Simple, Build Complexity

Don't try to learn everything at once. Here's how to progressively build your RWN skills:

### Week 1: Master Basic Intervals
**Just learn this pattern:** `[repeats]x[distance or time]/[rest]r`

**Examples to practice:**
- `8x500m/1:00r` - Eight 500m intervals, 1 minute rest
- `4x2000m/5:00r` - Four 2k intervals, 5 minutes rest
- `10x1:00/1:00r` - Ten 1-minute intervals, 1 minute rest

**Goal:** Get comfortable with the basic interval notation. This alone covers most interval workouts.

### Week 2: Add Steady State
**Learn:** Single segments without intervals

**Examples:**
- `10000m` - 10k continuous
- `30:00` - 30 minutes
- `60:00` - Hour piece

**Goal:** Understand that not everything needs intervals. Simple is often best.

### Week 3: Add Rate Guidance
**Learn:** `@r[number]` to specify stroke rate

**Examples:**
- `30:00@r20` - 30 minutes at rate 20
- `8x500m/1:00r@r32` - 500m intervals at rate 32
- `60:00@r18..22` - Hour piece, rate range 18-22

**Goal:** Start specifying HOW to do the work, not just WHAT to do.

### Week 4: Add Pace Guidance
**Learn:** `@2k` (reference pace) and `@2k+5` (relative pace)

**Examples:**
- `8x500m@2k/1:00r` - 500m intervals at your 2k PR pace
- `5000m@2k+10` - 5k at 10 seconds slower than 2k pace
- `30:00@6k` - 30 minutes at your 6k PR pace

**Goal:** Tie workouts to your benchmark performances.

### Week 5: Add Workout Structure
**Learn:** `[w]` (warmup), `[c]` (cooldown), `+` (connect segments)

**Examples:**
- `[w]10:00 + 8x500m/1:00r + [c]5:00` - Full session with warmup/cooldown
- `[w]2000m + [t]2000m + [c]1000m` - Test piece with structure
- `10:00 + 4x5:00/3:00r + 10:00` - Segments without tags

**Goal:** Describe complete training sessions, not just the main work.

### Week 6+: Combine Everything
**Now you can write:**
- `[w]10:00@r18 + 8x500m@2k+5@r32/1:30r + [c]5:00@r16`
- `[w]15:00 + 3x20:00@UT2@r18..20/2:00r + [c]10:00`

**You're fluent in RWN!** 🎉

## Basic Syntax

RWN uses a simple, readable format that mirrors how rowers already talk about workouts.

### Steady State (Continuous Effort)

For single continuous pieces without rest:

| RWN | Meaning | When to Use |
|-----|---------|-------------|
| `10000m` | 10,000 meters | Distance-based steady state |
| `30:00` | 30 minutes | Time-based steady state |
| `500cal` | 500 calories | Calorie-based work |

**Examples:**
- `5000m` → 5k steady state
- `60:00` → Hour piece
- `300cal` → 300 calorie workout

### Intervals (Work + Rest Pattern)

For repeated efforts with rest:

**Format:** `[Repeats]x[Work]/[Rest]r`

| RWN | Meaning |
|-----|---------|
| `8x500m/1:00r` | 8 intervals of 500m with 1 minute rest |
| `4x2000m/5:00r` | 4 intervals of 2000m with 5 minutes rest |
| `10x1:00/1:00r` | 10 intervals of 1 minute on, 1 minute off |

**Single Intervals with Rest:**
You can also define a single interval with a specific rest period (useful for variable workouts or single efforts).
*   `500m/1:00r` (Equivalent to `1x500m/1:00r`)
*   `2000m/5:00r`

**Breaking it down:**
- `8x` = 8 repeats (optional for single interval)
- `500m` = 500 meters of work
- `/` = followed by
- `1:00r` = 1 minute rest

### Variable Workouts (Multiple Segments)

For workouts with different parts (warmup, main set, cooldown):

**Format:** `[Segment1] + [Segment2] + [Segment3]`

| RWN | Meaning |
|-----|---------|
| `10:00 + 8x500m/1:00r + 5:00` | Warmup, intervals, cooldown |
| `2000m + 4x1000m/2:00r + 1000m` | Distance warmup, intervals, distance cooldown |

**The `+` symbol** connects segments that flow together without extra rest.

## Common Workout Patterns

Here are copy-paste ready examples for popular workouts:

### Distance Intervals

```
4x500m/1:00r          # Classic 500m repeats
8x500m/1:30r          # Longer rest version
6x1000m/2:00r         # 1k repeats
4x2000m/5:00r         # 2k repeats
3x2500m/5:00r         # 2.5k repeats
```

### Time Intervals

```
10x1:00/1:00r         # Minute on, minute off
8x2:00/2:00r          # 2 minutes on/off
4x5:00/3:00r          # 5 minute intervals
3x10:00/3:00r         # 10 minute intervals
```

### Pyramids

```
500m + 1000m + 1500m + 1000m + 500m    # Distance pyramid
1:00 + 2:00 + 3:00 + 2:00 + 1:00       # Time pyramid
```

### Steady State

```
10000m                # 10k
5000m                 # 5k
30:00                 # 30 minutes
60:00                 # Hour piece
```

### Complete Workouts (with warmup/cooldown)

```
10:00 + 8x500m/1:00r + 5:00                    # Classic interval session
2000m + 4x2000m/5:00r + 1000m                  # 2k repeats with warmup/cooldown
15:00 + 3x10:00/3:00r + 10:00                  # UT2 intervals
```

## Adding Guidance (Make Workouts More Specific)

Guidance tells you **how** to do the work, not just **what** to do.

### Why Guidance Matters

**Without guidance:** `30:00` (just row for 30 minutes)  
**With guidance:** `30:00@r20` (row for 30 minutes at rate 20)

Guidance helps you:
- ✅ Track if you hit your targets
- ✅ Compare apples-to-apples (same workout, same intensity)
- ✅ Follow training zones properly
- ✅ Reproduce successful workouts

### Stroke Rate Guidance

**Format:** `@r[number]` or `@[number]spm`

| RWN | Meaning |
|-----|---------|
| `30:00@r20` | 30 minutes at rate 20 |
| `8x500m/1:00r@r32` | 500m intervals at rate 32 |
| `60:00@18spm` | Hour piece at 18 strokes per minute |

**Rate ranges:**
| RWN | Meaning |
|-----|---------|
| `30:00@r18..22` | 30 minutes, rate 18-22 |
| `8x500m/1:00r@24..28spm` | 500m intervals, rate 24-28 |

### Pace Guidance

**Absolute pace** (specific split time):

| RWN | Meaning |
|-----|---------|
| `8x500m@1:50/1:00r` | 500m intervals at 1:50 split |
| `5000m@2:05` | 5k at 2:05/500m pace |

**Pace ranges:**
| RWN | Meaning |
|-----|---------|
| `60:00@2:05..2:10` | Hour piece, 2:05-2:10 split range |
| `8x500m@1:48..1:52/3:00r` | 500m intervals in 1:48-1:52 band |

**Reference pace** (based on PR):

| RWN | Meaning |
|-----|---------|
| `8x500m@2k/1:00r` | 500m intervals at your 2k PR pace |
| `5000m@6k` | 5k at your 6k PR pace |

**Relative pace** (offset from PR):

| RWN | Meaning |
|-----|---------|
| `5000m@2k+10` | 5k at 10 seconds slower than 2k PR pace |
| `30:00@6k-5` | 30 minutes at 5 seconds faster than 6k PR pace |
| `8x500m@2k+5..2k+10/3:00r` | 500m intervals, 5-10 seconds slower than 2k pace |

### Training Zone Guidance

**Format:** `@[Zone]`

| Zone | Meaning | Typical Use |
|------|---------|-------------|
| `UT2` | Utilization Training 2 | Base aerobic work |
| `UT1` | Utilization Training 1 | Aerobic threshold |
| `AT` | Anaerobic Threshold | Lactate threshold |
| `TR` | Transport | VO2max work |
| `AN` | Anaerobic | High intensity |

**Examples:**
| RWN | Meaning |
|-----|---------|
| `3x20:00@UT2/2:00r` | 20 minute UT2 intervals |
| `60:00@UT1` | Hour at UT1 |
| `4x5:00@AT/3:00r` | 5 minute AT intervals |

### Combining Guidance (Pace + Rate)

You can specify both pace and rate using multiple `@` symbols:

| RWN | Meaning |
|-----|---------|
| `30:00@UT2@r20` | 30 minutes at UT2 pace, rate 20 |
| `5000m@2k+5@r28` | 5k at 2k+5 pace, rate 28 |
| `8x500m@1:50@r32/1:00r` | 500m intervals at 1:50 split and rate 32 |
| `60:00@r18..22@UT2` | Hour at UT2, rate range 18-22 |

**Order doesn't matter:** `@UT2@r20` = `@r20@UT2`

## Block Tags (Organize Your Workout)

Block tags mark the **purpose** of each segment: warmup, cooldown, or test.

### The Three Tags

| Tag | Meaning | Example |
|-----|---------|---------|
| `[w]` | Warmup | `[w]10:00` |
| `[c]` | Cooldown | `[c]5:00` |
| `[t]` | Test/Benchmark | `[t]2000m` |

### Why Use Block Tags?

- **Organization:** Clearly separate warmup, main work, and cooldown
- **Analytics:** System can analyze just your main work, excluding warmup/cooldown
- **Benchmarks:** Flag test pieces for special tracking

### Examples

**Simple warmup + cooldown:**
```
[w]10:00 + 8x500m/1:00r + [c]5:00
```

**Test piece with warmup:**
```
[w]2000m + [t]2000m
```

**Complex session:**
```
[w]15:00@r18 + 4x2000m@AT/5:00r + [c]10:00@r16
```

**Just warmup (no cooldown):**
```
[w]10:00 + 4x2000m/5:00r
```

## Common Patterns Library

Copy-paste these proven workout patterns:

### Beginner Workouts
```
[w]10:00 + 5000m + [c]5:00
[w]10:00 + 4x500m/2:00r + [c]5:00
30:00@r20
```

### Interval Training
```
[w]10:00 + 8x500m@2k+10/1:30r + [c]5:00
[w]2000m + 6x1000m@AT/2:00r + [c]1000m
[w]15:00 + 4x2000m@2k+5/5:00r + [c]10:00
```

### Steady State
```
[w]5:00 + 60:00@UT2@r18..20 + [c]5:00
[w]10:00 + 3x20:00@UT1/2:00r + [c]5:00
10000m@UT2
```

### Test Pieces
```
[w]2000m + [t]2000m + [c]1000m
[w]15:00 + [t]6000m + [c]10:00
[w]10:00 + [t]30:00 + [c]5:00
```

### Rate Pyramids
```
[w]10:00 + 5:00@r18 + 5:00@r20 + 5:00@r22 + 5:00@r24 + [c]5:00
20:00@r18 + 10:00@r20 + 10:00@r22 + 20:00@r20 + 20:00@r18
```

## Common Mistakes and Troubleshooting

### ❌ Mistake: Using "k" instead of meters
**Wrong:** `5k`  
**Right:** `5000m`

**Why:** RWN requires explicit meters for distance.

### ❌ Mistake: Missing rest indicator
**Wrong:** `8x500m/1:00`  
**Right:** `8x500m/1:00r`

**Why:** The `r` indicates rest time.

### ❌ Mistake: Ambiguous pace ranges
**Wrong:** `8x500m@2k-1-2k-5/3:00r` (confusing!)  
**Right:** `8x500m@2k-1..2k-5/3:00r` (clear!)

**Why:** Use `..` for ranges to avoid ambiguity with negative offsets.

### ❌ Mistake: Confusing split notation with block tags
**Wrong:** `10000m [w]` (trying to mark as warmup)  
**Right:** `[w]10000m` (block tag is a prefix)

**Why:** `[w]` = warmup tag (prefix), `[2000m]` = split setting (suffix)

### ❌ Mistake: Forgetting the `x` in intervals
**Wrong:** `8500m/1:00r` (this is invalid)  
**Right:** `8x500m/1:00r`

**Why:** The `x` indicates repeats.

## Quick Reference Table

| Element | Syntax | Example |
|---------|--------|---------|
| **Distance** | `[number]m` | `2000m`, `500m` |
| **Time** | `[M]:[SS]` | `30:00`, `1:45` |
| **Calories** | `[number]cal` | `300cal` |
| **Intervals** | `[N]x[work]/[rest]r` | `8x500m/1:00r` |
| **Variable** | `[seg1] + [seg2]` | `10:00 + 8x500m/1:00r` |
| **Rate** | `@r[number]` or `@[number]spm` | `@r20`, `@24spm` |
| **Rate Range** | `@r[min]..[max]` | `@r18..22` |
| **Pace** | `@[M]:[SS]` | `@1:50`, `@2:05` |
| **Pace Range** | `@[pace1]..[pace2]` | `@2:05..2:10` |
| **Reference** | `@2k`, `@6k`, etc. | `@2k`, `@6k` |
| **Relative** | `@2k+[offset]` | `@2k+10`, `@6k-5` |
| **Zone** | `@[zone]` | `@UT2`, `@AT` |
| **Warmup** | `[w]` | `[w]10:00` |
| **Cooldown** | `[c]` | `[c]5:00` |
| **Test** | `[t]` | `[t]2000m` |

## Next Steps

Now that you understand RWN syntax:

1. **Practice**: Try writing your favorite workouts in RWN
2. **Create Templates**: Use RWN to define templates in your library
3. **Learn More**: Read the [Templates Guide](TEMPLATES.md) to unlock analytics

---

**Need more help?** Check out the [Quick Reference Card](RWN_QUICK_REFERENCE.md) for a printable cheat sheet.
