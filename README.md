# Timer Card for Home Assistant

[![HACS Validation](https://github.com/NuIIPointer/ha-timer-card/actions/workflows/hacs.yaml/badge.svg)](https://github.com/NuIIPointer/ha-timer-card/actions/workflows/hacs.yaml)
[![Hassfest](https://github.com/NuIIPointer/ha-timer-card/actions/workflows/validate.yaml/badge.svg)](https://github.com/NuIIPointer/ha-timer-card/actions/workflows/validate.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modern Lovelace card that lets you create one-shot timers from your dashboard. When a timer expires, the integration sets the entity you chose to the value you picked. Works for switches, lights, numbers, climate, covers, fans, selects, media players, locks, vacuums, humidifiers, water heaters, sirens, valves and lawn mowers. Timers run server-side and survive Home Assistant restarts.

## Features

- Initial dashboard state is just a single "+ Add timer" button.
- Tap it → multi-step dialog: pick entity → choose target value (type-aware picker) → pick duration or absolute time.
- Multiple timers per card; each timer shows label, target, remaining time, progress bar, edit button, and delete button.
- **Edit running timers**: pencil icon opens an adjust-duration dialog with quick +/− buttons (1m, 5m, 10m, 30m, 1h) and absolute HH:MM:SS entry.
- Finished timers stay visible for 30 minutes (configurable in code).
- Card editor supports favorite entities (shown as quick-select chips in the dialog) and entity domain filters.
- Server-side execution via a custom integration — no extra automations needed.
- **24 languages bundled**: en, de, fr, es, it, nl, pt, pl, sv, da, nb, fi, cs, sk, hu, ru, uk, tr, ja, zh-Hans, ko, ca, ro, el — automatically follows `hass.locale.language`.
- Emits `timer_card_finished` event for further automations.
- Only controllable entity domains are selectable — read-only sensors / cameras / calendars cannot be set as timer targets.

## Architecture

This package ships **one HACS integration** that contains both the Python backend and the Lovelace card asset:

```
custom_components/timer_card/
├── __init__.py        # Services, persistence, scheduling, frontend hook
├── manifest.json
├── config_flow.py     # UI install ("Add Integration → Timer Card")
├── const.py
├── sensor.py          # sensor.timer_card, attributes = active + finished timers
├── services.yaml      # timer_card.create / .delete / .clear_finished
├── timer-card.js      # Lovelace card (served via /timer_card_static/timer-card.js)
└── translations/
```

The integration registers a static endpoint at `/timer_card_static/timer-card.js` and calls `add_extra_js_url` so the card is automatically loaded — **no manual resource registration needed**.

## Install

### Via HACS (recommended)

1. HACS → Integrations → ⋮ → Custom repositories → add `https://github.com/NuIIPointer/ha-timer-card` as type **Integration**.
2. Install "Timer Card".
3. Restart Home Assistant.
4. Settings → Devices & services → Add integration → "Timer Card".
5. Add the card to a dashboard: Edit dashboard → Add card → search **Timer Card**.

### Manual

1. Copy `custom_components/timer_card/` into your HA config's `custom_components/` directory.
2. Restart Home Assistant.
3. Settings → Devices & services → Add integration → "Timer Card".
4. Add the card to a dashboard.

## Usage

- Click **+ Add timer** to open the dialog.
- Step 1: pick a favorite chip (configured in the card editor) or search any entity.
- Step 2: choose the target value — the picker adapts to the entity type.
- Step 3: pick **Duration** (HH:MM:SS + quick `+15m / +30m / +1h` buttons) or **Time** (absolute time of day; if in the past, fires next day).
- Confirm with OK. The dialog closes and the timer appears in the card.
- Repeat for as many timers as you want.

## Services

- `timer_card.create(card_id, entity_id, target_value, duration, label?)` — returns `{timer_id: …}`.
- `timer_card.delete(timer_id)`
- `timer_card.clear_finished(card_id?)`

## Events

- `timer_card_finished` — fired whenever a timer expires. Event data: `timer_id`, `card_id`, `entity_id`, `target_value`, `label`.

Use it in an automation:

```yaml
trigger:
  - platform: event
    event_type: timer_card_finished
action:
  - service: notify.mobile_app_phone
    data:
      title: Timer fertig
      message: "{{ trigger.event.data.entity_id }} → {{ trigger.event.data.target_value }}"
```

## Configuration (card YAML)

```yaml
type: custom:timer-card
title: Bath timers
card_id: 5b7e0c0e-…   # auto-generated; only edit if you know what you're doing
favorites:
  - switch.bathroom_light
  - climate.bathroom_floor
  - cover.bathroom_blinds
domains:               # which domains to show in the entity picker
  - switch
  - light
  - climate
  - cover
show_finished: true
```

All fields are optional except the auto-generated `card_id`. The visual editor handles everything.

## Notes

- Timers fire at the absolute timestamp that was set when they were created — so if HA was restarted, anything that should have already fired during the downtime fires immediately on startup.
- The card filters server-side timers by `card_id` so multiple card instances on different dashboards stay separated.
- Finished timers are kept for 30 minutes in the sensor's `finished` attribute, then auto-purged.
