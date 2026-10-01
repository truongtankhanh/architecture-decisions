# ADR-0007: Compose on a single host; Kubernetes only where scale needs it

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead, project manager

## Context

The platform is installed at the operator's site, not in a public cloud: camera streams and
building data are not allowed to leave the site network, and the control room must keep
working when the internet link does not. "On-prem" decides _where_ it runs; it does not decide
_how_.

What the systems need:

| System         | Load                                               | Scaling need                   | Downtime tolerance                |
| -------------- | -------------------------------------------------- | ------------------------------ | --------------------------------- |
| Command center | tens of operators, a handful of screens            | none — one instance is plenty  | minutes, during a planned upgrade |
| Telemetry      | from hundreds of messages/s up to campus-wide load | horizontal, by adding replicas | none for ingest; brokers buffer   |

Who operates it matters as much: at many sites the people upgrading the system are the
client's IT staff, not developers, often working from a runbook.

Real-time media (RTSP, WebRTC) uses UDP and is sensitive to extra network hops.

## Options

1. **Kubernetes everywhere** — one deployment model, self-healing, rolling updates. Requires a
   cluster at every site and people who can operate one; for the command center it adds a
   control plane larger than the application.
2. **Docker Compose everywhere** — one host, one file, a runbook anyone can follow. No
   horizontal scaling and no rolling updates.
3. **Compose by default; Kubernetes for the components whose load requires it** — each system
   picks the smallest model that meets its needs, against stated criteria.

## Decision

Option 3. **Docker Compose on a single host is the default** for every system. A component
moves to Kubernetes only when at least one of these holds:

- it needs more than one replica to carry its expected load, or
- it must stay available during upgrades and its protocol allows another replica to take over,
  or
- the site already runs a Kubernetes cluster that its own team operates.

Applied today:

- **Command center → Compose.** API, console (nginx serving the static build and proxying
  `/api` and `/socket.io`, so one origin and no CORS) and PostgreSQL; MediaMTX joins the same file
  for real video (OCC-15), with host networking for UDP.
- **Telemetry pipeline → Compose for small sites, Kubernetes manifests for large ones.** The
  ingest service is stateless and scales by MQTT shared subscription, so it is the component
  that benefits; its manifests carry probes, an HPA and a PodDisruptionBudget, and are
  validated in CI.

Every system, whichever model it uses, must: start from configuration in environment variables
validated at boot, run its own database migrations on start, and drain in-flight work on
`SIGTERM`.

## Consequences

- The command center installs on one machine from one file; upgrades are
  `docker compose pull && docker compose up -d` and take a short, announced maintenance window.
- Two deployment models to support. Contained by the shared service rules above — the same
  image runs under both.
- No automatic failover for the command center. Accepted: a host failure is recovered by
  restoring onto a standby host from backup, which must be rehearsed.
- Scaling the command center later means the Kubernetes path, not a redesign: the API is
  already stateless apart from PostgreSQL and Socket.IO, which would need a Redis adapter.

## Revisit when

A site needs the command center to survive a host failure without a manual restore, or a site
standardises on Kubernetes and offers to operate it.
