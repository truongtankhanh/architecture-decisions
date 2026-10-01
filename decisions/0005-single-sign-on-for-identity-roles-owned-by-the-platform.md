# ADR-0005: Single sign-on for identity, roles owned by the platform

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead, project manager

## Context

Operators, supervisors and viewers need to sign in to the command center (and later the video
wall and any telemetry dashboards). The organisations that run sites like this already have an
identity provider — typically Microsoft Entra ID or another OpenID Connect provider — and a
policy that staff accounts are created and removed there, not in each application.

What the platform needs to know about a user goes beyond who they are: whether they may
acknowledge incidents, which zones they see, whether they can control a camera. Those
permissions change with the platform's features, on the platform's release cycle.

In practice, getting a group structure created or changed in a client's directory goes through
the client's IT change process and takes weeks. Application roles change far more often than
that in the first year of a system.

## Options

1. **Local accounts with passwords** — full control, but a second identity for every staff
   member, password resets become our support burden, and leavers are not removed when HR
   removes them. Usually against the client's policy outright.
2. **SSO, with roles taken from directory groups** — one source of truth, but every role change
   becomes a change request to the client's IT, and the platform's permission model is limited
   to what the directory can express.
3. **SSO for authentication only; roles and permissions stored and managed in the platform** —
   the directory says _who_; the platform says _what they may do_.

## Decision

Option 3.

- Users sign in through the organisation's identity provider over **OpenID Connect**
  (authorisation code flow with PKCE). The platform stores no passwords.
- On first sign-in a user record is created from the token's stable subject identifier, with
  **no role**: they can sign in but see nothing until an administrator assigns one.
- Roles (`operator`, `supervisor`, `viewer`, plus `admin` for user and role management) and
  their permissions live in the platform's own database and are managed in its admin screens.
  Permission checks are done in the API on every action; the console hides what the user
  cannot do, but is never the guard.
- Every state change records the acting user on the incident timeline.
- A user disabled in the directory cannot sign in, which is enough for leavers; the platform
  does not need to sync deletions.

Implementation is planned in the command center's M3 (OCC-21, OCC-22).

## Consequences

- No credentials to store, rotate or reset; joiners and leavers follow the client's process.
- Role changes are immediate and do not involve the client's IT.
- Two places to look when someone "cannot see anything": the directory (can they sign in?) and
  the platform (do they have a role?). The admin screen shows the last sign-in to make this
  quick to diagnose.
- New users wait for a role assignment. That is deliberate — least privilege by default — and
  needs an admin on the client side who knows to do it.
- Access for other _systems_ (not people) is a separate question:
  [ADR-0006](0006-service-to-service-authentication.md).

## Revisit when

A client requires role assignment to be driven by their directory for audit reasons — then
map groups to roles at sign-in, keeping the platform's role model as the target.
