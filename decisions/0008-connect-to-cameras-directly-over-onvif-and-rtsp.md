# ADR-0008: Connect to cameras directly over ONVIF and RTSP

- **Status:** Superseded by [ADR-0009](0009-reach-cameras-through-the-site-s-video-management-system.md)
- **Date:** 2026-10-01
- **Deciders:** Platform lead

## Context

The command center shows live video next to every incident. Sites use IP cameras that support
ONVIF (discovery, pan-tilt-zoom) and RTSP (streaming). Browsers cannot play RTSP, so a media
server has to re-publish streams as HLS or WebRTC.

The working assumption at the time: the application servers and the cameras share a routable
network, and the platform is given camera credentials.

## Options

1. **Direct: ONVIF discovery + RTSP pulled by MediaMTX** — find cameras with WS-Discovery,
   read their RTSP URLs over ONVIF, have MediaMTX pull and re-publish them. Vendor-neutral.
2. **Vendor SDK per camera brand** — richer features, one integration per brand.
3. **Through a video management system (VMS)** — not considered: no VMS was known to be in
   place.

## Decision

Option 1. The command center's `CameraSource` adapter gets an implementation that resolves a
camera to a MediaMTX path fed from the camera's RTSP URL
([ops-command-center ADR-0002](https://github.com/truongtankhanh/ops-command-center/blob/main/docs/adr/0002-camera-source-adapter.md)).

## Consequences

- No dependency on any camera vendor.
- The platform holds camera credentials and needs a network path to every camera.
- Depends on the working assumption above, which had not been confirmed with the site.

## Revisit when

The site's camera infrastructure is confirmed.
