# /quiz - Gardening Quiz

Quick 5-question gardening quiz based on Virginia Zone 7a and what you're growing.

## Steps

1. **Read context**:
   - `garden/plants.yaml` - what you're growing
   - `garden/knowledge.yaml` - knowledge base and weak areas
   - Current date for seasonal relevance

2. **Generate 5 questions** prioritizing:
   - Weak areas from previous quizzes
   - Seasonally relevant topics (what to do this month)
   - Plants you're actually growing
   - Mix of difficulty levels

3. **Ask questions one at a time** using AskUserQuestion or conversationally

4. **Score and provide feedback**:
   - Correct answer with brief explanation
   - Update `garden/knowledge.yaml` with results
   - Note new weak areas to focus on

5. **Give seasonal tip** relevant to current month in Virginia

## Question Types

- Timing: "When should you start X indoors?"
- Care: "How much water does X need?"
- Identification: "What pest causes X symptoms?"
- Companion planting: "What grows well with X?"
- Harvest: "How do you know when X is ready?"
- Problem solving: "Your X has yellow leaves - what could cause this?"

## Example Questions for Current Plants

Based on plants.yaml:
- Tomatoes, collards, basil, parsley, garlic, onions
- Root veggies: carrots, radishes, beets, brussels sprouts
- Fruits: grapes, blackberries, raspberries
- Flowers: sunflowers, sweet alyssum
- Zucchini, eggplant, lettuce (in tent)
