# ADR-0010: An observability baseline every service meets

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

The platform runs at sites where developers have no standing access. When something goes
wrong, the first people to look are the site's IT staff, with whatever the systems expose; the
next are us, through a remote session arranged by the client. Whatever a service does not
expose at that moment is effectively not knowable.

Integration failures are the hardest case. When an alert does not become an incident, the
symptom is in the command center (no incident), the cause is in the pipeline (a failed
delivery), and nothing ties the two together today.

The telemetry pipeline's benchmark showed why measuring matters: the broker silently dropped
10 % of a burst under default settings, and the only reason anyone knew was a sequence-gap
metric ([benchmarks](https://github.com/truongtankhanh/iot-telemetry-pipeline/blob/main/docs/benchmarks.md#what-the-gap-metric-caught)).

## Options

1. **Each system decides for itself** — no coordination cost; every site runbook is different,
   and cross-system failures stay untraceable.
2. **A full observability stack as a platform requirement** (tracing backend, log aggregation,
   dashboards) — the right end state for large sites, heavy for a single-host install.
3. **A small baseline every service must meet, that works with nothing else installed, and
   plugs into a stack where one exists.**

## Decision

Option 3. Every service exposes:

| Signal          | Requirement                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Liveness**    | `GET /api/health` — the process is up. Never checks dependencies, so a database outage does not cause restarts.                                     |
| **Readiness**   | `GET /api/ready` — dependencies reachable and migrations applied; fails while draining on shutdown.                                                 |
| **Metrics**     | `GET /metrics` in Prometheus format: request rate, errors and latency, plus the service's own business signals (queue depth, gaps, delivery state). |
| **Logs**        | One JSON object per line on stdout: time, level, message, service, and the correlation id when there is one. No log files inside containers.        |
| **Correlation** | Accept `X-Request-Id`, generate one if absent, return it, log it, and pass it on every call to another system.                                      |

Cross-system calls (the alert outbox) store the correlation id of the delivery alongside the
remote id they get back, so "alert → delivery attempt → incident" can be followed across both
systems' logs.

Each system's runbook lists its metrics with what a bad value looks like and the first thing
to check.

### Adoption

| Requirement          | Command center   | Telemetry pipeline                     |
| -------------------- | ---------------- | -------------------------------------- |
| Liveness / readiness | health only      | ✓                                      |
| Prometheus metrics   | planned (OCC-24) | ✓ throughput, rejections, gaps, outbox |
| JSON logs            | planned (OCC-23) | not yet                                |
| Correlation ids      | planned (OCC-23) | not yet                                |

## Consequences

- A site with nothing but `curl` can tell whether each service is up, ready and keeping up.
- A site with Prometheus and Grafana gets dashboards without any change to the services.
- Following one alert across both systems becomes possible once both sides carry correlation
  ids; until then it relies on the alert id the pipeline writes into the incident description.
- The baseline is a floor, not a ceiling. Distributed tracing (OpenTelemetry) is left out on
  purpose until a site has a backend to send traces to.

## Revisit when

A site provides a central log and trace platform — then add OpenTelemetry export, keeping the
endpoints above for sites without one.
