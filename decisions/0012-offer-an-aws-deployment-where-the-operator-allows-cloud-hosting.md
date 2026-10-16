# ADR-0012: Offer an AWS deployment where the operator allows cloud hosting

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Platform lead

## Context

[ADR-0007](0007-compose-on-a-single-host-kubernetes-only-where-scale-needs-it.md) sets the
default: the platform runs at the site, on one host with Compose, because camera streams and
building data must not leave the site network and the control room must work without the
internet. That holds for the sites it was written for.

Other operators — campuses with several buildings, operators without a server room, teams that
want managed databases and no hardware to look after — allow cloud hosting, and some require it.
For them a single on-premises host is the weaker choice: it is the single point of failure
ADR-0007 accepts (risk R3), and its upgrades are manual.

## Options

1. **On-premises only** — one deployment model, but no answer for operators who want managed
   hosting, and no way out of R3.
2. **Kubernetes manifests, any cloud** — portable on paper, but every managed piece the platform
   needs (database, MQTT broker with device identity, edge, secrets, identity) differs per cloud,
   and the team would operate a cluster.
3. **A second target on AWS, as code**, using managed services where they exist, and the same
   service images as on premises.

## Decision

Option 3: [platform-aws](https://github.com/truongtankhanh/platform-aws), an AWS CDK app that
deploys both systems in a stage, with:

- ECS Fargate for the services, RDS PostgreSQL with one database and login per system (keeping
  [ADR-0003](0003-systems-integrate-through-public-apis-never-a-shared-database.md)), AWS IoT
  Core as the broker, CloudFront as the single public origin, Keycloak on Fargate as the identity
  provider, Secrets Manager for every secret, CloudWatch for logs, metrics and alarms.
- **The same images** as on premises, with a thin platform layer (the RDS certificate
  authorities). A capability AWS needs is added to the service itself, behind configuration —
  never as an AWS-only fork.
- The cross-system rules still apply: integration through public APIs
  ([ADR-0003](0003-systems-integrate-through-public-apis-never-a-shared-database.md)), OpenAPI
  contracts ([ADR-0004](0004-openapi-is-the-contract-between-systems.md)), the observability
  baseline ([ADR-0010](0010-an-observability-baseline-every-service-meets.md)).

[ADR-0007](0007-compose-on-a-single-host-kubernetes-only-where-scale-needs-it.md) stays the default
for sites that keep everything on premises; this record adds a target, it replaces nothing.

## Consequences

- Two deployment targets to keep working. The shared rules in ADR-0007 (configuration from the
  environment, migrations on start, drain on `SIGTERM`) are what make one image serve both.
- AWS IoT Core required changes in the pipeline (client certificates, several connections per
  replica), now part of the pipeline for any broker that needs them.
- Two integrations are not connected on AWS yet, for reasons that apply on premises too: the
  command center's own MQTT telemetry (no client certificates yet) and alert delivery from the
  pipeline (needs [ADR-0006](0006-service-to-service-authentication.md)).
- For video, the cloud deployment reaches the site's media relay over a private link; live video
  does not move to the cloud.

## Revisit when

Operators ask for a cloud other than AWS — then the second target is written for that cloud, with
the same rule about images and capabilities.
