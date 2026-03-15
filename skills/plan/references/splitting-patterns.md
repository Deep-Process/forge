# Task Splitting Patterns

9 named strategies for decomposing goals into tasks. Apply sequentially — stop when one fits.

**Core rule**: Every task must be a **vertical slice** (end-to-end value). Never split by technical layer (frontend/backend/tests).

## The Patterns

### 1. Workflow Steps
Split by thin end-to-end slices through the user journey.
- **Right**: "Publish post (simple, no review)" → "Add editorial review" → "Add legal approval"
- **Wrong**: "Build editorial review" → "Build legal approval" → "Build publish" (no end-to-end value per task)

### 2. CRUD Operations
The word "manage" signals this. Split into Create, Read, Update, Delete.
- "Manage user profiles" → Create profile / View profile / Edit profile / Delete profile

### 3. Business Rule Variations
Same feature, different rules = different tasks.
- "Apply discount" → Member discount (10%) / VIP discount (20%) / First-time discount (5%)

### 4. Data Variations
Different data types handled separately.
- "Geographic search" → Search by county / Add city search / Add custom area search

### 5. Data Entry Methods
Simple input first, fancy UI later.
- "Date picker search" → Basic text input (YYYY-MM-DD) / Add calendar picker UI

### 6. Major Effort
First implementation is hard, additions are trivial. "Implement one + add rest."
- "Accept payments (Visa, MC, Amex)" → Accept Visa (build infrastructure) / Add MC + Amex

### 7. Simple/Complex
Simplest complete version first, then add variations.
- "Flight search with filters" → Basic search (origin, dest, date) / Add max stops / Add nearby airports

### 8. Defer Performance
Make it work, then make it fast.
- "Real-time search <100ms" → Search works (no perf guarantee) / Optimize to <100ms

### 9. Spike
Last resort when uncertainty blocks splitting. Time-boxed investigation, then re-split.
- Use `type: "investigation"` in Forge. After spike, restart at Pattern 1.

## Anti-patterns

| Anti-pattern | Why it fails |
|-------------|-------------|
| Horizontal slicing ("API task" + "UI task") | Neither delivers observable user value |
| Step-by-step workflow ("Step 1 task" + "Step 2 task") | Early tasks don't deliver end-to-end value |
| One giant task with sub-bullets | Not independently testable or trackable |
| Splitting investigation from implementation without spike | Investigation task has no acceptance criteria |

## Meta-pattern

For any pattern: (1) identify core complexity, (2) list variations, (3) reduce to one complete slice, (4) make other variations separate tasks.

## When to re-split

If any task is still >3 days of work after splitting, restart at Pattern 1 for that task.

Source: Richard Lawrence & Peter Green, *Humanizing Work Guide to Splitting User Stories*.
