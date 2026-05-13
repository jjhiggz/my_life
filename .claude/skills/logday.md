# /logday - Log Your Day

Quickly log what you actually did today.

## Steps

1. **Check in with the user** using AskUserQuestion:
   - Did you complete your workout? (Yes/Partially/No)
   - How are you feeling? Mood 1-10, Energy 1-10
   - Any wins or struggles to note?

2. **Read today's plan** from `plans/daily/YYYY-MM-DD.yaml` if it exists

3. **Ask about specific items** from the plan:
   - Which tasks did you complete?
   - Any deviations from the plan?
   - Garden quiz score if applicable

4. **Write the log** to `logs/daily/YYYY-MM-DD.yaml`

5. **Update aggregation files** if workout data:
   - Append to `logs/workouts/YYYY-MM.json`

6. **Give brief feedback**:
   - Acknowledge what got done
   - Note any patterns (positive or concerning)
   - Suggest adjustments for tomorrow if relevant

## Log Structure

```yaml
date: YYYY-MM-DD
day: weekday

workout:
  completed: true/false/partial
  type: ...
  duration_min: ...
  notes: "..."

tasks:
  - task: "..."
    completed: true/false
    notes: "..."

garden:
  quiz_score: X/5
  time_in_garden_min: ...

metrics:
  mood: 1-10
  energy: 1-10
  sleep_hours: ...
  sleep_quality: 1-10

reflections: |
  ...

wins: []
tomorrow: []
```

## Tone

- Quick and conversational
- Celebrate wins, no judgment on misses
- Focus on patterns, not individual days
