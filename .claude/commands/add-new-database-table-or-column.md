---
name: add-new-database-table-or-column
description: Workflow command scaffold for add-new-database-table-or-column in tripcrew.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-database-table-or-column

Use this workflow when working on **add-new-database-table-or-column** in `tripcrew`.

## Goal

Adds a new table or column(s) to the database schema, typically for new features or data models.

## Common Files

- `supabase/migrations/*.sql`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create a new SQL migration file in supabase/migrations/ with a timestamped name.
- Define the new table or add columns in the migration SQL.
- If needed, update related indexes or RLS policies.
- Commit the migration file.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.