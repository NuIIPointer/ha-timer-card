# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.12] - 2026-05-15

### Added
- Ship brand icon and logo inside the integration (`custom_components/timer_card/brand/`) — leverages HA 2026.3's local brand images feature, no separate brands PR needed
- README: HACS one-click install buttons (open repository, add integration, manage integration)

### Fixed
- `manifest.json` key order to satisfy hassfest validator (domain, name, then alphabetical)

## [0.1.11] - 2026-05-14

### Added
- Full multilingual support — 24 languages bundled (en, de, fr, es, it, nl, pt, pl, sv, da, nb, fi, cs, sk, hu, ru, uk, tr, ja, zh-Hans, ko, ca, ro, el)
- Robust locale resolution: exact match (`zh-Hans`), short prefix (`de-DE` → `de`), English fallback
- Quick-button helpers `fmtMinDelta` and `fmtHourDelta` compose localised duration shortcuts (`+15min` / `+15m` / `+15мин` / `+15分` / …)

## [0.1.10] - 2026-05-14

### Changed
- Edit-dialog UI refined — sections wrapped in `.edit-section` with consistent 10/16px spacing rhythm
- Quick-buttons centred consistently across all tabs (Duration / Time / Adjust)
- Section titles in edit dialog: uppercase, centred, scoped to edit dialog only (other section titles stay sentence-case)

## [0.1.9] - 2026-05-14

### Fixed
- Adjusting a running timer's duration now actually publishes the new state — HA's state-equality check was skipping in-place dict mutations, so `extra_state_attributes` now returns deep copies
- Dialog flicker on step/entity changes eliminated — modal skeleton mounts once, only dynamic parts re-render

### Added
- Edit running timers: pencil-icon on each timer row opens a duration-adjust dialog with +1m/+5m/+10m/+30m/+1h and −1m/−5m/−10m/−30m quick buttons, plus absolute HH:MM:SS entry
- Backend service `timer_card.update` accepting either absolute `duration` or relative `delta`

## [0.1.8] - 2026-05-14

### Added
- Per-card edit dialog with live "currently remaining" display

## [0.1.7] - 2026-05-14

### Fixed
- Entity picker now correctly filters by domain (used `domain:` instead of `include_domains:` which HA selector ignores)

## [0.1.6] - 2026-05-14

### Added
- Support for more controllable domains: `lock`, `vacuum`, `humidifier`, `water_heater`, `siren`, `valve`, `lawn_mower`, `input_text`
- Typed value pickers for each new domain

## [0.1.5] - 2026-05-14

### Changed
- Replaced `ha-dialog` with a custom modal overlay — the new Material 3 `ha-dialog` in HA 2026 auto-closes when the entity-picker dropdown is clicked

## [0.1.4] - 2026-05-14

### Fixed
- `scrimClickAction=""` to keep dialog open during entity selection

## [0.1.3] - 2026-05-14

### Fixed
- Buttons now in `<div slot="footer">` — Material 3 `ha-dialog` no longer supports `primaryAction`/`secondaryAction` slot names

## [0.1.2] - 2026-05-14

### Changed
- Replaced `ha-textfield`/`ha-entity-picker` (not auto-loaded by HA) with native inputs and `ha-form` (which dynamically loads the entity picker module)
- Replaced `mwc-button` with `ha-button` (the former is no longer registered in HA 2026)

## [0.1.1] - 2026-05-14

### Fixed
- `type` field preserved in card config — visual editor was stripping it, causing "Kein Typ angegeben" errors

## [0.1.0] - 2026-05-13

### Added
- Initial release: Lovelace card + custom integration that creates server-side timers which set an entity to a desired value when they expire
- Multi-timer support per card with independent card IDs
- Editor with entity favorites, domain filter, optional title
- German + English UI
