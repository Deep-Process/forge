# 10-Dimension Feasibility Rubric

## 1. Technical — Can it be built with known methods and tools?

| Score | Definition |
|-------|------------|
| 1 | Requires breakthroughs or unproven technology. No known path. |
| 2 | Technically possible in theory, but not demonstrated at this scale/context. |
| 3 | Done before by others, but not by this team or in this exact context. |
| 4 | Well-understood techniques. Minor technical unknowns remain. |
| 5 | Standard, proven approach. Team has done this before. |

## 2. Resource — Are people, money, and materials available?

| Score | Definition |
|-------|------------|
| 1 | Critical resources missing with no path to acquire them. |
| 2 | Significant resource gaps. Acquisition is uncertain or slow. |
| 3 | Most resources available. Some gaps require effort to fill. |
| 4 | Resources available with minor adjustments or procurement. |
| 5 | All resources in hand and committed. |

## 3. Knowledge — Does the team know how to do this?

| Score | Definition |
|-------|------------|
| 1 | Team lacks fundamental knowledge. No one on the team has relevant experience. |
| 2 | Team has adjacent knowledge but significant learning curve ahead. |
| 3 | Team knows the domain but not this specific problem. Training needed. |
| 4 | Team has relevant experience. Minor skill gaps only. |
| 5 | Team has deep expertise. Has done this exact type of work before. |

## 4. Organizational — Will the org structure support this?

| Score | Definition |
|-------|------------|
| 1 | Active organizational resistance. Political blockers. No sponsor. |
| 2 | Weak sponsorship. Competing priorities. Unclear ownership. |
| 3 | Sponsorship exists but priorities may shift. Some org friction expected. |
| 4 | Good sponsorship and alignment. Minor coordination challenges. |
| 5 | Full org alignment. Strong sponsor. Clear ownership and authority. |

## 5. Temporal — Can it be done in the stated timeframe?

| Score | Definition |
|-------|------------|
| 1 | Timeline is physically impossible given scope. |
| 2 | Timeline requires everything to go perfectly. No slack. |
| 3 | Timeline is tight but achievable if major risks don't materialize. |
| 4 | Timeline is reasonable with some buffer for problems. |
| 5 | Timeline is comfortable. Significant margin for delays. |

## 6. Compositional — Do the parts work together as a system?

| Score | Definition |
|-------|------------|
| 1 | Components are fundamentally incompatible or untested together. |
| 2 | Integration is theoretically possible but complex and unproven. |
| 3 | Components can integrate with significant effort. Some interfaces unclear. |
| 4 | Integration path is clear. Minor interface work needed. |
| 5 | Components are designed to work together. Integration is straightforward. |

## 7. Economic — Does the cost-benefit math work?

| Score | Definition |
|-------|------------|
| 1 | Costs vastly exceed benefits. No realistic ROI path. |
| 2 | ROI is marginal or depends on optimistic assumptions. |
| 3 | ROI is positive under reasonable assumptions. Payback period is long. |
| 4 | Clear positive ROI. Payback within acceptable timeframe. |
| 5 | Strong ROI. Benefits significantly exceed costs even in pessimistic scenarios. |

## 8. Scale — Does it work at the required scale?

| Score | Definition |
|-------|------------|
| 1 | Approach fundamentally doesn't scale to the required level. |
| 2 | Scaling requires solving hard, unsolved problems. |
| 3 | Scaling path exists but requires significant engineering/effort. |
| 4 | Scales with known techniques. Minor adjustments needed. |
| 5 | Already proven at this scale or larger. |

## 9. Cognitive — Can the team manage the complexity?

| Score | Definition |
|-------|------------|
| 1 | Complexity exceeds any team's capacity. Too many moving parts to track. |
| 2 | Requires exceptional coordination. High risk of dropped balls. |
| 3 | Manageable with strong project discipline and tooling. |
| 4 | Complexity is within normal range for this type of team. |
| 5 | Straightforward. Few moving parts. Easy to keep track of. |

## 10. Dependency — Are external dependencies reliable?

| Score | Definition |
|-------|------------|
| 1 | Critical dependencies on unreliable or uncommitted external parties. |
| 2 | Key dependencies with uncertain reliability or availability. |
| 3 | Dependencies exist but are mostly reliable. Backup options for some. |
| 4 | Few external dependencies. Those that exist are reliable and committed. |
| 5 | No critical external dependencies, or all are highly reliable with SLAs. |

## Verdict Rules

| Condition | Verdict |
|-----------|---------|
| Any dimension scores 1 | **NO-GO** — binding constraint identified |
| Average of all 10 dimensions < 2.5 | **NO-GO** — too many weak areas |
| Average 2.5 - 3.5, conditions addressable | **CONDITIONAL GO** |
| Average > 3.5, no dimension scores 1 | **GO** |

A single score of 1 is a hard stop regardless of how strong other dimensions
are. You cannot compensate for a binding constraint with strength elsewhere.
