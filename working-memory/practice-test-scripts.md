# Practice Test Scripts (Feature Feedback Runs)

> Date: 2026-02-13
> Purpose: Lightweight manual scripts to practice new features and collect actionable feedback.

## How To Use

- Run 1-2 scripts per session (10-20 minutes each).
- Record notes immediately with this format:
  - **What worked**
  - **What felt confusing**
  - **What was slower than expected**
  - **Severity** (Low/Med/High)

---

## Script 1: Quick Score from Roster "Missing"

**Time:** 10 minutes  
**Area:** Coaching roster + quick score modal

### Steps

1. Open roster for today.
2. Find an athlete with a red **Missing** badge.
3. Click **Missing** to open `QuickScoreModal`.
4. Select assignment (if not preselected).
5. Enter score details and submit.
6. Verify roster refreshes and athlete no longer appears as missing.

### Pass Criteria

- Modal opens in one click from badge.
- Save succeeds without page reload.
- Completion state updates immediately.

### Feedback Prompts

- Did this feel faster than the previous score-entry path?
- Was any field unclear or unnecessary?
- Did the post-save state feel trustworthy?

---

## Script 2: Mark Complete Without Score

**Time:** 8 minutes  
**Area:** Assignment completion flow

### Steps

1. Open `QuickScoreModal` for a missing athlete.
2. Use the completion-only path (no erg score).
3. Save and return to roster.
4. Check same-day completion indicators.

### Pass Criteria

- Completion-only save succeeds.
- Athlete status updates correctly.
- No validation blocks unless truly required.

### Feedback Prompts

- Is this option clearly discoverable?
- Did you hesitate about whether score data was required?

---

## Script 3: Quick Squad Assign + Filters

**Time:** 12 minutes  
**Area:** Roster inline squad editing

### Steps

1. Enable quick squad assign mode.
2. Update squad for 3 athletes:
   - one existing squad
   - one new squad name
   - one clear/remove squad
3. Use squad filter to view each cohort.
4. Refresh page and confirm persistence.

### Pass Criteria

- Inline edit commits on blur/Enter.
- Filter shows expected athlete subsets.
- New squad values persist after refresh.

### Feedback Prompts

- Was inline edit obvious without explanation?
- Did filter behavior match your mental model?

---

## Script 4: Invite + Join Team (2 Accounts)

**Time:** 15 minutes  
**Area:** Team onboarding + role access

### Steps

1. In settings, copy invite link.
2. Add a member by email.
3. On a second account/session, open invite link and join.
4. Confirm team membership appears correctly.
5. Verify role-based access is correct.

### Pass Criteria

- Invite link resolves correctly.
- Email add flow handles success/error clearly.
- Joined account lands in expected team context.

### Feedback Prompts

- Did onboarding feel trustworthy and clear?
- Were errors actionable when something failed?

---

## Script 5: Boatings Fast Operations

**Time:** 15-20 minutes  
**Area:** Boatings UX enhancements

### Steps

1. Open boatings for a date with lineups.
2. Inline edit at least 2 seats.
3. Execute one seat swap.
4. Use **Copy Previous Day**.
5. Check side-sorted athlete options in dropdowns.

### Pass Criteria

- Inline seat edits autosave correctly.
- Seat swap is obvious and reliable.
- Copy previous day creates expected lineups.

### Feedback Prompts

- Could this replace your manual lineup board workflow?
- Which operation still feels too slow?

---

## Script 6: About Page Support Flow

**Time:** 6 minutes  
**Area:** Community support UX

### Steps

1. Open About page.
2. Click **Donate via GitHub Sponsors**.
3. Click **View Public Roadmap**.
4. Return and assess messaging clarity.

### Pass Criteria

- Both links open correctly.
- Message explains why support matters.
- CTA feels aligned with community-first positioning.

### Feedback Prompts

- Would a first-time user understand the support model in under 10 seconds?
- Any wording that sounds unclear or too heavy?

---

## Weekly Run Cadence (Simple)

- **Mon:** Scripts 1 + 2
- **Wed:** Scripts 3 + 5
- **Fri:** Scripts 4 + 6

## Issue Template Snippet (copy/paste)

**Script:**  
**Date:**  
**Tester:**  
**What worked:**  
**What was confusing:**  
**Severity:** Low / Med / High  
**Suggested fix:**
