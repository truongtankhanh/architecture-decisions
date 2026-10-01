# ADR-0002: One repository per system, a monorepo inside each

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

The platform has two systems with different shapes:

- **Command center** — an API and an operator console (a video wall is planned) that must
  agree on the same types and event names at every commit.
- **Telemetry pipeline** — a headless ingest service plus a device simulator, scaled
  horizontally, released on its own cadence.

They share one integration: telemetry alerts become command-center incidents. They share no
code beyond that contract, and they are deployed and scaled differently
([ADR-0007](0007-compose-on-a-single-host-kubernetes-only-where-scale-needs-it.md)).

## Options

1. **One monorepo for the whole platform** — atomic changes across systems, one CI. But every
   pipeline change runs the console's tests, release cadences couple, and the boundary between
   systems becomes a folder that is easy to reach across.
2. **One repository per deployable** (API, console, ingest, simulator, contracts…) — maximum
   isolation, but the API and console then need a published contracts package and a release
   cycle for every enum change. That is the coordination cost the monorepo removes.
3. **One repository per system, monorepo inside it** — atomic changes where things change
   together; a hard boundary where they do not.

## Decision

Option 3. A **system** — the set of deployables owned by one team, released together, sharing
a data store — gets one repository. Inside it, pnpm workspaces and Turborepo hold apps and
shared packages (detail: ops-command-center
[ADR-0001](https://github.com/truongtankhanh/ops-command-center/blob/main/docs/adr/0001-monorepo-pnpm-turborepo.md)).

Between systems, the only shared artefact is the published API contract
([ADR-0004](0004-openapi-is-the-contract-between-systems.md)). No package is imported across
system repositories.

## Consequences

- Inside a system, a contract change and both sides of it land in one pull request.
- Across systems, a contract change is a versioned API change with a deprecation window — more
  ceremony, deliberately, because the other side deploys on its own schedule.
- Each repository has the same toolchain (Node 24, pnpm, Turborepo, ESLint, Prettier, GitHub
  Actions), so moving between them costs nothing; this is a convention, not shared code.
- Duplication is accepted: the telemetry pipeline has its own small HTTP client for the
  command center rather than importing the console's.

## Revisit when

Two systems start changing together in most pull requests — the boundary is in the wrong place.
