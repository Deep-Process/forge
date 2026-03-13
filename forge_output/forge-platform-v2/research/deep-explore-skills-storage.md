# Deep Explore Analysis: Skills Storage Refactoring
Date: 2026-03-12T00:00:00Z
Skill: deep-explore v1.0
Objective: O-016 (File-Based Skills Storage with Git Sync)

---

## Problem Statement

Current skills storage uses a monolithic `_global/skills.json` where:
- `skill_md_content` stores entire SKILL.md as escaped string
- `resources.files[].content` stores bundled files as strings
- All skills loaded into memory on every API call
- No git-friendly diffs, no external editing

## Option Map

### Option A: File-Based Directories (RECOMMENDED)

```
_global/skills/
  .git/                          ← clone of forge-skills.git
  code-review/
    _config.json                 ← Forge metadata
    SKILL.md                     ← skill content (frontmatter = name/desc/version)
    scripts/
    references/
    assets/
  deep-explore/
    _config.json
    SKILL.md
```

**_config.json schema:**
```json
{
  "id": "S-001",
  "categories": ["workflow", "analysis"],
  "status": "DRAFT",
  "tags": ["security", "backend"],
  "scopes": ["backend"],
  "evals_json": [],
  "teslint_config": null,
  "sync": false,
  "promoted_with_warnings": false,
  "promotion_history": [],
  "usage_count": 0,
  "created_by": "user",
  "created_at": "2026-03-12T00:00:00Z",
  "updated_at": "2026-03-12T00:00:00Z"
}
```

**Source of truth split:**
- SKILL.md frontmatter → name, description, version, allowed-tools
- _config.json → categories, tags, status, evals, promotion_history, scopes, sync flag

**Pros:**
- Git-friendly diffs on SKILL.md changes
- Normal file editing with any editor/IDE
- Lazy loading (read only needed skills)
- Natural structure for bundled files
- SKILL.md is self-contained and portable

**Cons:**
- Requires new SkillStorageService layer
- Per-skill locking instead of single-file atomicity
- Directory scanning instead of JSON array iteration

### Option B: Status Quo (JSON-blob)

Keep `_global/skills.json` with all skills + content as strings.

**Verdict: NO-GO** — doesn't solve any of the identified problems.

### Option C: Hybrid (metadata JSON + files on disk)

Index file for metadata, files on disk for content.

**Verdict: NO-GO** — two sources of truth, synchronization complexity.

## Architecture Changes Required

### 1. New SkillStorageService (backend)

```python
class SkillStorageService:
    def __init__(self, skills_dir: Path):
        self.skills_dir = skills_dir  # _global/skills/

    def list_skills(self) -> list[dict]:
        """Scan directories, read _config.json from each."""

    def get_skill(self, name: str) -> dict:
        """Read _config.json + SKILL.md + file listing."""

    def save_skill(self, name: str, config: dict, content: str | None = None) -> None:
        """Write _config.json, optionally SKILL.md."""

    def delete_skill(self, name: str) -> None:
        """Remove directory."""

    def get_file(self, name: str, path: str) -> str:
        """Read a bundled file."""

    def save_file(self, name: str, path: str, content: str) -> None:
        """Write a bundled file."""

    def delete_file(self, name: str, path: str) -> None:
        """Delete a bundled file."""

    def move_file(self, name: str, old_path: str, new_path: str) -> None:
        """Move/rename a file within a skill."""
```

### 2. GitSyncService (backend)

```python
class GitSyncService:
    def __init__(self, skills_dir: Path, remote_url: str):
        self.skills_dir = skills_dir
        self.remote_url = remote_url

    async def init_or_clone(self) -> None:
        """Clone if not exists, else verify .git."""

    async def pull(self) -> GitSyncResult:
        """Pull from remote. Detect conflicts."""

    async def push(self, message: str) -> GitSyncResult:
        """Add all synced skills, commit, push."""

    async def status(self) -> GitStatus:
        """Local changes vs remote."""
```

### 3. API Endpoint Changes

| Current | New |
|---------|-----|
| `GET /skills` (loads all from JSON) | `GET /skills` (scan dirs, read _config.json) |
| `POST /skills` (append to JSON array) | `POST /skills` (create directory + files) |
| `PATCH /skills/{id}` | `PATCH /skills/{name}` (update _config.json + SKILL.md) |
| `DELETE /skills/{id}` | `DELETE /skills/{name}` (remove directory) |
| `PUT /skills/{id}/files` (replace all in JSON) | `PUT /skills/{name}/files` (write real files) |
| — | `POST /skills/git/pull` (new) |
| — | `POST /skills/git/push` (new) |
| — | `GET /skills/git/status` (new) |
| `category: string` | `categories: string[]` (multi-category) |

### 4. Frontend Changes

- `category: string` → `categories: string[]` in types + forms
- Add git sync controls (pull/push buttons, status indicator)
- File tree: add drag-to-move between folders
- Upload: support folder/zip upload for new skills
- `replaceFiles()` → individual file operations (save/delete/move)

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Concurrent file access | MEDIUM | MEDIUM | Per-skill asyncio lock |
| Git merge conflicts | MEDIUM | LOW | Detect + show to user |
| Breaking existing API | HIGH | LOW | Keep `/skills/{id}` working during transition |
| Performance (dir scanning) | LOW | LOW | Cache skill index, invalidate on change |
