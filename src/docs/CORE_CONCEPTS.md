# Core Concepts

Welcome to Logbook Companion! This document explains the key concepts that power the platform: **Workouts**, **RWN**, and **Live Sessions**.

---

## 1. Workouts: The Data Model

At the heart of the platform is the **Workout**. We treat workouts as structured data, not just text blobs.

### Templates vs. Logs
*   **Templates**: Reusable "blueprints" for a workout. They define the structure (intervals, rest, targets) but have no result data. You create these in the [Workout Library](/templates).
*   **Logs**: The actual result of doing a workout. These are synced from the Concept2 Logbook API and contain performance data (splits, heart rate, watts).

### The "Canonical Match"
A core goal of the system is to automatically match **Logs** back to **Templates**.
*   If you row `4x500m/1:00r` on your machine, the system analyzes the interval structure.
*   It generates a **Canonical Name** (e.g., `"4x500m/1:00r"`).
*   It links your log to the matching Template, giving you historical analytics for that specific workout type.

---

## 2. RWN: Rowers Workout Notation

**RWN** is the "language" we use to describe workout structures. It is a standardized, text-based shorthand that is both human-readable and machine-parseable.

*   **Standard**: `[Repeats] x [Work] / [Rest]r`
*   **Examples**:
    *   `10000m` (Steady State)
    *   `8x500m/2:00r` (Intervals)
    *   `30:00@r20` (Guidance: 30 mins at rate 20)

**Why RWN?**
It acts as the universal translator. Whether you program a workout on a PM5, create it in our Editor, or log it manually, RWN allows us to identify it as the "same" workout.

👉 **[Read the Full RWN Specification](./RWN_spec.md)**

---

## 3. Live Sessions: The Connectivity Hub

**Live Sessions** (formerly "Coach Sessions") are where the rubber meets the road. This feature connects the web application directly to Concept2 PM5 monitors via Bluetooth (using the **erg-link** library).

### Programmable Workouts
Because our Templates use standardized structures (and RWN), we can "program" them directly onto the machine.
*   **No more manual entry**: You select "8x500m" in the app, click "Program", and your monitor sets itself up.
*   **Precision**: Ensures everyone in a group is doing the exact same workout down to the decaliter.

### Start Types
Live Sessions support two modes of execution:

1.  **Self-Paced**:
    *   Great for: Group training, gyms, remote classes.
    *   Users join a session and perform the programmed workout.
    *   Everyone starts on their own time, but data aggregates to the same session board.

2.  **Synchronized (Race Control)**:
    *   Great for: Racing, competitive pieces.
    *   **Set**: The Host pushes the workout to all connected PM5s.
    *   **Check**: The system verifies everyone is sitting at the catch.
    *   **Go**: The Host sends a "Go" command, and all monitors start simultaneously.

---

## Summary of Flow

```mermaid
graph TD
    T[Template (Standardized)] -->|Defines Structure| RWN[RWN (Notation)]
    RWN -->|Programs| PM5[Concept2 PM5]
    
    subgraph Live Session
    PM5 -->|Real-time Data| LS[Live Dashboard]
    end
    
    PM5 -->|Saves Result| C2[C2 Logbook]
    C2 -->|Syncs Result| LOG[Synced Log]
    
    LOG -->|Matches via RWN| T
    LOG -->|Updates Stats| ANA[Analytics]
```
