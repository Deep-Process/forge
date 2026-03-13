"""Git sync service for skills repository.

Manages git clone of forge-skills.git inside the skills directory.
Provides pull (fetch + reset --hard), push (add synced skills + commit + push),
and status operations.  Graceful degradation when git is unavailable.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)


@dataclass
class GitSyncResult:
    """Result of a git sync operation."""
    success: bool = True
    message: str = ""
    files_changed: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class RemoteSkillEntry:
    """A skill directory that exists in the remote ref."""
    name: str
    description: str = ""
    display_name: str = ""
    categories: list[str] = field(default_factory=list)
    status: str = ""
    sync: bool = False
    exists_locally: bool = False


@dataclass
class GitStatus:
    """Current git status of the skills repo."""
    initialized: bool = False
    has_remote: bool = False
    branch: str = ""
    ahead: int = 0
    behind: int = 0
    local_changes: list[str] = field(default_factory=list)
    last_commit: str = ""
    error: str | None = None


class GitSyncService:
    """Manages git operations for the skills directory."""

    def __init__(
        self,
        skills_dir: Path | str,
        remote_url: str | None = None,
        skill_storage: object | None = None,
        git_user_name: str = "",
        git_user_email: str = "",
        git_token: str = "",
    ):
        self.skills_dir = Path(skills_dir)
        self.remote_url = remote_url or os.environ.get("FORGE_SKILLS_REPO_URL", "")
        self._skill_storage = skill_storage  # SkillStorageService for resync
        self._sync_lock = asyncio.Lock()  # Serialize pull/push operations
        self._git_user_name = git_user_name
        self._git_user_email = git_user_email
        self._git_token = git_token

    def _check_configured(self) -> None:
        """Raise if git remote URL is not configured."""
        if not self.remote_url:
            raise GitSyncNotConfigured(
                "FORGE_SKILLS_REPO_URL not set — git sync is disabled"
            )

    def _config_args(self) -> list[str]:
        """Return git -c flags for identity and token-based HTTPS auth.

        Token auth uses url.<authed>.insteadOf=<plain> so the token is
        never written to .git/config — it only lives in the process argv.
        """
        args: list[str] = []
        if self._git_user_name:
            args += ["-c", f"user.name={self._git_user_name}"]
        if self._git_user_email:
            args += ["-c", f"user.email={self._git_user_email}"]
        if self._git_token and self.remote_url.startswith("https://"):
            parsed = urlparse(self.remote_url)
            host = parsed.hostname + (f":{parsed.port}" if parsed.port else "")
            args += ["-c", f"url.https://{self._git_token}@{host}/.insteadOf=https://{host}/"]
        return args

    async def _run_git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        """Run a git command in skills_dir via asyncio.to_thread."""
        cmd = ["git", *self._config_args(), *args]
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                cwd=str(self.skills_dir),
                capture_output=True,
                text=True,
                timeout=60,
            )
            if check and result.returncode != 0:
                raise GitSyncError(
                    f"git {' '.join(args)} failed: {result.stderr.strip()}"
                )
            return result
        except FileNotFoundError:
            raise GitSyncError("git is not installed or not in PATH")
        except subprocess.TimeoutExpired:
            raise GitSyncError(f"git {' '.join(args)} timed out (60s)")

    async def init_or_clone(self) -> GitSyncResult:
        """Clone the remote repo or verify existing .git directory."""
        self._check_configured()
        git_dir = self.skills_dir / ".git"

        if git_dir.is_dir():
            # Verify remote matches
            result = await self._run_git("remote", "get-url", "origin", check=False)
            if result.returncode == 0:
                current_url = result.stdout.strip()
                if current_url != self.remote_url:
                    await self._run_git("remote", "set-url", "origin", self.remote_url)
                return GitSyncResult(
                    success=True,
                    message=f"Repository verified at {self.skills_dir}",
                )
            # Has .git but no origin — add it
            await self._run_git("remote", "add", "origin", self.remote_url)
            return GitSyncResult(success=True, message="Remote origin added")

        # Clone into skills_dir (it may already have local skills)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

        # If directory has content, init + add remote instead of clone
        if any(self.skills_dir.iterdir()):
            await self._run_git("init")
            await self._run_git("remote", "add", "origin", self.remote_url)
            await self._run_git("fetch", "origin")
            return GitSyncResult(
                success=True,
                message="Initialized git in existing skills directory",
            )

        # Empty dir — clone directly
        parent = self.skills_dir.parent
        dir_name = self.skills_dir.name
        cmd = ["git", *self._config_args(), "clone", self.remote_url, dir_name]
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                cwd=str(parent),
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                raise GitSyncError(f"Clone failed: {result.stderr.strip()}")
        except FileNotFoundError:
            raise GitSyncError("git is not installed or not in PATH")

        return GitSyncResult(success=True, message="Repository cloned successfully")

    async def pull(self) -> GitSyncResult:
        """Pull latest from remote: fetch + reset --hard origin/main.

        Then resync the skill index if storage service is available.
        Auto-initializes the repository if not yet cloned.
        """
        self._check_configured()
        if not (self.skills_dir / ".git").is_dir():
            await self.init_or_clone()

        async with self._sync_lock:
            # Fetch
            await self._run_git("fetch", "origin")

            # Determine default branch
            branch = await self._get_default_branch()

            # Reset to remote
            result = await self._run_git("reset", "--hard", f"origin/{branch}")
            lines = result.stdout.strip().splitlines() if result.stdout else []

            # Resync index
            if self._skill_storage and hasattr(self._skill_storage, "resync_index"):
                await self._skill_storage.resync_index()

            return GitSyncResult(
                success=True,
                message=f"Pulled and reset to origin/{branch}",
                files_changed=len(lines),
            )

    async def push(
        self,
        message: str = "Sync skills",
        skill_names: list[str] | None = None,
    ) -> GitSyncResult:
        """Push skills to remote.

        If *skill_names* is provided, pushes exactly those directories.
        Otherwise falls back to skills with sync:true flag.
        Auto-initializes the repository if not yet cloned.
        """
        self._check_configured()
        if not (self.skills_dir / ".git").is_dir():
            await self.init_or_clone()

        async with self._sync_lock:
            # Determine which skills to push
            if skill_names:
                # Validate each name is an existing directory
                synced_paths = [
                    n for n in skill_names
                    if (self.skills_dir / n).is_dir()
                ]
            else:
                synced_paths = self._get_synced_skill_dirs()
            if not synced_paths:
                return GitSyncResult(
                    success=True,
                    message="No synced skills to push",
                )

            # Stage only synced skill directories
            for skill_path in synced_paths:
                await self._run_git("add", skill_path)

            # Also add _index.json if present
            index_path = self.skills_dir / "_index.json"
            if index_path.exists():
                await self._run_git("add", "_index.json")

            # Check if there's anything to commit
            status_result = await self._run_git("status", "--porcelain", check=False)
            staged = [
                line for line in status_result.stdout.splitlines()
                if line and line[0] in ("A", "M", "D", "R")
            ]
            if not staged:
                return GitSyncResult(success=True, message="Nothing to push")

            # Commit and push (local branch may differ from remote default)
            await self._run_git("commit", "-m", message)
            local_branch = await self._get_local_branch()
            remote_branch = await self._get_default_branch()
            await self._run_git("push", "origin", f"{local_branch}:{remote_branch}")

            return GitSyncResult(
                success=True,
                message=f"Pushed {len(staged)} change(s) to origin/{remote_branch}",
                files_changed=len(staged),
            )

    async def status(self) -> GitStatus:
        """Get current git status: local changes, ahead/behind counts."""
        git_status = GitStatus()

        if not (self.skills_dir / ".git").is_dir():
            git_status.error = "Not a git repository"
            return git_status

        git_status.initialized = True

        # Check remote
        remote_result = await self._run_git("remote", check=False)
        git_status.has_remote = bool(remote_result.stdout.strip())

        # Current branch
        branch_result = await self._run_git(
            "rev-parse", "--abbrev-ref", "HEAD", check=False
        )
        git_status.branch = branch_result.stdout.strip() if branch_result.returncode == 0 else ""

        # Local changes
        status_result = await self._run_git("status", "--porcelain", check=False)
        if status_result.returncode == 0 and status_result.stdout.strip():
            git_status.local_changes = [
                line.strip() for line in status_result.stdout.splitlines()
                if line.strip()
            ]

        # Ahead/behind (only if remote exists)
        if git_status.has_remote and git_status.branch:
            # Fetch first to get accurate counts
            await self._run_git("fetch", "origin", check=False)

            upstream = f"origin/{git_status.branch}"

            # Ahead
            ahead_result = await self._run_git(
                "rev-list", f"{upstream}..HEAD", "--count", check=False
            )
            if ahead_result.returncode == 0:
                git_status.ahead = int(ahead_result.stdout.strip() or "0")

            # Behind
            behind_result = await self._run_git(
                "rev-list", f"HEAD..{upstream}", "--count", check=False
            )
            if behind_result.returncode == 0:
                git_status.behind = int(behind_result.stdout.strip() or "0")

        # Last commit message
        log_result = await self._run_git(
            "log", "-1", "--format=%s", check=False
        )
        if log_result.returncode == 0:
            git_status.last_commit = log_result.stdout.strip()

        return git_status

    async def list_remote_skills(self) -> list[RemoteSkillEntry]:
        """List all skill directories in origin/{branch} by inspecting the remote ref.

        Uses ``git ls-tree`` to enumerate directories, then ``git show`` to
        extract metadata from each skill's ``_config.json`` and ``SKILL.md``.
        """
        self._check_configured()
        if not (self.skills_dir / ".git").is_dir():
            return []

        # Ensure we have fresh remote refs
        await self._run_git("fetch", "origin", check=False)
        branch = await self._get_default_branch()

        # List top-level directories in remote ref
        result = await self._run_git(
            "ls-tree", f"origin/{branch}", "--name-only", "-d",
            check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return []

        entries: list[RemoteSkillEntry] = []
        for dir_name in result.stdout.strip().splitlines():
            dir_name = dir_name.strip()
            if not dir_name or dir_name.startswith((".", "_")):
                continue

            entry = RemoteSkillEntry(name=dir_name)
            entry.exists_locally = (self.skills_dir / dir_name).is_dir()

            # Try to read _config.json from remote ref
            cfg_result = await self._run_git(
                "show", f"origin/{branch}:{dir_name}/_config.json",
                check=False,
            )
            if cfg_result.returncode == 0 and cfg_result.stdout.strip():
                try:
                    config = json.loads(cfg_result.stdout)
                    entry.categories = config.get("categories", [])
                    entry.status = config.get("status", "")
                    entry.sync = config.get("sync", False)
                    entry.description = config.get("description", "")
                except json.JSONDecodeError:
                    pass

            # Try to read SKILL.md frontmatter from remote ref
            md_result = await self._run_git(
                "show", f"origin/{branch}:{dir_name}/SKILL.md",
                check=False,
            )
            if md_result.returncode == 0 and md_result.stdout.strip():
                try:
                    from app.services.frontmatter import parse_frontmatter
                    fm = parse_frontmatter(md_result.stdout)
                    entry.display_name = fm.name or dir_name
                    if fm.description and not entry.description:
                        entry.description = fm.description
                except Exception:
                    pass

            entries.append(entry)

        return sorted(entries, key=lambda e: e.name)

    async def checkout_skill(self, name: str) -> GitSyncResult:
        """Checkout a specific skill directory from origin/{branch} to working tree."""
        self._check_configured()
        if not (self.skills_dir / ".git").is_dir():
            raise GitSyncError("Repository not initialized")

        branch = await self._get_default_branch()

        # Verify skill exists in remote
        check_result = await self._run_git(
            "ls-tree", f"origin/{branch}", "--name-only", "-d", check=False,
        )
        remote_dirs = check_result.stdout.strip().splitlines() if check_result.returncode == 0 else []
        if name not in [d.strip() for d in remote_dirs]:
            raise GitSyncError(f"Skill '{name}' not found in remote repository")

        async with self._sync_lock:
            await self._run_git("checkout", f"origin/{branch}", "--", f"{name}/")

            # Resync index so the new skill appears in local listing
            if self._skill_storage and hasattr(self._skill_storage, "resync_index"):
                await self._skill_storage.resync_index()

            return GitSyncResult(
                success=True,
                message=f"Checked out skill '{name}' from origin/{branch}",
            )

    async def delete_remote_skill(self, name: str, message: str = "") -> GitSyncResult:
        """Delete a skill from the repository and push the change.

        Uses ``git rm -r`` + commit + push.  Only operates on skills that exist
        in the remote tracking branch.
        """
        self._check_configured()
        if not (self.skills_dir / ".git").is_dir():
            raise GitSyncError("Repository not initialized")

        branch = await self._get_default_branch()

        # Verify skill exists in remote ref
        check_result = await self._run_git(
            "ls-tree", f"origin/{branch}", "--name-only", "-d", check=False,
        )
        remote_dirs = check_result.stdout.strip().splitlines() if check_result.returncode == 0 else []
        if name not in [d.strip() for d in remote_dirs]:
            raise GitSyncError(f"Skill '{name}' not found in remote repository")

        async with self._sync_lock:
            # Ensure the skill directory exists on disk so git rm works
            skill_dir = self.skills_dir / name
            if not skill_dir.is_dir():
                await self._run_git(
                    "checkout", f"origin/{branch}", "--", f"{name}/",
                    check=False,
                )

            await self._run_git("rm", "-r", f"{name}/")

            commit_msg = message or f"Delete skill '{name}'"
            await self._run_git("commit", "-m", commit_msg)

            local_branch = await self._get_local_branch()
            remote_branch = await self._get_default_branch()
            await self._run_git("push", "origin", f"{local_branch}:{remote_branch}")

            return GitSyncResult(
                success=True,
                message=f"Deleted skill '{name}' from remote repository",
            )

    # -- helpers ----------------------------------------------------------

    async def _get_local_branch(self) -> str:
        """Return the current local branch name."""
        result = await self._run_git(
            "rev-parse", "--abbrev-ref", "HEAD", check=False
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        return "main"

    async def _get_default_branch(self) -> str:
        """Detect the remote default branch (main or master)."""
        result = await self._run_git(
            "symbolic-ref", "refs/remotes/origin/HEAD", check=False
        )
        if result.returncode == 0:
            ref = result.stdout.strip()
            return ref.split("/")[-1]
        # Fallback: try main, then master
        for branch in ("main", "master"):
            check = await self._run_git(
                "rev-parse", "--verify", f"origin/{branch}", check=False
            )
            if check.returncode == 0:
                return branch
        return "main"

    def _get_synced_skill_dirs(self) -> list[str]:
        """Return relative paths of skill dirs with sync:true.

        Reads from _config.json on disk first.  Falls back to _index.json
        (which SkillStorageService maintains) so skills without a per-dir
        _config.json are still picked up.
        """
        synced: list[str] = []
        if not self.skills_dir.is_dir():
            return synced

        # Primary: per-skill _config.json
        seen: set[str] = set()
        for entry in sorted(self.skills_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith((".", "_")):
                continue
            config_path = entry / "_config.json"
            if config_path.exists():
                try:
                    with open(config_path, "r", encoding="utf-8") as f:
                        config = json.load(f)
                    seen.add(entry.name)
                    if config.get("sync", False):
                        synced.append(entry.name)
                except (json.JSONDecodeError, OSError):
                    continue

        # Fallback: _index.json (covers skills created without _config.json)
        index_path = self.skills_dir / "_index.json"
        if index_path.exists():
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index = json.load(f)
                for item in index:
                    name = item.get("name", "")
                    if name and name not in seen and item.get("sync", False):
                        skill_dir = self.skills_dir / name
                        if skill_dir.is_dir():
                            synced.append(name)
            except (json.JSONDecodeError, OSError):
                pass

        return sorted(set(synced))


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class GitSyncError(Exception):
    """General git sync error."""


class GitSyncNotConfigured(Exception):
    """Raised when FORGE_SKILLS_REPO_URL is not set."""
