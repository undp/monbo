## Context

The start page (`new-landing`) was sized for a 1366×768 laptop: the hero, the three step cards and the start button fit without scrolling. Its height came from its content, so on a taller screen (900 px and up) a band of the page background was left under the trust row. The upload methods (`progressive-flow-stages`) mark the picked one with a blue border and tint, but the others were white with a dark title, which read as equally active.

## Goals / Non-Goals

**Goals:**
- The start page fills the screen at any height, keeping the 1366×768 fit.
- It is clear at a glance which upload method is picked.

**Non-Goals:**
- New sections on the start page, or new texts.
- Changing how a method is picked, or its keyboard behaviour.

## Decisions

### D1. The hero takes the spare height

The page is a column at least as tall as the screen (`100svh`). The hero has `flex: 1 0 auto` and centers its content, so the steps, the start bar and the trust row are pushed to the bottom and the spare height becomes hero, where the aerial image shows more. When the content is taller than the screen (a 768 px laptop, a phone) the hero has no spare height and the page is as before.

On a screen at least 1440 px wide and 860 px tall, the title grows to 56 px and the lead to 20 px, so the hero doesn't look empty; "3 pasos" is kept on one line (`white-space: nowrap`).

Alternatives considered:
- **Centering the whole page vertically.** It leaves bands above and below, on a page whose header sits over the hero.
- **More sections below (FAQ, partners).** They need content and texts that don't exist yet, and would push the start bar down.

### D2. Muted methods that stay clickable

A method not picked has a `#f5f7f9` background, a `#e6ebf0` border, a `#eceff3` icon tile with a `#7a8a99` icon, a `#56687a` title (5.4:1) and a `#5f7184` description (4.7:1). On hover it takes the usual white card, blue icon tile and dark texts, so it reads as something to click. The picked one keeps its blue border and tint. The button keeps `aria-pressed`, so assistive tech is unchanged.

## Risks / Trade-offs

- **[Gray texts read as disabled to some users]** → They stay above 4.5:1, the cursor is a pointer and the hover brings the colors back.
- **[A very tall screen stretches the hero]** → The content is centered and the image covers it (`cover`), so it only shows more image.

## Migration Plan

Ships in one PR into `feat/layer-manager`. Rollback: revert the PR. Archive after `new-landing` and `progressive-flow-stages`.
