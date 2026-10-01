# ADR-0011: AI-assisted delivery with human review gates

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

Coding agents write much of the code in these repositories. Used as a chat — "here is the
ticket, implement it" — they produce plausible changes that are expensive to review:
the reviewer sees the result, not the understanding or the plan behind it, and scope creeps
into files nobody asked to touch.

The platform's quality bar does not change with who types the code: changes are scoped to a
ticket, tested, reviewed by a person, and explainable in the commit history a year later.

## Options

1. **No AI tooling** — predictable, and gives up a real speed-up on routine work.
2. **Free-form use, each developer's own way** — fast for the individual; review quality and
   repository conventions vary with every prompt.
3. **Staged pipelines with written artifacts and human gates** — the agent works in steps
   (understand → plan → change → prove), each step writes a Markdown artifact and stops, and a
   person reads it before the next step runs.

## Decision

Option 3, using the pipelines published as
[claude-code-pipelines](https://github.com/truongtankhanh/claude-code-pipelines):

- **Tickets** go through analyze → plan → apply → verify. The plan lists every file that may
  change; the apply step is not allowed outside it.
- **Self-review before a pull request** is scoped to the lines the branch changed.
- **API documentation** is generated from code and reconciled on each run
  ([ADR-0004](0004-openapi-is-the-contract-between-systems.md)).
- **The tool never commits or pushes.** A person stages, commits and opens the pull request,
  and normal review applies — an AI-written change gets the same review as any other.
- Repository rules (`CLAUDE.md`, lint, formatting, these ADRs) take precedence over the
  pipelines' own defaults.

## Consequences

- Reviewers read a short plan before any code exists, which is where scope and approach are
  cheapest to correct.
- Each change leaves a trail — analysis, plan, verification evidence — that explains it after
  the fact; the published examples link those artifacts to the commits they produced.
- Slower than free-form prompting for trivial changes; the pipelines are for work that deserves
  a plan, and small fixes are done directly.
- The artifacts are working files, not documentation; they are not committed to product
  repositories, so the durable record is still the pull request and, for decisions, an ADR.

## Revisit when

Review starts finding problems the verify stage should have caught — then strengthen the
verify step's checks rather than adding more human review.
