# /status

Show the current state of all Forge projects.

## Procedure

1. List all projects:
```bash
ls forge_output/ 2>/dev/null
```

2. For each project directory found, show its status:
```bash
python -m core.pipeline status {project}
```

3. If there are open decisions, mention them:
```bash
python -m core.decisions read {project} --status OPEN
```

4. Show a brief change summary:
```bash
python -m core.changes summary {project}
```

If no projects exist, inform the user and suggest using `/plan {goal}` to start.
