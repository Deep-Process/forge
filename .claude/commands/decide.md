# /decide

Review and resolve all open decisions.

## Procedure

1. Find the active project and read open decisions:
```bash
python -m core.decisions read {project} --status OPEN
```

2. If no open decisions, inform the user.

3. For each open decision, present it clearly:
   - Issue description
   - AI recommendation with reasoning
   - Alternatives considered
   - Confidence level

4. Ask the user for each: **Accept**, **Override**, or **Defer**

5. Collect all responses and update:
```bash
python -m core.decisions update {project} --data '[
  {"id": "D-001", "status": "CLOSED", "action": "accept"},
  {"id": "D-002", "status": "CLOSED", "action": "override", "override_value": "...", "override_reason": "..."},
  {"id": "D-003", "status": "DEFERRED", "action": "defer"}
]'
```

6. Show updated decision count.

## Important

- Present decisions ONE AT A TIME if there are many — don't overwhelm
- For overrides, clearly explain the implications of the user's choice
- Deferred decisions remain open — they will surface again
