# Templates Guide: Unlock Your Performance Analytics

Learn how workout templates transform your logbook from a diary into a performance tracking powerhouse.

## Why Templates Are Game-Changing

### The "Aha" Moment

**Traditional Logbook Approach:**
> "I did 8x500m today. It felt hard. I think I went around 1:52 average."

That's it. One isolated data point. Tomorrow it's forgotten.

**With Templates:**
> "I did 8x500m today at 1:52 average. That's my **47th time** doing this workout. My **PR is 1:48**. I'm **2 seconds faster** than last month. Here's a **chart showing my trend** over the season."

**That's the difference.** Templates turn every workout into part of a story.

### Real-World Example: 2k Test Progression

Imagine you test your 2k every month:

**Without templates:**
- Jan 15: 7:24.5 (you write it down)
- Feb 12: 7:18.2 (you write it down)
- Mar 10: 7:22.1 (you write it down)
- Question: "Am I getting faster?" → You have to manually compare

**With templates:**
- One template: "2000m Test"
- All three tests automatically linked
- Instant view: PR is 7:18.2, trend chart shows progress
- Comparison tool: Overlay Feb vs. Mar to see where you slowed down

### Coach Benefit: Team Analytics

**Scenario:** Your team does "8x500m/1:00r" every Friday.

**Without templates:**
- Each athlete logs individually
- You manually collect and compare results
- Hard to track who's improving

**With templates:**
- One shared template: "Friday 500s"
- All athletes' workouts auto-link to it
- Coach view: See entire team's performance on one screen
- Track: Who's improving? Who's plateauing? Who set a PR?

## Templates vs. Workouts Explained

Understanding the relationship is key to unlocking the analytics.

### The Blueprint vs. The Performance

| Concept | What It Is | Example |
|---------|-----------|---------|
| **Template** | The blueprint/pattern | "8x500m/1:00r" |
| **Workout** | Actual performance on a date | "Jan 15, 2026: 8x500m @ 1:52 avg" |
| **The Connection** | Links them together | Automatic via RWN matching |

**Think of it like:**
- **Template** = Recipe (how to make chocolate chip cookies)
- **Workout** = Batch you baked (cookies you made on Tuesday)
- **Connection** = Every time you use that recipe, you can compare results

### The Data Flow

```
┌──────────────────┐
│   TEMPLATE       │  ← The pattern: "8x500m/1:00r"
│   (Blueprint)    │
└────────┬─────────┘
         │
         │ Links to ↓
         │
    ┌────┴─────────────────────────────┐
    │                                   │
┌───▼──────────┐  ┌──────────────┐  ┌──▼──────────┐
│ WORKOUT #1   │  │ WORKOUT #2   │  │ WORKOUT #3  │
│ Jan 15: 1:52 │  │ Feb 3: 1:50  │  │ Mar 1: 1:48 │
└──────────────┘  └──────────────┘  └─────────────┘
                                           ↑
                                          PR!
```

**The magic:** When you sync a new workout, the system:
1. Reads the interval structure
2. Converts to RWN: "8x500m/1:00r"
3. Finds the matching template
4. Links them automatically
5. Updates your PR if you beat it
6. Adds to your trend chart

**You do nothing.** It just works.

## The Automatic Matching Magic

This is what makes templates powerful without being tedious.

### How It Works

**Step 1: You row a workout**
- Row 8x500m on your Concept2
- Sync to Logbook Companion

**Step 2: System analyzes structure**
- Reads: "8 intervals, 500m each, 1:00 rest"
- Converts to canonical RWN: "8x500m/1:00r"

**Step 3: Searches for matching template**
- Priority 1: Your personal templates
- Priority 2: Community templates (most popular)

**Step 4: Links them together**
- Workout now belongs to template
- All analytics instantly available

**Step 5: You see the results**
- Open workout → See "Linked to: 8x500m/1:00r template"
- View template → See all your attempts
- Compare → Overlay any two performances

### What Gets Matched?

The system matches on **structure**, not details:

**These all match the same template:**
- `8x500m/1:00r` (basic)
- `8x500m@2k/1:00r` (with pace guidance)
- `8x500m@r32/1:00r` (with rate guidance)
- `[w]10:00 + 8x500m/1:00r + [c]5:00` (with warmup/cooldown)

**Why?** The core pattern is the same: 8 intervals of 500m with 1 minute rest.

**These do NOT match:**
- `8x500m/1:30r` (different rest)
- `6x500m/1:00r` (different repeats)
- `8x400m/1:00r` (different distance)

## Creating Your First Template

There are three ways to create templates. Choose based on your situation.

### Method 1: From Template Library (Easiest)

**When to use:** You want to do a popular workout that probably already exists.

**Steps:**
1. Go to **Template Library**
2. Browse or search for your workout (e.g., "8x500m")
3. Click on a template to preview
4. Click **"Add to My Templates"** or **"Favorite"**
5. Done! Now when you row this workout, it auto-links

**Pro tip:** Check the "usage count" to see which templates are most popular.

### Method 2: Quick Create from Existing Workout

**When to use:** You just rowed a workout and want to track it going forward.

**Steps:**
1. Open any workout in your logbook
2. Click **"Create Template from This Workout"**
3. System auto-fills the RWN based on the workout structure
4. Add a name and description (optional)
5. Click **"Create Template"**
6. Done! Future workouts with this pattern will auto-link

**Pro tip:** This is the fastest way to build your personal template library.

### Method 3: Manual Creation with RWN

**When to use:** You're planning a new workout that doesn't exist yet.

**Steps:**
1. Go to **Template Library** → **"Create New Template"**
2. Enter the RWN notation (e.g., `8x500m/1:00r`)
3. Add a name: "Friday 500s" (or whatever you call it)
4. Add description (optional): "Weekly speed work"
5. Set visibility: Personal or Community
6. Click **"Create Template"**

**Pro tip:** Use the RWN Guide to get the syntax right. The editor will show errors if something's wrong.

## Template Library: Personal vs. Community

### Personal Templates

**What they are:** Templates you create or favorite for yourself.

**Benefits:**
- Tailored to your training plan
- Track your specific workouts
- Private by default (only you see them)

**When to use:**
- Custom workouts your coach prescribed
- Variations of standard workouts
- Team-specific sessions

### Community Templates

**What they are:** Templates shared by other users.

**Benefits:**
- Discover popular workouts
- See what others are doing
- Save time (don't recreate common workouts)

**When to use:**
- Looking for new workout ideas
- Want to try proven sessions
- Building your template library quickly

**How it works:**
- Users can mark templates as "Community"
- Most popular templates rise to the top (by usage count)
- You can add any community template to your personal library

### Organizing Your Templates

**Favorites:**
- Star your most-used templates
- Quick access from dashboard
- Example: Your weekly staples

**Tags (future feature):**
- Group by type: "Intervals", "Steady State", "Tests"
- Filter by training phase: "Base", "Build", "Peak"

## Template Analytics: The Payoff

This is where templates deliver massive value.

### Personal Bests (Automatic Tracking)

**What you get:**
- Highest watts achieved on this template
- Date you set the PR
- Link to that specific workout

**Example:**
```
Template: 8x500m/1:00r
Personal Best: 385W avg
Set on: Feb 3, 2026
View workout →
```

**No manual work.** System tracks it automatically.

### Historical Performance Tracking

**What you see:**
- All your attempts on this template
- Sorted by date (newest first)
- Quick stats: avg watts, pace, rate, HR

**Example view:**
| Date | Avg Watts | Avg Pace | Avg Rate | Notes |
|------|-----------|----------|----------|-------|
| Mar 1 | 385W | 1:48 | 32 | PR! |
| Feb 3 | 378W | 1:50 | 31 | Felt strong |
| Jan 15 | 372W | 1:52 | 30 | First attempt |

**Value:** See your progression at a glance.

### Comparing Attempts (Overlay Performances)

**The power move:** Pick any two workouts and overlay them.

**What you can compare:**
- Watts per interval
- Pace per interval
- Rate per interval
- Heart rate per interval

**Example use case:**
> "I want to see why my Feb 3 workout was faster than Jan 15."

1. Open template
2. Select Jan 15 and Feb 3 workouts
3. Click "Compare"
4. See overlay chart showing:
   - Feb 3: More consistent watts across intervals
   - Jan 15: Faded in last 3 intervals

**Insight:** Need to work on pacing consistency.

### Zone Analysis

**What it shows:**
- How much time in each training zone (UT2, UT1, AT, TR, AN)
- Based on your baseline watts

**Example:**
```
Template: 3x20:00@UT2/2:00r
Zone Distribution:
- UT2: 58 minutes (97%)
- UT1: 2 minutes (3%)
- Other: 0 minutes
```

**Value:** Verify you're training in the right zones.

### Trend Charts

**What you see:**
- Performance over time (line chart)
- X-axis: Date
- Y-axis: Watts (or pace, rate, HR)

**Example:**
```
    Watts
    390 ┤                              ●
    385 ┤                        ●
    380 ┤                  ●
    375 ┤            ●
    370 ┤      ●
        └─────────────────────────────────
         Jan   Feb   Mar   Apr   May
```

**Value:** See if you're improving, plateauing, or regressing.

## Best Practices

### Naming Conventions

**Good names are descriptive and memorable:**

✅ **Good:**
- "Friday 500s" (what you call it)
- "2k Test" (clear purpose)
- "UT2 Intervals" (training zone)
- "Pete Plan Week 3" (program reference)

❌ **Avoid:**
- "Workout 1" (too generic)
- "8x500m/1:00r" (just the RWN, not memorable)
- "Hard intervals" (vague)

**Pro tip:** Use names you'd say out loud to a teammate.

### When to Create a New Template vs. Reuse

**Create a NEW template when:**
- Different structure (e.g., 8x500m → 6x500m)
- Different rest (e.g., 1:00r → 1:30r)
- Different purpose (e.g., speed work → endurance)

**Reuse existing template when:**
- Same structure, different pace target
- Same structure, different rate target
- Same structure, with/without warmup/cooldown

**Example:**
- Template: "8x500m/1:00r"
- Workout 1: `8x500m@2k/1:00r` (links to template)
- Workout 2: `8x500m@2k+5/1:00r` (links to same template)
- Workout 3: `[w]10:00 + 8x500m@r32/1:00r + [c]5:00` (links to same template)

**Why?** You want to track all your 8x500m attempts together, regardless of pace/rate guidance.

### Template Reuse Strategies

**Weekly Staples:**
- Create templates for workouts you do regularly
- Example: "Monday Steady State", "Wednesday Intervals", "Friday Speed Work"

**Test Pieces:**
- Create templates for benchmarks you repeat
- Example: "2k Test", "6k Test", "30min Test"

**Training Program:**
- Create templates for your program's key workouts
- Example: "Pete Plan 4x2k", "Wolverine Plan Week 5"

**Seasonal Focus:**
- Create templates for your current training phase
- Example: "Base Phase UT2", "Build Phase AT Work"

## Common Questions

**Q: Do I have to manually link workouts to templates?**  
A: No! The system does it automatically when you sync from Concept2 or enter RWN manually.

**Q: What if I want to track warmup and cooldown separately?**  
A: Use block tags: `[w]10:00 + 8x500m/1:00r + [c]5:00`. The system matches on the main work (8x500m), but preserves the full structure.

**Q: Can I change a template after creating it?**  
A: Yes, but be careful. Changing the RWN structure will affect future matching. Past workouts stay linked.

**Q: What if my workout doesn't match any template?**  
A: The system will suggest creating a new template. You can do it in one click.

**Q: Can I share my templates with my team?**  
A: Yes! Mark templates as "Community" to share them. Your team can add them to their libraries.

**Q: How do I delete a template?**  
A: Go to Template Library → Your Templates → Click template → Delete. Note: This doesn't delete your workouts, just the template grouping.

**Q: What's the difference between favoriting and adding to my templates?**  
A: Adding = template appears in your library. Favoriting = quick access from dashboard (subset of your library).

## Next Steps

Now that you understand templates:

1. **Create your first template** (use Method 2: Quick Create from existing workout)
2. **Sync your Concept2 history** (see automatic matching in action)
3. **Explore community templates** (discover new workouts)
4. **Compare performances** (pick two attempts and overlay them)
5. **Track your PRs** (see which templates you're improving on)

---

**Ready to see the complete workflow?** Continue to the [Workout Workflow Guide](WORKOUT_WORKFLOW.md).
