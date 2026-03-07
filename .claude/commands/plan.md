# /plan $ARGUMENTS

Decompose a high-level goal into a tracked, dependency-aware task graph.

## Procedure

1. Parse the goal from arguments: `$ARGUMENTS`

2. Create the project:
```bash
python -m core.pipeline init "$(echo '$ARGUMENTS' | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | head -c 40)" --goal "$ARGUMENTS"
```
Use a slug derived from the goal as the project name (lowercase, hyphens, max 40 chars).

3. Analyze the goal and decompose it into concrete tasks:
   - Each task should be a focused, completable unit of work
   - Tasks should have clear dependency relationships (what must be done first?)
   - Aim for 3-10 tasks (not too granular, not too broad)
   - Each task should map to specific files or components

4. For each task, determine:
   - `id`: T-001, T-002, etc.
   - `name`: short, descriptive (e.g., "setup-database-schema")
   - `description`: what exactly needs to be done
   - `depends_on`: which tasks must complete first
   - `skill`: (optional) path to a SKILL.md if applicable
   - `instruction`: step-by-step guidance for execution

5. Add all tasks to the pipeline:
```bash
python -m core.pipeline add-tasks {project} --data '[
  {"id": "T-001", "name": "...", "description": "...", "depends_on": [], "instruction": "..."},
  {"id": "T-002", "name": "...", "description": "...", "depends_on": ["T-001"], "instruction": "..."}
]'
```

6. Show the created plan:
```bash
python -m core.pipeline status {project}
```

7. Ask the user to review the plan before execution. Offer to:
   - Add/remove tasks
   - Change dependencies
   - Modify descriptions
   - Start execution with `/next`

## Guidelines

- **Start with understanding**: Before decomposing, read relevant existing code to understand the current state
- **Dependencies matter**: A task should not depend on something that runs after it
- **Each task should be testable**: After completing a task, there should be a way to verify it works
- **Consider order**: Setup before implementation, implementation before tests, tests before integration
- **Record key decisions**: If you make architectural choices during planning, record them as decisions
