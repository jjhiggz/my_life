# higgzlife

AI-assisted life management system. Claude reads this repo to plan your days, track your progress, and help you hit your goals.

## Quick Start

1. **Ask Claude for today's plan**: "What should I do today?"
2. **Log your day**: Fill out `logs/daily/YYYY-MM-DD.yaml`
3. **Update as things change**: Add tasks to `tasks/backlog.yaml`, update `goals.yaml`

## Structure

```
higgzlife/
├── profile.yaml          # Your context: location, constraints, preferences
├── goals.yaml            # Active goals and priorities
├── tasks/
│   ├── backlog.yaml      # One-off tasks and errands
│   ├── recurring.yaml    # Daily/weekly recurring items
│   └── skills.yaml       # Skills you're developing
├── plans/
│   ├── workouts/         # Workout templates
│   ├── diet/             # Nutrition guidance
│   └── daily/            # Claude's daily plans for you
├── logs/
│   ├── daily/            # What actually happened each day
│   └── workouts/         # Aggregatable workout data (JSON)
├── garden/
│   ├── plants.yaml       # What you're growing
│   └── knowledge.yaml    # Gardening knowledge + quiz tracking
└── reviews/
    └── weekly/           # Weekly review notes
```

## How It Works

### The Feedback Loop
1. Claude reads your goals, backlog, and recent logs
2. Claude generates a daily plan (`plans/daily/YYYY-MM-DD.yaml`)
3. You do the things (or don't)
4. You log what happened (`logs/daily/YYYY-MM-DD.yaml`)
5. Claude learns and adjusts future plans

### Querying Your Data
The structured logs enable queries like:
- "How many workouts did I complete in March?"
- "What's my quiz score average this month?"
- "Show me weeks where I hit 80%+ task completion"

Use `jq` for JSON logs, or just ask Claude.

## Key Commands

Ask Claude things like:
- "What should I do today?"
- "Generate today's plan"
- "Quiz me on gardening"
- "How did I do this week?"
- "Add [task] to my backlog"
- "Log my workout: 30 min bike ride"
- "What should I plant this month?"

## Updating Goals

Edit `goals.yaml` when your priorities shift. The `priorities` list determines what Claude emphasizes in daily planning.

## Mobile Access

Access via GitHub mobile + Claude, or any git client on your phone.
