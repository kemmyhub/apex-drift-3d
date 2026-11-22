# Apex Drift 3D Upgrade TODO

Implementation follows the approved `plan.md`, based on current `main` at `27d9a00`. Keep this list intact as work progresses; mark an outcome complete only when its evidence exists.

## 1. Safe local persistence and migration

- [x] Existing profile, upgrade, selected-track, graphics, and best-lap data must continue loading compatibly.
- [x] Missing, malformed, or incompatible saved JSON must not prevent a player from starting a race; fall back safely and preserve recoverable data where possible.
- [x] Unavailable or quota-exceeded browser storage must be handled without an uncaught exception or loss of the ability to play; clearly report that progress could not be saved.
- [x] Any new storage format must be versioned and migrated compatibly; tests must cover missing, corrupt, and storage-denied cases.

## 2. WebGL startup failure handling

- [x] Missing `window.THREE`, unsupported WebGL, or a renderer-construction failure must show an actionable, keyboard-accessible fallback instead of leaving a blank game screen.
- [x] When graphics initialization fails, menus must not claim that a playable race started; provide a usable recovery/reload message and retain no unhandled startup exception.

## 3. Deterministic regression-test foundation

- [x] Add a test command to the project and tests for race lifecycle/checkpoint/lap/finish, pause/restart, profile/upgrades/persistence, and the existing four power-up types: Homing Pulse, Phase Shield, Shockwave, and Turbo Cell.
- [x] Tests must cover pickup/activation, shield/hit/counter behavior, no-target and out-of-range behavior, AI use, cleanup/disposal, and supported local/remote-player rules where implemented.
- [x] Make timing and randomness controllable where needed for repeatability; do not hide failed assertions or production-build failures.
- [x] The production build and all automated tests must pass after each implementation slice.

## 4. Unified input, responsive controls, and accessibility

- [x] Preserve current keyboard, touch, weapon, pause, tablet, small-phone, orientation, and safe-area behavior; the latest `main` already contains mobile/tablet overlap fixes, so do not reimplement a duplicate layout patch.
- [x] Touch/pointer presses must release on normal end, cancellation, lost pointer/focus, or window blur; simultaneous inputs must not become stuck.
- [x] Add an intentional touch brake/reverse affordance or clearly explain the chosen alternative; optional Gamepad API support must not be required to play.
- [x] Interactive controls must have accessible names, logical keyboard focus/order, visible focus, readable status/results, and cues not dependent on color alone; keep reduced-motion behavior.

## 5. Skippable practice/tutorial flow

- [x] Add an optional, replayable, skippable first-drive or practice flow using existing content.
- [x] Explain acceleration/braking, steering, drifting/nitro, the four existing pickups and their relevant counters, upgrades, race objective/HUD, results, and returning to the garage.
- [x] The tutorial must not block experienced players or make ordinary races dependent on completing it.

## 6. Genuine local Time Trial ghost

- [x] The `GHOST PB` label must only be shown when a working ghost is available; otherwise replace it with an honest personal-best label. Ghost playback remains deferred; Time Trial and the garage now use `SOLO PB` and `Personal best` instead of implying a replay exists.
- [ ] A new best valid lap may record a bounded track-relative position/heading sample sequence and replay it with interpolation as a non-colliding ghost.
- [ ] Ghost records must be associated with compatible track/car/version metadata, limited to the best compatible lap, safely ignore corrupt/incompatible data, and respect local storage limits.
- [ ] If deterministic replay cannot meet these conditions, defer ghost playback and retain honest best-lap timing without claiming a ghost.

## 7. Finite local event ladder

- [ ] Add replayable local events built from existing tracks and systems, including at least a target-time objective, a clean-lap objective, a drift target, and an optional combat objective.
- [ ] Show objective rules and rewards before entry, show progress/results, save completion safely, and allow replay.
- [ ] Keep events finite and independent of accounts, network services, calendar-sensitive daily resets, monetization, or grind gates to basic play.

## 8. Measured performance and low-end behavior

- [ ] Profile ULTRA/HIGH/PERFORMANCE on declared desktop, tablet, mobile, and lower-end configurations before tuning; record hardware/browser, resolution/viewport, and measurement method.
- [ ] Reduce measured rendering costs where useful, including pixel ratio, shadows, scenery/prop counts, effects, and avoidable per-frame work; preserve simulation correctness and input responsiveness.
- [ ] Do not claim FPS/device support targets without repeatable measurements; retain a clear user-selectable low-cost mode and explain limitations where a device cannot meet the target.

## 9. Verified installability and offline behavior

- [ ] Register the service worker and provide safe cache versioning, update, activation, and cache-failure behavior for the built app shell and local assets.
- [ ] Verify install flow and a true offline cold start with critical assets available locally; remove runtime CDN dependence for critical rendering/UI assets or clearly document connectivity requirements.
- [ ] Do not claim dependable offline gameplay unless it is verified end to end on the production build; keep readable font and asset fallbacks.

## 10. Bounded original content extension

- [ ] Retain all three current cars, all three current tracks, and the existing original combat system.
- [ ] Add at least one original circuit/environment variant and distinct event variants only where current code can support them without a heavy asset payload or regression to low-end performance.
- [ ] New environments, cars, effects, text, audio, and interface must be original; do not copy Need for Speed, Asphalt, or Blur branding, interface, licensed vehicles, tracks, art, audio, or distinctive expression.

## 11. Backend architecture proposal only — no provisioning

- [ ] Write a separate `backend-architecture.md` comparing the current local-only model with a minimal authoritative room service and persistent account/cloud-save service.
- [ ] Explain responsibilities, data ownership, trust boundaries, anti-cheat/moderation, reconnects, privacy/security, deployment/operations, cost drivers, and staged alternatives.
- [ ] Do not choose a provider, request or add secrets, provision services, change the static Cloudflare deployment, or implement accounts, cloud saves, internet matchmaking, or synchronized remote combat without separate explicit approval of provider, budget, and operational responsibilities.

## 12. Interface, circuit, gameplay, and driving coherence

- [ ] At the supplied 1517×686 desktop viewport and representative tablet/mobile widths, the fixed quality/audio controls must not overlap the career/driver-profile controls; all menu panels and race HUD/dialog controls must remain visible or reachable by scrolling without horizontal clipping.
- [x] The selected circuit’s map preview/minimap must fit all sampled points and race markers inside its bounds, preserve the track’s aspect ratio, and update when the destination changes.
- [x] Circuit descriptions and trackside environment must match the selected circuit; roadside boost markers must sit beside their boost pads in the local track direction, and repeated track builds must use repeatable scenery placement.
- [x] Brake input must reduce forward speed without silently accelerating the car into reverse; reverse must only engage after the car reaches a stop while reverse is intentionally held. HUD speed and applied longitudinal motion must not contradict each other.
- [x] Boost activation must not teleport speed to a high-speed floor while coasting or braking; steering, drifting, wall response, and car-to-car impacts must update position, heading, velocity, and displayed speed coherently and without pair-order-dependent overlap resolution.
- [x] AI throttle and post-finish behavior must respect their intended throttle values, speed targets, and smooth steering rather than treating fractional throttle as full throttle.
- [x] Run deterministic regression tests for map transforms and corrected motion/collision rules, then interactively test the built game in a browser at desktop and mobile/tablet viewport sizes. A production live test is complete only after an explicitly approved push and verified deployment; local browser testing must not be reported as production verification.

## 13. Final integration and delivery

- [ ] Preserve the current Vite/Three.js app and its existing features; implement reviewable increments instead of a full rewrite.
- [ ] Update README/setup information to match only verified controls, modes, install/offline behavior, performance support, and multiplayer scope.
- [ ] Report files changed, behavior implemented, build/test results, device/browser/performance measurements, and known limitations.
- [ ] Do not push to `main` without separate explicit confirmation; `main` pushes trigger the configured production deployment.
