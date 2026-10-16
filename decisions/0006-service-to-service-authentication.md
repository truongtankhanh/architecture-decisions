# ADR-0006: Service-to-service authentication

- **Status:** Proposed
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

The command center now requires an OIDC access token on every request (its ADR-0010), issued by
Keycloak, which the platform runs itself in every deployment — next to the API in Compose, and on
Fargate on AWS ([platform-aws ADR-0006](https://github.com/truongtankhanh/platform-aws/blob/main/docs/adr/0006-keycloak-on-fargate.md)).
The telemetry pipeline still calls it anonymously
([ADR-0003](0003-systems-integrate-through-public-apis-never-a-shared-database.md)), so its alerts
are recorded but no longer become incidents. The pipeline is not a user.

Constraints:

- Sites are often on an enclosed network. The identity provider may be reachable only through
  a proxy, or not from the server segment at all.
- Whoever operates the site rotates secrets by editing an environment file and restarting a
  container. Anything more elaborate will not be done on schedule.
- Incidents raised by a system must still be attributable in the timeline ("raised by
  telemetry-pipeline"), just as operator actions are attributed to people.

## Options

1. **OAuth 2.0 client credentials from the same identity provider** — the pipeline is
   registered as an application, fetches a short-lived token, and the API validates it like a
   user token. Standard, no long-lived secret on the wire. Depends on the identity provider
   being reachable from the server network, and on client IT registering the application.
2. **Platform-issued API keys** — an admin creates a key for a named system in the command
   center, with a role; the caller sends it as a bearer token; the API stores only a hash.
   Works fully offline. A long-lived secret that has to be rotated by hand.
3. **Mutual TLS between services** — strong, but certificate issuance and rotation at on-prem
   sites is more operational work than any site team will sustain.
4. **Network isolation only** (the API port is reachable only from known hosts) — no code at
   all, but no attribution either, and one misconfigured firewall rule exposes everything.

## Decision

**Proposed: option 1, with the platform's own Keycloak as the identity provider.**

The original proposal (platform-issued API keys first) assumed the identity provider was the
site's and might be unreachable from the servers. With Keycloak inside the platform it is always
reachable, so the standard option no longer has that cost.

- A confidential client `telemetry-pipeline` in the `occ` realm, client-credentials grant only,
  with a service account holding one role allowed to create and resolve incidents and read zones,
  and the `occ-api` audience mapper. The command center verifies its token like any other, so
  permission checks and timeline attribution ("raised by service-account-telemetry-pipeline") need
  no new code there.
- The pipeline fetches a token with its client secret, caches it until shortly before expiry, and
  sends it as a bearer token; a `401` refreshes once. The client secret is injected like the
  database password.
- Each incident request carries the alert id as `Idempotency-Key` (the command center's
  ADR-0009), which removes the duplicate-on-retry risk at the same time.

Open questions before acceptance:

- The service account's role: a new `integration` role (narrowest), or `technician`, which the
  command center already scopes to facilities and environment incidents.
- Who rotates the client secret, and how often (Keycloak can rotate it with a grace period).

## Consequences

- One credential type in the command center: everything is an OIDC token from the same issuer.
- A secret still exists — the client secret — but it is exchanged for short-lived tokens and never
  sent to the command center itself.
- The pipeline gains a token client (fetch, cache, refresh) and a dependency on Keycloak being up;
  while it is down, deliveries fail and the outbox retries with backoff, as for any outage.

## Revisit when

A site requires the pipeline to authenticate against its own directory instead of the platform's
Keycloak, or certificate-based workload identity becomes available at every site.
