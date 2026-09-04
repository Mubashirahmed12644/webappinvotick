# 0033 — No banner under the first-open onboarding overlay

**Date:** 2026-09-04 · **Status:** decided by the owner, implemented on `VC_93_VN_142`

## Context
On a first open the create-invoice screen dims everything except the "Add Business" card and points
at it ("Let's start! Add your business to create your first invoice"). Under that overlay a 60 dp
banner ad was composed and loaded — a second thing on a screen that asks for one — and its AdView
construction sat inside the screen's first frame after the app-open gate (855 ms on a Pixel 7 Pro).

## Decision (the owner's)
While the onboarding overlay is up, the banner is not composed at all: no ad, no container. It
composes the moment the overlay goes (the business is added), exactly as before.

## Monetisation note (rule: measure, never assume)
This removes banner impressions on first opens for the duration of the overlay. Measure alongside
the activation effect: banner impressions on `invoice_screen` for first-open sessions, and rung-3
(`opened the invoice screen`) drop-off, before and after the release.

## Rejected
- Keep the container empty (reserve the height) — the owner asked for neither the ad nor its space.
