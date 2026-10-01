# ADR-0009: Reach cameras through the site's video management system

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Platform lead, project manager
- **Supersedes:** [ADR-0008](0008-connect-to-cameras-directly-over-onvif-and-rtsp.md)

## Context

[ADR-0008](0008-connect-to-cameras-directly-over-onvif-and-rtsp.md) assumed the platform would
talk to cameras directly. Reading the site's camera documentation — the vendor's OpenAPI
reference, not a summary of it — showed otherwise:

- Cameras are registered in and managed by a **video management system (VMS)**. The VMS holds
  the camera credentials, the camera inventory and the operators' camera permissions.
- The cameras sit on an isolated video network. Application servers can reach the VMS, not the
  cameras; WS-Discovery multicast would never reach them.
- The VMS exposes an HTTP API to list cameras and their status, to request a stream URL for a
  camera (time-limited, served by the VMS's streaming gateway), and to send PTZ commands.

The direct approach was not just harder than planned: it was not possible on that network, and
would have duplicated an inventory and a permission model the site already maintains.

## Options

1. **Keep the direct approach and ask for network access to every camera** — fights the site's
   network design and security policy; even if granted, duplicates the VMS's inventory.
2. **Integrate through the VMS API** — the VMS remains the source of truth for cameras;
   the platform asks it for what it needs.
3. **Embed the VMS's own web player** in the console — fastest to show video, but a second
   login, no control over layout on the video wall, and no way to put video next to incidents
   in our own UI.

## Decision

Option 2.

- A new `CameraSource` implementation, `VmsCameraSource`, asks the VMS API for a stream URL
  when a camera is opened. MediaMTX pulls that URL from the VMS's streaming gateway and
  re-publishes it as WebRTC/HLS, exactly as before. The console keeps rendering whatever
  stream descriptor it is given; the only change on its side is to ask again on reconnect,
  because VMS stream URLs expire.
- The camera inventory (codes, names, positions, online status) is synchronised from the VMS
  on a schedule; the platform keeps only what it adds — which zone a camera belongs to on our
  map.
- PTZ goes through the VMS API, so the VMS's permission and audit rules apply.
- The VMS client is isolated behind the adapter, with a recorded fake of its API for tests and
  demos, so nothing else in the platform knows which VMS a site uses.

## Consequences

- Works with the site's network and security model instead of against it; no camera
  credentials in the platform.
- The change is one adapter implementation and a configuration value (`CAMERA_SOURCE=vms`,
  ticket OCC-28), because camera access has been behind the `CameraSource` port from the
  start. Without it this would be a rewrite of the camera feature.
- A runtime dependency on the VMS: if it is down, live video is down. That was already true for
  every other client of the cameras at the site.
- Process change: integration assumptions about client infrastructure are now confirmed
  against the vendor's own documentation and the site's network diagram before an ADR is
  accepted (see the [review checklist](../templates/design-review-checklist.md#problem)).

## Revisit when

A site has no VMS — then [ADR-0008](0008-connect-to-cameras-directly-over-onvif-and-rtsp.md)'s
direct approach is the fallback, as a second `CameraSource` implementation, not a replacement.
