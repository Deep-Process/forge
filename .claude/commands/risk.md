# /risk $ARGUMENTS

Manage project risks — identify, track, and mitigate.

Risks are stored as decisions with type=risk in decisions.json.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{title}` | Quick add risk (asks for details) | `/risk Redis cluster failure` |
| `{decision_id}` | Show full risk details | `/risk D-010` |
| `{decision_id} analyze` | Mark as ANALYZING | `/risk D-010 analyze` |
| `{decision_id} mitigate {plan}` | Mark as MITIGATED | `/risk D-010 mitigate Added circuit breaker` |
| `{decision_id} accept {reason}` | Accept the risk | `/risk D-010 accept Low likelihood, monitoring in place` |
| `{decision_id} close {notes}` | Close resolved risk | `/risk D-010 close Verified mitigation works` |
| (empty) | List all open risks | `/risk` |

## Procedure

Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

### List mode (no arguments):
```bash
python -m core.decisions read {project} --type risk --status OPEN
```
Also show ANALYZING risks:
```bash
python -m core.decisions read {project} --type risk --status ANALYZING
```

### Add mode (title without D- prefix):

Ask the user for:
- description (what could go wrong)
- linked entity (which idea or task)
- severity (HIGH/MEDIUM/LOW)
- likelihood (HIGH/MEDIUM/LOW)
- mitigation plan (optional)

```bash
python -m core.decisions add {project} --data '[{
  "task_id": "{I-NNN or T-NNN}",
  "type": "risk",
  "issue": "{title}",
  "recommendation": "{mitigation_plan or initial assessment}",
  "severity": "{HIGH|MEDIUM|LOW}",
  "likelihood": "{HIGH|MEDIUM|LOW}",
  "linked_entity_type": "{idea|task}",
  "linked_entity_id": "{I-NNN or T-NNN}",
  "mitigation_plan": "{how to reduce the risk}",
  "decided_by": "claude"
}]'
```

### Show mode (D-NNN):
```bash
python -m core.decisions show {project} {decision_id}
```

### Action modes:

**analyze:**
```bash
python -m core.decisions update {project} --data '[{"id": "{decision_id}", "status": "ANALYZING"}]'
```

**mitigate:**
```bash
python -m core.decisions update {project} --data '[{"id": "{decision_id}", "status": "MITIGATED", "mitigation_plan": "{plan}"}]'
```

**accept:**
```bash
python -m core.decisions update {project} --data '[{"id": "{decision_id}", "status": "ACCEPTED", "resolution_notes": "{reason}"}]'
```

**close:**
```bash
python -m core.decisions update {project} --data '[{"id": "{decision_id}", "status": "CLOSED", "resolution_notes": "{notes}"}]'
```
