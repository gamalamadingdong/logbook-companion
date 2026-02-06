# RWN Quick Reference Card

**Printable cheat sheet for Rowers Workout Notation**

## Basic Components

| Type | Syntax | Example |
|------|--------|---------|
| Distance | `[number]m` | `2000m`, `500m` |
| Time | `[M]:[SS]` | `30:00`, `1:45` |
| Calories | `[number]cal` | `300cal` |

## Workout Types

### Steady State
```
10000m          # 10k continuous
30:00           # 30 minutes
500cal          # 500 calories
```

### Intervals
```
Format: [N]x[work]/[rest]r

8x500m/1:00r    # 8 × 500m, 1 min rest
4x2000m/5:00r   # 4 × 2k, 5 min rest
10x1:00/1:00r   # 10 × 1 min on/off
```

### Variable (Multiple Segments)
```
Format: [seg1] + [seg2] + [seg3]

10:00 + 8x500m/1:00r + 5:00
2000m + 4x1000m/2:00r + 1000m
```

## Guidance Parameters

### Stroke Rate
```
@r[number]      # Single value
@r[min]..[max]  # Range

30:00@r20       # 30 min at rate 20
8x500m/1:00r@r32              # Intervals at r32
60:00@r18..22   # Hour, rate 18-22
```

### Pace
```
@[M]:[SS]       # Absolute pace
@[pace1]..[pace2]  # Pace range
@2k, @6k        # Reference pace
@2k+[offset]    # Relative pace

8x500m@1:50/1:00r             # At 1:50 split
60:00@2:05..2:10              # Pace range
8x500m@2k/1:00r               # At 2k PR pace
5000m@2k+10                   # 10s slower than 2k
```

### Training Zones
```
@UT2, @UT1, @AT, @TR, @AN

3x20:00@UT2/2:00r             # UT2 intervals
60:00@UT1                     # Hour at UT1
```

### Combined Guidance
```
Use multiple @ symbols

30:00@UT2@r20                 # UT2 pace, rate 20
5000m@2k+5@r28                # 2k+5 pace, rate 28
8x500m@1:50@r32/1:00r         # 1:50 split, rate 32
```

## Block Tags

| Tag | Meaning | Example |
|-----|---------|---------|
| `[w]` | Warmup | `[w]10:00` |
| `[c]` | Cooldown | `[c]5:00` |
| `[t]` | Test/Benchmark | `[t]2000m` |

```
[w]10:00 + 8x500m/1:00r + [c]5:00
[w]2000m + [t]2000m
```

## Common Patterns

### Beginner
```
[w]10:00 + 5000m + [c]5:00
[w]10:00 + 4x500m/2:00r + [c]5:00
30:00@r20
```

### Intervals
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

### Tests
```
[w]2000m + [t]2000m + [c]1000m
[w]15:00 + [t]6000m + [c]10:00
```

## Common Mistakes

| ❌ Wrong | ✅ Right | Why |
|---------|---------|-----|
| `5k` | `5000m` | Use meters, not "k" |
| `8x500m/1:00` | `8x500m/1:00r` | Add "r" for rest |
| `8500m/1:00r` | `8x500m/1:00r` | Need "x" for intervals |
| `10000m [w]` | `[w]10000m` | Block tags are prefixes |
| `@2k-1-2k-5` | `@2k-1..2k-5` | Use ".." for ranges |

## Training Zones

| Zone | Intensity | Typical Use |
|------|-----------|-------------|
| UT2 | <60% max | Base aerobic |
| UT1 | 60-75% | Aerobic threshold |
| AT | 75-85% | Lactate threshold |
| TR | 85-95% | VO2max |
| AN | >95% | High intensity |

## Quick Examples

```
# Distance intervals
4x500m/1:00r
8x500m/1:30r
6x1000m/2:00r
4x2000m/5:00r

# Time intervals
10x1:00/1:00r
8x2:00/2:00r
4x5:00/3:00r

# Steady state
10000m
5000m
30:00
60:00

# With guidance
30:00@r20
8x500m@2k/1:00r
3x20:00@UT2/2:00r
5000m@2k+5@r28

# Complete workouts
[w]10:00 + 8x500m@2k+10/1:30r + [c]5:00
[w]2000m + [t]2000m + [c]1000m
[w]15:00 + 3x20:00@UT1/2:00r + [c]10:00
```

---

**For detailed explanations, see:** [RWN Guide](RWN_GUIDE.md)
