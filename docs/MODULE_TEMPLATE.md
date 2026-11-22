# Module name

[Documentation index](README.md)

Copy this structure into modules/<module-name>.md and adjust relative links.
Document implemented behavior, not proposed features presented as complete.

## Purpose and access

State the business purpose, frontend route (if any), and intended users.

## Workflow and fields

Describe create/edit/actions, required inputs, automatic values and state transitions.
Identify downstream effects such as stock, payment, audit or notification writes.

## API and authorization

List declared methods/paths and backend permissions. Explicitly identify missing
CRUD operations or API-only resources. Paths are relative to /api/v1.

## Data and invariants

Name tables, relationships, transaction/locking requirements and deletion guards.
Distinguish internal IDs from user-facing names and business references.

## Sources

Link the relevant routes, controller, Form Request, service, model and frontend.

## Limitations and verification

Document scope limits, integration assumptions and important regression cases.
Separate code review, automated verification and actual live acceptance results.
Never include credentials or run database resets as a documentation step.
