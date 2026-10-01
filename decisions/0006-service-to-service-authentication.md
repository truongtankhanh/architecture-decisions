# ADR-0006: Service-to-service authentication

- **Status:** Proposed
- **Date:** 2026-10-01
- **Deciders:** Platform lead, client IT (for option 1)

## Context

Today the command center's API has no authentication, and the telemetry pipeline calls it
anonymously ([ADR-0003](0003-systems-integrate-through-public-apis-never-a-shared-database.md)).
That is acceptable in a demo and unacceptable at a site. Once user sign-in arrives
([ADR-0005](0005-single-sign-on-for-identity-roles-owned-by-the-platform.md)), every endpoint
will require a user — and the pipeline is not a user.

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

**Proposed: option 2, with option 1 as the target where the identity provider is reachable.**

- The command center gains **service accounts**: a named, non-human principal with a role
  (an `integration` role allowed to create and resolve incidents and read zones, nothing else).
- An admin issues a key for a service account in the admin screen; the key is shown once, and
  only its hash is stored. Keys have an expiry and can be revoked.
- Callers send `Authorization: Bearer <key>`. The API's auth layer resolves either an OIDC user
  token or a service-account key to the same principal shape, so permission checks and
  timeline attribution are written once.
- Where a site's identity provider is reachable from the servers, the same service account can
  instead be bound to an OAuth client, and the pipeline uses client credentials. The caller's
  configuration decides which; the API accepts both.

Open questions before acceptance:

- Does the first real site allow outbound access from the server segment to the identity
  provider? Decides whether option 1 is usable at all.
- Who at the site owns key rotation, and on what schedule?

## Consequences

- Works on day one at an offline site, with no dependency on client IT.
- Introduces long-lived secrets. Mitigated by hashing, expiry, revocation and the narrow role,
  not eliminated.
- Two credential types in the auth layer. Kept manageable by resolving both to one principal
  type at the edge.

## Revisit when

All sites can reach their identity provider from the server network — then drop API keys and
keep only client credentials.
