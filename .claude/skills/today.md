# /today - Generate Today's Plan

Generate a personalized daily plan based on current state and goals.

## Steps

1. **Check in with the user** using AskUserQuestion:
   - How's your energy today? (1-10 or Low/Medium/High)
   - Any injuries, soreness, or physical issues?
   - Anything time-sensitive or top of mind today?

2. **Read context files** (in parallel):
   - `profile.yaml` - constraints, preferences
   - `goals.yaml` - current priorities
   - `tasks/backlog.yaml` - pending tasks
   - `tasks/recurring.yaml` - what's scheduled today
   - `garden/plants.yaml` - any garden tasks
   - Recent logs in `logs/daily/` - what happened recently

3. **Generate the plan** considering:
   - Day of week (check recurring.yaml for what's scheduled)
   - User's energy level (scale workout intensity, task load)
   - Any physical issues (modify workout accordingly)
   - Priority tasks from backlog (urgent first)
   - Weather/season for garden tasks
   - User's stated priorities in goals.yaml

4. **Write the plan** to `plans/daily/YYYY-MM-DD.md` (note: markdown, not yaml).

5. **Present a summary** to the user with:
   - Today's workout (with modifications if needed)
   - Top 3 priority tasks
   - Any seasonal reminders
   - A motivational note tied to their goals

   Garden quiz questions are no longer baked into the daily plan — that flow
   lives in the `/quiz` skill, which the user invokes interactively when they
   want to drill.

## Plan format: markdown with yaml frontmatter

Plans are read by both the human (in any text editor) and the higgzlife app's
Plans page. The app parses the frontmatter for structured fields (date, energy
level, workout exercises for the "Start workout" pre-fill button) and renders
the body as styled markdown with interactive checkboxes for the to-dos.

**Frontmatter (yaml)** holds anything the app reads programmatically:
- `date`, `day`, `energy_level`, `adjustments`
- `workout`: `type`, `focus`, `duration_min`, optional `modality`, `exercises[]`
  - Each exercise: `name`, `sets`, `reps` (string or number, e.g. "10-12" or 10),
    optional `duration`, optional `note`

**Body (markdown)** holds the human-facing rendering:
- A blockquote up top with the day's lens (energy + adjustments)
- `## Workout — {focus} ({duration_min} min)` with `### Warmup`, `### Main`,
  `### Cooldown` sections. Main is a checklist (`- [ ]`) so the user can tick
  exercises off as they go. Italic *notes* under exercises.
- `## Tasks` with `### Priority`, `### Normal`, `### If time` subsections,
  each a checklist.
- `## Garden — seasonal reminder` with prose.
- `## Meals` with a short suggestion paragraph.
- `## Notes` as a final list of one-liners.

### Template

```markdown
---
date: YYYY-MM-DD
day: monday
energy_level: high  # low | medium | high
adjustments: "Wrist still tender - modifying push movements"
workout:
  type: strength  # strength | cardio | mobility | sport | mixed
  focus: "Upper body + core"
  duration_min: 40
  exercises:
    - name: "Incline push-ups"
      sets: 3
      reps: "10-12"
      note: "Keeps wrist neutral"
    - name: "Forearm planks"
      sets: 3
      duration: "30-45 sec"
---

# Today — {Day}, {Month D}

> {energy} energy + {short context}. {adjustments rephrased as guidance.}

## Workout — {focus} ({duration_min} min)

### Warmup
- Arm circles, shoulder rolls (2 min)
- ...

### Main
- [ ] **Incline push-ups** — 3 × 10–12
  *Keeps wrist neutral — stop if any pain.*
- [ ] **Forearm planks** — 3 × 30–45 sec

### Cooldown
- Chest stretch (30 sec each side)
- ...

## Tasks

### Priority
- [ ] **Call vet** — ask about tick prevention
  *URGENT — weighing on you.*

### Normal
- [ ] Transplant tent seedlings

### If time
- [ ] Research parenting classes

## Garden — seasonal reminder

Mid-May in Virginia — past last frost. Time to:
- Get warm-season seedlings outside (zucchini, eggplant)
- ...

## Meals

High energy day — fuel the workout. Protein + complex carbs at each meal.

## Notes

- The vet call is the one thing that'll clear mental space today.
- 5 months until baby — you're building the habits now.
```

### Rules

- **Always emit frontmatter** even if some fields are empty. The app keys off it.
- **Exercise names in frontmatter should match the canonical library entry** when
  the user has logged this exercise before. Frontmatter `name` is what the
  "Start workout" button pre-fills as the exercise name.
- **Reps as string** when there's a range ("10-12") or qualifier ("max", "each side").
  Reps as integer when it's a clean number. The app handles both.
- **Notes go in body, not frontmatter.** Frontmatter is for structured fields.

## Tone

- Encouraging but not cheesy
- Practical and actionable
- Acknowledge how they're feeling
- Connect tasks to their bigger goals (triathlon, dad prep, etc.)
