# /weekly - Weekly Review

Generate a weekly review summarizing progress and planning ahead.

## Steps

1. **Read the week's data**:
   - All `logs/daily/` files for this week
   - `logs/workouts/YYYY-MM.json` for workout aggregation
   - `goals.yaml` for progress tracking
   - `tasks/backlog.yaml` for what's still pending

2. **Calculate metrics**:
   - Workout adherence (days completed / days planned)
   - Task completion rate
   - Garden quiz average score
   - Average mood/energy
   - Weight change (if logged)

3. **Identify patterns**:
   - What days/times work best?
   - What keeps getting skipped?
   - Energy/mood trends
   - Wins and struggles

4. **Generate review** and write to `reviews/weekly/YYYY-WXX.md`

5. **Suggest adjustments**:
   - Workout modifications
   - Task prioritization changes
   - Goal progress check
   - Anything to add/remove from routine

6. **Plan next week**:
   - Key priorities
   - Any schedule considerations
   - Goals to focus on

## Review Structure

See `reviews/weekly/.example-review.md` for format.

## Tone

- Honest but encouraging
- Data-driven observations
- Forward-looking suggestions
- Connect to bigger goals (triathlon by next year, baby in October)
