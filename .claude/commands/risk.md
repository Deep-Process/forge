# /risk $ARGUMENTS

Manage project risks — identify, track, and mitigate.

## Arguments

| Form | Meaning | Example |
|------|---------|---------|
| `{title}` | Quick add risk (asks for details) | `/risk Redis cluster failure` |
| `{risk_id}` | Show full risk details | `/risk R-001` |
| `{risk_id} analyze` | Mark as ANALYZING | `/risk R-001 analyze` |
| `{risk_id} mitigate {plan}` | Mark as MITIGATED | `/risk R-001 mitigate Added circuit breaker` |
| `{risk_id} accept {reason}` | Accept the risk | `/risk R-001 accept Low likelihood, monitoring in place` |
| `{risk_id} close {notes}` | Close resolved risk | `/risk R-001 close Verified mitigation works` |
| (empty) | List all open risks | `/risk` |

## Procedure

Determine the active project:
```bash
ls forge_output/ 2>/dev/null
```

### List mode (no arguments):
```bash
python -m core.risks read {project} --status OPEN
```
Also show ANALYZING risks:
```bash
python -m core.risks read {project} --status ANALYZING
```

### Add mode (title without R- prefix):
Check contract:
```bash
python -m core.risks contract add
```

Ask the user for:
- description (what could go wrong)
- linked entity (which idea or task)
- severity (HIGH/MEDIUM/LOW)
- likelihood (HIGH/MEDIUM/LOW)
- mitigation plan (optional)

```bash
python -m core.risks add {project} --data '[{
  "title": "{title}",
  "description": "{what could go wrong and impact}",
  "linked_entity_type": "{idea|task}",
  "linked_entity_id": "{I-NNN or T-NNN}",
  "severity": "{HIGH|MEDIUM|LOW}",
  "likelihood": "{HIGH|MEDIUM|LOW}",
  "mitigation_plan": "{how to reduce the risk}"
}]'
```

### Show mode (R-NNN):
```bash
python -m core.risks show {project} {risk_id}
```

### Action modes:

**analyze:**
```bash
python -m core.risks update {project} --data '[{"id": "{risk_id}", "status": "ANALYZING"}]'
```

**mitigate:**
```bash
python -m core.risks update {project} --data '[{"id": "{risk_id}", "status": "MITIGATED", "mitigation_plan": "{plan}"}]'
```

**accept:**
```bash
python -m core.risks update {project} --data '[{"id": "{risk_id}", "status": "ACCEPTED", "resolution_notes": "{reason}"}]'
```

**close:**
```bash
python -m core.risks update {project} --data '[{"id": "{risk_id}", "status": "CLOSED", "resolution_notes": "{notes}"}]'
```
