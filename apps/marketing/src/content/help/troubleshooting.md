---
title: Troubleshooting
description: What to do when something looks stuck, missing or denied.
order: 5
---

## The run seems stuck

Open the Workflow tab and check the run panel. *Queued* means the backend accepted it; *running* shows measured progress per step. If you are offline, the header shows a badge and the run continues on the backend; status refreshes when the connection returns. Use **Stop run** if you no longer need it; earlier outputs are kept.

## A step failed

The failed step shows the specific reason. **Retry failed step** runs only that step and the ones after it, reusing earlier outputs.

## The 3D view is blank

Your browser may have WebGL disabled. The studio falls back to a static preview and keeps every editing control except browser renders; scene JSON export still works. Enable hardware acceleration or use a recent Chrome, Safari or Firefox.

## "You need a different role"

Viewers can open projects and outputs but cannot change them. Ask a workspace owner to make you an editor in Settings → Members & roles.

## "Plan limit reached"

Starter allows three active projects and 20 credits a month. Archive a project or change plan in Settings → Usage & billing.

## The link opened a missing project or artifact

It may have been deleted, or it belongs to another workspace. Nothing you were editing is lost; go back to Projects or the Library.

## Session expired

You are sent to sign-in with your destination preserved; drafts stay in the browser.
