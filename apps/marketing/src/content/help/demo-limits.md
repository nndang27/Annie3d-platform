---
title: What the demo can and cannot do
description: An honest boundary between the tested frontend demonstration and a connected generation service.
order: 4
---

## Simulated

- **Model building.** No image is reconstructed. The build step produces a labelled catalog fixture (serum bottle, over-ear headphones or smart speaker) so the rest of the workflow can be exercised.
- **Run execution.** A stateful simulated backend with realistic timing, measured progress, failures, waiting-for-input, pause and cancellation. Runs persist across navigation and reloads in your browser.
- **Payments.** Checkout is a demonstration with success, declined, cancelled and delayed outcomes. No card details are requested and nothing is charged.
- **Email.** Invitations, recovery links and notification emails are shown or logged in the interface, never delivered.
- **MP4 render.** Delivered as a labelled sample clip.

## Real

- The interactive 3D viewer, its scene controls, timeline, selection and camera.
- PNG and WebM exports rendered from your edited scene, and editable scene JSON.
- Undo/redo, saved revisions, version comparison and acceptance.
- Your uploaded reference image (kept in this browser only).

## Storage and reset

Demo data lives in your browser's IndexedDB and local storage, scoped per workspace. Sign out clears cached data from the interface. Developers can reset everything from the account menu → *Demo scenarios* → *Reset all demo data*.
