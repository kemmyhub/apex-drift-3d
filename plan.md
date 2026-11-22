# Apex Drift 3D — Upgrade Implementation Plan

## Baseline and scope

Target the repository’s current `main` revision (`27d9a00` at planning time), not an older audit snapshot. The game already has three selectable cars and circuits, AI races, Time Trial, drifting/nitro, original combat pickups, upgrades and career progression, synthesized audio, PWA files, and substantially improved phone/tablet layouts. Preserve these systems and the current responsive/overlap fixes; do not reimplement features already present.

Implement the audit’s browser/client scope in reviewable stages: reliability, input/accessibility, tutorial and finite event progression, best-lap ghost replay, performance controls, verified install/offline behavior, and locally testable content extensions. Include a separate architecture proposal for future accounts/cloud saves and real cross-device multiplayer. Do **not** choose or provision a backend provider, add credentials, enable paid services, build account/matchmaking services, or claim the local `BroadcastChannel` rooms are online multiplayer. Those decisions require separate provider, security/privacy, operational-cost, and user approval.

### Follow-up — interface, circuit, gameplay, and driving coherence

Address the owner’s report that the interface still overlaps and that the UI/UX, maps, gameplay, and physics do not make sense. Prioritize a geometric layout fix for the fixed top-right quality/audio controls colliding with the driver-profile row at desktop and tablet widths, then browser-check the screenshot viewport (1517×686) and narrow mobile/tablet layouts. Keep every visible control reachable and prevent HUD/dialog clipping.

Make circuit presentation and driving behavior internally consistent: fit minimaps/previews to each selected track’s actual sampled bounds without clipping or distorting shape; make track descriptions and scenery match the selected environment; orient roadside markers using track-local directions; and correct contradictory braking/reverse, boost, speed/velocity, steering, collision, boundary, and AI throttle behavior where deterministic tests can demonstrate a defect. Keep the existing arcade-racing style and content rather than rewriting the game or adding backend services.

Use deterministic unit/regression checks for track transforms and motion/collision rules, then run the local production build in an interactive browser at desktop and mobile/tablet viewports. A live production test requires deployment of the reviewed commit; because pushing `main` triggers Cloudflare Pages, get separate explicit approval for that production push rather than treating local browser testing as proof of production behavior.

## Implementation approach

Work incrementally against the existing Vite/Three.js application. Keep the current renderer and gameplay model. Extract testable browser-independent logic where useful; prefer small modules with explicit inputs over a rewrite. Add a lightweight test runner and deterministic coverage for profile/upgrades, event progression, ghost data, input state, and power-up behavior. Run existing production build and targeted tests after each delivery slice; do not suppress regressions or use browser automation as a substitute for unit-level tests.

### Stage 1 — Stability and regression coverage

Add project tests and scripts for production build, race/lap state transitions, pause/restart, local profile/upgrades, and original power-up pickup/activation/counter/cleanup behavior. Make randomness and timing injectable or controllable where tests need repeatable outcomes. Add a guarded storage helper that handles missing, corrupt, quota-exceeded, and unavailable browser storage without preventing a race from starting; preserve existing local data through compatible reads and versioned migration.

Handle missing `window.THREE`, unavailable WebGL, and renderer construction failures with a clear, keyboard-accessible fallback screen instead of a blank canvas. Preserve the current responsive layout, touch-control grid, safe-area handling, and weapon-panel placement. Harden existing touch controls against cancellation, pointer loss, and focus changes, and add an explicit brake/reverse touch option where space permits.

### Stage 2 — Controls, tutorial, and accessibility

Consolidate keyboard, touch/pointer, and optional Gamepad API input into a small input module that produces the existing action-state shape. Retain current keyboard bindings, add cancellation/release behavior, and provide gamepad support only when connected; never require a controller. Add clear control names, focus order and visible focus, usable keyboard navigation for menus/dialogs, readable race/result status, non-color-only combat cues, and reduced-motion behavior.

Add an optional skippable first-drive/practice tutorial using the existing track and handling. Teach steering, braking, drift/nitro, current pickup types and counters, upgrade effects, HUD, and returning to the garage. The tutorial must not block experienced players or make the core race depend on completing it.

### Stage 3 — Local progression and true Time Trial ghost

Correct the “GHOST PB” claim by implementing a real local best-lap ghost. Record a bounded sequence of track-relative position/heading samples for the player’s best valid lap, associate it with track/car/version metadata, and replay it as a non-colliding visual ghost with interpolation. Store only the best compatible lap, bound storage size, and safely ignore malformed or incompatible recordings. If deterministic replay cannot be made reliable within the current simulation, remove the claim and surface the personal-best comparison honestly rather than shipping a false ghost.

Add a finite, local event ladder built from the existing races and systems: for example, clean lap, target time, drift target, and optional combat objective. Show objective progress and reward rules before entry, save completion with the guarded storage layer, and permit replay. Avoid calendar-sensitive daily resets, network dependencies, or grind gates. Add modest original rewards and preserve the current profile/upgrades.

### Stage 4 — Rendering, installability, and bounded content

Profile the existing ULTRA/HIGH/PERFORMANCE modes on representative desktop, tablet, mobile, and lower-end hardware. Improve PERFORMANCE mode only where measurements point to real bottlenecks: pixel ratio, shadows, scenery/prop count, visual effects, and avoidable per-frame work. Preserve simulation and input responsiveness; add an adaptive setting only if it is stable and explainable.

Make PWA behavior real rather than implied: register the service worker; cache the built game shell and versioned local assets; handle updates and cache failures safely; and remove the runtime CDN dependency for critical rendering/UI assets or document connectivity requirements. Verify install and offline cold-start behavior before claiming offline support. Keep font and asset fallbacks readable and low-payload.

Add bounded original content that fits the game’s lightweight style—at least one additional circuit/environment variant and distinct event variants if current track architecture permits without a heavy asset payload. Retain the three current tracks, original vehicles, and original combat design. Defer open-world maps, licensed-car catalogs, monetization, and live operations.

### Stage 5 — Backend architecture proposal only

Produce `backend-architecture.md` comparing a minimal authoritative room service and persistent account/save service with keeping the current local-only model. Describe responsibilities, data ownership, trust boundaries, anti-cheat and moderation, reconnects, privacy/security, deployment/operations, likely cost drivers, and staged alternatives. Do not select a provider, request secrets, add a backend dependency, provision resources, change the static Cloudflare deployment, or implement remote accounts, cloud saves, matchmaking, or synchronized combat until the owner separately approves the architecture, provider, budget, and operational responsibilities.

## Design direction

Reuse the game’s existing neon arcade-racing identity and established visual language rather than replacing it. Keep the dark glass garage/HUD, cyan-blue highlights with restrained warm pickup accents, bold motorsport typography, and original car/track silhouettes. Prioritize legibility at speed, mobile-safe hit targets, responsive scrollable menus, distinct selection states, and clear information hierarchy. Motion should provide feedback, remain subtle during navigation, and respect reduced-motion preferences. Keep every design expression original; use broad arcade-racing conventions only, never copy Need for Speed, Asphalt, or Blur names, branded interface, vehicles, tracks, art, or audio.

## Main project structure and responsibilities

```text
src/
  main.js                    App bootstrap, service-worker registration, renderer fallback
  styles.css                 Existing responsive garage, race HUD, and accessibility states
  audio/SoundEngine.js       Existing synthesized audio and mute behavior
  game/
    ApexDriftApp.js          Existing app orchestration; keep integration changes focused
    Vehicle.js               Existing vehicle driving, AI, visual effects, and state
    PowerUpManager.js        Existing original pickup/combat loop; test and tune, do not replace
    TrackCatalog.js          Existing circuits plus bounded original additions
    RaceTrack.js             Existing track geometry/scenery and measured quality variants
    ProfileManager.js        Existing progression, backed by guarded/versioned storage
    UpgradeManager.js        Existing per-car upgrades and balance rules
    AchievementManager.js   Existing achievement rewards
    InputController.js       Proposed unified keyboard, touch/pointer, and optional gamepad state
    GhostRecorder.js         Proposed bounded local best-lap capture and replay data
    EventManager.js          Proposed finite event ladder and local completion state
    TutorialManager.js       Proposed skippable practice/tutorial flow
    StorageAdapter.js        Proposed safe browser persistence and migrations
  network/
    MultiplayerManager.js    Existing same-browser synchronization; retain accurate scope
    [future backend design only; no service implementation in this plan]
tests/
  game/                      Proposed deterministic logic and regression tests
```

Keep Cloudflare Pages as a static Vite deployment for this scope. A server-backed design belongs to the architecture proposal only and must not silently change deployment or introduce recurring cost.

## Delivery slices

1. **Foundation:** add `plan.md` and `TODO.md`, baseline tests, safe storage and WebGL error handling.
2. **Device access:** robust unified input, touch brake/reverse, optional gamepad, accessible menu/race states; preserve current tablet/mobile layout work.
3. **Playable depth:** tutorial, finite event ladder, real best-lap ghost (or honest removal of the ghost label if replay reliability is not met), and tested combat rules.
4. **Low-end/offline:** measured performance settings, bundled critical dependencies, service-worker registration/update handling, and end-to-end install/offline verification.
5. **Original content and future architecture:** add bounded track/event variation and write the backend architecture proposal without provisioning services.

The external repository’s `main` branch is configured to trigger a production deployment. Implementation may be committed locally during development, but a push that causes production deployment is a separate action and must receive explicit confirmation before execution.
