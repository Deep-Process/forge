# Example Skills — Curated Reference Library

Skill collections curated for Forge core orchestration and FX_code_AI stack
(Next.js 14 + React 18 + TypeScript + Zustand + FastAPI + Python 3.11 + Redis Stack 7.4).

## Structure

```
example_skills/
├── orchestration/          ← Forge core improvement reference
│   ├── claude-workflow/    ← Multi-agent orchestration (51 files)
│   ├── deep-loop-plugin/   ← Deterministic dev loops (45 files)
│   └── jeeves/             ← Evidence-based code review (15 files)
│
├── stack-skills/           ← FX_code_AI development reference
│   ├── react-nextjs-rules/ ← React 62 rules + composition + web design guidelines
│   ├── fullstack-experts/  ← 22 skills: react, next, ts, fastapi, python, testing, architecture
│   └── plugin-patterns/    ← Plugin dev (7 skills), frontend-design, code-review, LSP
│
└── planning/               ← Forge workflow improvement reference
    └── product-management/ ← Interactive skill pattern, discovery, epic breakdown, user stories
```

## orchestration/

Reference for improving Forge's pipeline, review, and multi-agent features.

| Directory | Key concepts to steal |
|-----------|-----------------------|
| `claude-workflow/` | Proof artifacts per task, concern-partitioned review (security/correctness/spec), auto-fix loop (test fail → bug-fixer → retest), 6-gate validation with coverage matrix, worktree task isolation |
| `deep-loop-plugin/` | Complexity triage (QUICK/STANDARD/DEEP auto-routing), decision drift detection (implementation vs decisions.json), post-tool validators (JSON/CSV/SQL/Python/TypeScript), concurrent worktree workers with merge queue |
| `jeeves/` | 4-phase PR review (evidence → requirements → review → self-audit), security blast radius analysis, evidence-grounding ("if you can't cite code, don't claim it"), SonarQube gate integration |

## stack-skills/

Reference for writing better code in FX_code_AI's tech stack.

| Directory | Contents |
|-----------|----------|
| `react-nextjs-rules/` | 62 React performance rules (Vercel Engineering), 7 composition patterns, 100+ web design/accessibility guidelines |
| `fullstack-experts/` | 22 expert skills with 5-7 deep reference files each: react-expert, nextjs-developer, typescript-pro, fastapi-expert, python-pro, playwright-expert, api-designer, test-master, architecture-designer, the-fool (critical thinking), security-reviewer, etc. |
| `plugin-patterns/` | plugin-dev (hooks, MCP, commands, agents, skills — 7 skills), frontend-design, code-review, code-simplifier, pr-review-toolkit, security-guidance, pyright-lsp, typescript-lsp |

## planning/

Reference for improving Forge's /discover, /plan, and skill architecture.

| Directory | Contents |
|-----------|----------|
| `product-management/` | Interactive skill architecture (CLAUDE.md — 520 lines on skill types), discovery-process (6 phases), epic-breakdown-advisor (9 splitting patterns), context-engineering-advisor (764 lines), user-story + splitting patterns, roadmap-planning, opportunity-solution-tree |

## Stats

- **726 files** across 3 categories, 7 collections
- Curated from ~2500 original files (71% removed)
