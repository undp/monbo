## Why

Two things the product owner found while using the redesigned flow:
- On a screen taller than about 800 px, the start page ends well above the bottom: the hero, the steps and the start bar sit at the top and a blank band fills the rest.
- On stage 1, the upload methods that are not picked look almost like the picked one, so it isn't obvious which one is active.

## What Changes

- **Start page fills the screen.** The hero grows into the screen's spare height and centers its content, so the step cards, the start bar and the trust row reach the bottom. On a screen at least 1440 px wide and 860 px tall, the title (56 px) and the lead (20 px) are larger, and "3 pasos" never breaks across lines. At 1366×768 and on phones nothing changes.
- **Upload methods not picked look muted.** They take a light gray background and border, a gray icon tile and gray texts, like a disabled control. They stay clickable: hovering one brings back its usual colors. The texts keep at least 4.5:1 contrast and the icon 3:1.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `landing-page`: "Fits a 1366×768 screen and adapts to phones" adds that on a taller screen the page fills it, with no blank band under the trust row.
- `farm-upload`: "Each way to upload has its own card" adds that the methods not picked look muted but stay clickable.

## Impact

- **Web** (`apps/web/src/components/page/`): `landing/LandingPageContent.tsx`, `landing/LandingHero.tsx`, `landing/LandingTrust.tsx` and `uploadData/MethodButton.tsx`. No texts, API or contract change.
- **Archive order:** after `new-landing`, which adds "Fits a 1366×768 screen and adapts to phones", and `progressive-flow-stages`, which has the latest "Each way to upload has its own card".
