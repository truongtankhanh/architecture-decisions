# ADR-0001: Record platform decisions separately from system decisions

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

The platform is made of independently deployed systems, each in its own repository:
[ops-command-center](https://github.com/truongtankhanh/ops-command-center) (incidents, map,
cameras) and [iot-telemetry-pipeline](https://github.com/truongtankhanh/iot-telemetry-pipeline)
(sensor data, alerts). Each already keeps ADRs for its internal choices.

Some decisions belong to no single repository: how the systems talk to each other, how users
sign in to all of them, what every service must expose for monitoring, where they run. Written
inside one system's repository, these get lost or are silently contradicted by the other
system. Kept in meeting notes, they are rediscovered at every new joiner's onboarding.

## Options

1. **Platform decisions inside the "main" system's repository** — no new repository, but the
   other systems have to look in a neighbour's docs for their own rules, and that repository's
   reviewers become gatekeepers for decisions that are not theirs.
2. **A wiki** — easy to edit, but not reviewed, not versioned with the decision's discussion,
   and drifts from reality without anyone noticing.
3. **A dedicated repository for platform decisions, ADRs stay in system repositories for
   internal choices** — two places to look, but each record lives next to the people who can
   change it.

## Decision

Option 3. This repository holds platform-level decisions and the C4 views of the whole
platform. Each system keeps its own `docs/adr/` for choices it can change alone. The rule for
which level a decision belongs to is in [the process](../docs/process.md#two-levels-of-records).

Records are Markdown in the format of [the template](../templates/adr.md), proposed by pull
request, and checked in CI (`npm run check`): numbering, statuses, supersession links in both
directions, broken links, and an up-to-date index.

## Consequences

- Cross-system rules have one owner and one review path.
- A reader needs both places for the full picture; the README indexes the system-level records
  to make that one click.
- Accepted records are not edited apart from their status, typos and links. Changing a decision
  costs a new record, which is intended: the history of _why_ is the point.
- The checks catch structure, not substance. Review is still where a bad decision is stopped.

## Revisit when

There are more than about five systems or more than one team proposing platform decisions —
then a lightweight RFC step before the ADR may be worth its cost.
