```markdown
# tripcrew Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns, coding conventions, and collaborative workflows used in the `tripcrew` TypeScript codebase. The repository is organized for modular feature development, with a focus on clear commit conventions, type safety, and robust testing. It covers how to add new database tables, update TypeScript types, develop features in review-driven phases, manage API/server actions, implement validation, work on marketing/admin interfaces, write tests, and maintain documentation.

## Coding Conventions

- **File Naming:**  
  Use camelCase for file names.  
  _Example:_  
  ```
  src/lib/userProfile.ts
  src/components/marketing/landingHero.tsx
  ```

- **Import Style:**  
  Use alias imports for modules.  
  _Example:_  
  ```typescript
  import { getUser } from '@/lib/user'
  import { LandingHero } from '@/components/marketing/landingHero'
  ```

- **Export Style:**  
  Both named and default exports are used, depending on context.  
  _Example:_  
  ```typescript
  // Named export
  export function getUserProfile(id: string) { ... }

  // Default export
  export default function LandingHero() { ... }
  ```

- **Commit Messages:**  
  Follow [Conventional Commits](https://www.conventionalcommits.org/).  
  Prefixes include: `feat`, `chore`, `docs`, `test`, `refactor`.  
  _Example:_  
  ```
  feat(applications): add user application flow
  chore(phase 2): simplify admin queue logic
  ```

## Workflows

### Add New Database Table or Column
**Trigger:** When introducing a new data model or extending an existing one  
**Command:** `/new-table`

1. Create a new SQL migration file in `supabase/migrations/` with a timestamped name.
2. Define the new table or add columns in the migration SQL.
3. If needed, update related indexes or RLS (Row Level Security) policies.
4. Commit the migration file.

_Example migration filename:_  
```
supabase/migrations/20240612_add_trip_table.sql
```

### Update Types After Schema Change
**Trigger:** When adding or modifying a table/column in the database schema  
**Command:** `/update-types`

1. Edit `src/lib/types.ts` to add or update types for the new/changed schema.
2. Commit the updated types file.

_Example:_  
```typescript
// src/lib/types.ts
export type Trip = {
  id: string
  name: string
  startDate: string
  endDate: string
}
```

### Feature Development with Code Review Phases
**Trigger:** When building a new feature or iterating based on review  
**Command:** `/feature-phase`

1. Initial implementation: add feature files (routes, components, helpers, tests).
2. Commit with `feat(...)` or similar.
3. Apply code review feedback and simplifications in a follow-up commit labeled `chore(phase N): ...`.
4. Repeat as needed for each phase.

_Example:_  
```
feat(trips): implement trip creation flow
chore(phase 2): refactor trip form validation
```

### Add New API or Server Action
**Trigger:** When backend logic is needed for a new feature  
**Command:** `/new-action`

1. Create a new file in `src/lib/actions/` or `src/app/api/`.
2. Implement the server action or API route logic.
3. If needed, add related helpers or validators.
4. Commit the new/updated files.

_Example:_  
```typescript
// src/lib/actions/createTrip.ts
export async function createTrip(data: TripInput) { ... }
```

### Add or Update Validation Logic
**Trigger:** When adding a new form or validating new data structures  
**Command:** `/add-validator`

1. Create or update a Zod schema in `src/lib/validators/`.
2. Add or update tests in `src/lib/validators/__tests__/`.
3. Commit the validator and test files.

_Example:_  
```typescript
// src/lib/validators/trip.ts
import { z } from 'zod'
export const tripSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
})
```

### Add or Update Marketing or Public-Facing Components
**Trigger:** When updating the marketing site or public preview flows  
**Command:** `/update-marketing`

1. Create or update component(s) in `src/components/marketing/`.
2. Update or compose the landing page or public route in `src/app/(public)/`.
3. If needed, add or update helpers in `src/lib/marketing/`.
4. Commit the changes.

_Example:_  
```tsx
// src/components/marketing/LandingHero.tsx
export default function LandingHero() { ... }
```

### Add or Update Admin Interface
**Trigger:** When building or enhancing admin tools  
**Command:** `/admin-ui`

1. Create or update admin pages in `src/app/(app)/admin/`.
2. Create or update admin components in `src/components/admin/`.
3. Implement or update founder-gate logic in `src/lib/auth/`.
4. Commit the changes.

_Example:_  
```tsx
// src/app/(app)/admin/queue.tsx
export default function AdminQueue() { ... }
```

### Add or Update E2E or Content Guard Tests
**Trigger:** When ensuring new flows work or public content meets requirements  
**Command:** `/add-test`

1. Create or update a test spec in `tests/` (e.g., `applications-flow.spec.ts`).
2. Commit the test file.

_Example:_  
```typescript
// tests/applications-flow.spec.ts
import { test, expect } from '@playwright/test'
test('user can submit application', async ({ page }) => { ... })
```

### Add or Update Documentation and Specs
**Trigger:** When planning or documenting a new feature, flow, or pricing model  
**Command:** `/add-doc`

1. Create or update a markdown spec or plan in `docs/superpowers/specs/` or `docs/superpowers/plans/`.
2. If relevant, update `docs/pricing.md` or `roadmap.md`.
3. Commit the documentation file(s).

_Example:_  
```
docs/superpowers/specs/trip-creation.md
```

## Testing Patterns

- **Framework:** [Jest](https://jestjs.io/)
- **File Pattern:** `*.test.ts` (unit tests), `*.spec.ts` (E2E/content-guard tests)
- **Location:**  
  - Unit tests: next to source or in `__tests__/` subfolders  
  - E2E/content-guard: `tests/` directory

_Example:_  
```typescript
// src/lib/validators/__tests__/trip.test.ts
import { tripSchema } from '../trip'
test('valid trip', () => {
  expect(tripSchema.parse({ name: 'Alps', startDate: '2024-07-01', endDate: '2024-07-10' })).toBeTruthy()
})
```

## Commands

| Command           | Purpose                                                           |
|-------------------|-------------------------------------------------------------------|
| /new-table        | Add a new database table or column                                |
| /update-types     | Update TypeScript types after schema changes                      |
| /feature-phase    | Develop a feature in review-driven phases                        |
| /new-action       | Add a new API endpoint or server action                          |
| /add-validator    | Add or update validation logic with Zod schemas                  |
| /update-marketing | Add or update marketing/public-facing components                 |
| /admin-ui         | Add or update admin interface pages and logic                    |
| /add-test         | Add or update E2E/content-guard tests                            |
| /add-doc          | Add or update documentation, specs, or implementation plans      |
```
