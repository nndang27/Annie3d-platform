---
title: Runs, versions and acceptance
description: The three separate things the interface tracks, and why they are not the same.
order: 2
---

## Execution status

A run moves through explicit states: draft → queued → running → (waiting for input | paused) → completed, failed or cancelled. A cancelled run settles through a short *stopping* state so the interface never claims work has stopped before it has. Retrying a failed run executes only the failed step and those after it, and reuses earlier outputs.

## Preview availability

An output may exist before a preview does, and a preview may be a static poster rather than the interactive model. The interface tells you which one you are looking at.

## Acceptance

Completion means the step finished. It does not mean the output is right. Each version carries an acceptance state — unreviewed, accepted or rejected — that only you change. Selecting a version for export is a further, separate decision, and later runs never override a version you selected explicitly.

## Versions

Every run adds a revision to each output lineage (for example, the 9:16 ad variant). Earlier revisions stay available, can be compared side by side and can be reopened in the studio to continue editing.

## Operation ids and duplicates

Every command carries an operation id. Sending the same command twice — a double click, a retried request after a timeout — returns the original result instead of creating a second run, project or purchase.
