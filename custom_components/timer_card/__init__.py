"""Timer Card integration.

Provides:
- A persistent timer store (survives restarts).
- Services to create / delete / clear timers.
- A sensor exposing all active and recently finished timers as attributes.
- A static endpoint serving the Lovelace frontend card; the card is auto-registered.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    EVENT_FINISHED,
    FINISHED_RETENTION_SECONDS,
    FRONTEND_FILE,
    FRONTEND_URL,
    PLATFORMS,
    SERVICE_CLEAR_FINISHED,
    SERVICE_CREATE,
    SERVICE_DELETE,
    SERVICE_UPDATE,
    SIGNAL_UPDATE,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)

# This integration is set up exclusively via the UI (config flow). The
# CONFIG_SCHEMA simply tells HA that we expect no YAML configuration.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# Max duration: 31 days. Prevents accidental gigantic timers from
# bloating storage; can be raised by editing this constant if you have
# a legitimate use-case.
MAX_DURATION_SECONDS = 31 * 24 * 3600

CREATE_SCHEMA = vol.Schema(
    {
        vol.Required("card_id"): cv.string,
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("target_value"): vol.Any(str, int, float, bool, dict, list),
        vol.Required("duration"): vol.All(
            vol.Coerce(float), vol.Range(min=1, max=MAX_DURATION_SECONDS)
        ),
        vol.Optional("label"): cv.string,
    }
)

DELETE_SCHEMA = vol.Schema({vol.Required("timer_id"): cv.string})

CLEAR_SCHEMA = vol.Schema({vol.Optional("card_id"): cv.string})

# update: either `duration` (absolute new remaining seconds from now) OR
# `delta` (positive/negative seconds added to the current remaining time).
UPDATE_SCHEMA = vol.Schema(
    vol.All(
        {
            vol.Required("timer_id"): cv.string,
            vol.Optional("duration"): vol.All(
                vol.Coerce(float), vol.Range(min=1, max=MAX_DURATION_SECONDS)
            ),
            vol.Optional("delta"): vol.All(
                vol.Coerce(float),
                vol.Range(min=-MAX_DURATION_SECONDS, max=MAX_DURATION_SECONDS),
            ),
        },
        cv.has_at_least_one_key("duration", "delta"),
    )
)


class TimerStore:
    """Holds all timer state and schedules callbacks."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.timers: dict[str, dict[str, Any]] = {}
        self.finished: list[dict[str, Any]] = []
        self._cancellers: dict[str, Any] = {}
        self._gc_cancel = None

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.timers = data.get("timers", {}) or {}
        self.finished = data.get("finished", []) or []
        if self.finished:
            self._ensure_gc()
        # Re-schedule everything. If HA hasn't fully started yet, defer until
        # EVENT_HOMEASSISTANT_STARTED so that built-in services (switch.*,
        # light.*, etc.) are guaranteed to be registered when expired timers
        # fire.
        if self.hass.state == CoreState.running:
            self._reschedule_all()
        else:
            @callback
            def _on_started(_event):
                self._reschedule_all()

            self.hass.bus.async_listen_once(
                EVENT_HOMEASSISTANT_STARTED, _on_started
            )

    @callback
    def _reschedule_all(self) -> None:
        now = dt_util.utcnow().timestamp()
        for timer_id, timer in list(self.timers.items()):
            remaining = float(timer.get("finish_time", now)) - now
            if remaining <= 0:
                # Fire immediately for timers that elapsed while HA was offline.
                self.hass.async_create_task(self._fire(timer_id))
            else:
                self._schedule(timer_id, remaining)

    async def async_save(self) -> None:
        await self._store.async_save(
            {"timers": self.timers, "finished": self.finished[-100:]}
        )

    @callback
    def _schedule(self, timer_id: str, delay: float) -> None:
        # Cancel any existing schedule for this id first.
        self._cancel_schedule(timer_id)

        @callback
        def _fire_callback(_now):
            self.hass.async_create_task(self._fire(timer_id))

        self._cancellers[timer_id] = async_call_later(
            self.hass, max(0.0, float(delay)), _fire_callback
        )

    @callback
    def _cancel_schedule(self, timer_id: str) -> None:
        cancel = self._cancellers.pop(timer_id, None)
        if cancel is not None:
            try:
                cancel()
            except Exception:  # noqa: BLE001
                _LOGGER.debug("Cancelling timer %s failed", timer_id, exc_info=True)

    async def async_create(
        self,
        card_id: str,
        entity_id: str,
        target_value: Any,
        duration: float,
        label: str | None,
    ) -> str:
        timer_id = uuid.uuid4().hex
        now = dt_util.utcnow().timestamp()
        self.timers[timer_id] = {
            "id": timer_id,
            "card_id": card_id,
            "entity_id": entity_id,
            "target_value": target_value,
            "label": label,
            "created_at": now,
            "finish_time": now + float(duration),
            "duration": float(duration),
        }
        self._schedule(timer_id, duration)
        await self.async_save()
        self._notify()
        return timer_id

    async def async_delete(self, timer_id: str) -> bool:
        timer = self.timers.pop(timer_id, None)
        self._cancel_schedule(timer_id)
        if timer is None:
            return False
        await self.async_save()
        self._notify()
        return True

    async def async_update(
        self,
        timer_id: str,
        duration: float | None = None,
        delta: float | None = None,
    ) -> bool:
        """Update the remaining time of a running timer.

        Either `duration` (new absolute remaining seconds from now) or
        `delta` (positive/negative seconds added to current remaining time)
        must be provided.
        """
        timer = self.timers.get(timer_id)
        if timer is None:
            return False
        now = dt_util.utcnow().timestamp()
        current_remaining = max(0.0, float(timer.get("finish_time", now)) - now)
        if duration is not None:
            new_remaining = float(duration)
        else:
            new_remaining = current_remaining + float(delta or 0)
        # Don't allow zero/negative — that would fire immediately.
        new_remaining = max(1.0, min(MAX_DURATION_SECONDS, new_remaining))
        timer["finish_time"] = now + new_remaining
        # `duration` field is the original total — recompute so the
        # progress bar in the card has a sensible reference. Use the
        # max of the original duration and the new remaining so a user
        # who extends the timer doesn't see the bar suddenly jump back.
        try:
            original_duration = float(timer.get("duration") or 0)
        except (TypeError, ValueError):
            original_duration = 0.0
        timer["duration"] = max(original_duration, new_remaining)
        self._schedule(timer_id, new_remaining)
        await self.async_save()
        self._notify()
        return True

    async def async_clear_finished(self, card_id: str | None = None) -> None:
        if card_id:
            self.finished = [t for t in self.finished if t.get("card_id") != card_id]
        else:
            self.finished = []
        await self.async_save()
        self._notify()

    async def _fire(self, timer_id: str) -> None:
        timer = self.timers.pop(timer_id, None)
        self._cancel_schedule(timer_id)
        if timer is None:
            return
        try:
            await self._apply_target(timer["entity_id"], timer["target_value"])
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "Timer %s for %s failed to apply target value: %s",
                timer_id,
                timer.get("entity_id"),
                err,
            )
        # Fire event for power-user automations.
        self.hass.bus.async_fire(
            EVENT_FINISHED,
            {
                "timer_id": timer_id,
                "card_id": timer.get("card_id"),
                "entity_id": timer.get("entity_id"),
                "target_value": timer.get("target_value"),
                "label": timer.get("label"),
            },
        )
        # Move to finished bucket with a TTL. A single periodic GC handles
        # eviction — much cheaper than one async_call_later per timer.
        timer["finished_at"] = dt_util.utcnow().timestamp()
        self.finished.append(timer)
        self.finished = self.finished[-100:]
        self._ensure_gc()
        await self.async_save()
        self._notify()

    @callback
    def _ensure_gc(self) -> None:
        if self._gc_cancel is not None:
            return

        @callback
        def _run_gc(_now):
            self._gc_cancel = None
            cutoff = dt_util.utcnow().timestamp() - FINISHED_RETENTION_SECONDS
            before = len(self.finished)
            self.finished = [
                t for t in self.finished if t.get("finished_at", 0) >= cutoff
            ]
            if len(self.finished) != before:
                self.hass.async_create_task(self.async_save())
                self._notify()
            if self.finished:
                self._ensure_gc()

        # Run every 60 seconds. Cheap, bounded.
        self._gc_cancel = async_call_later(self.hass, 60, _run_gc)

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    async def _apply_target(self, entity_id: str, target_value: Any) -> None:
        """Translate (entity_id, target_value) into the correct service call.

        Structured as one ``if/elif/.../else`` so each domain owns its
        complete decision tree and there is no possibility of a value
        leaking from one domain's branch into another's. If a domain is
        recognized but the value doesn't match a known pattern, the
        ``_apply_generic_fallback`` helper handles bool-ish strings via
        ``homeassistant.turn_on``/``turn_off`` and logs a warning for
        anything else.
        """
        domain = entity_id.split(".", 1)[0]
        tv = target_value
        # Normalize bool-ish strings.
        tv_str = str(tv).lower() if not isinstance(tv, dict) else None
        call = self.hass.services.async_call

        if domain in ("switch", "input_boolean"):
            service = "turn_on" if tv_str in ("on", "true", "1") else "turn_off"
            await call(domain, service, {"entity_id": entity_id}, blocking=False)
            return

        if domain == "light":
            if isinstance(tv, dict):
                await call(
                    "light", "turn_on", {"entity_id": entity_id, **tv}, blocking=False
                )
                return
            if tv_str in ("off", "false", "0"):
                await call(
                    "light", "turn_off", {"entity_id": entity_id}, blocking=False
                )
                return
            try:
                pct = int(float(tv))
                await call(
                    "light",
                    "turn_on",
                    {"entity_id": entity_id, "brightness_pct": max(1, min(100, pct))},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                pass
            await call(
                "light", "turn_on", {"entity_id": entity_id}, blocking=False
            )
            return

        if domain in ("number", "input_number"):
            try:
                await call(
                    domain,
                    "set_value",
                    {"entity_id": entity_id, "value": float(tv)},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                _LOGGER.warning(
                    "Timer Card: %s is not numeric for %s", tv, entity_id
                )
                return

        if domain == "climate":
            if isinstance(tv, dict):
                await call(
                    "climate",
                    "set_temperature",
                    {"entity_id": entity_id, **tv},
                    blocking=False,
                )
                return
            try:
                temp = float(tv)
                await call(
                    "climate",
                    "set_temperature",
                    {"entity_id": entity_id, "temperature": temp},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                pass
            await call(
                "climate",
                "set_hvac_mode",
                {"entity_id": entity_id, "hvac_mode": str(tv)},
                blocking=False,
            )
            return

        if domain == "cover":
            if tv_str in ("open", "up"):
                await call(
                    "cover", "open_cover", {"entity_id": entity_id}, blocking=False
                )
                return
            if tv_str in ("close", "closed", "down"):
                await call(
                    "cover", "close_cover", {"entity_id": entity_id}, blocking=False
                )
                return
            try:
                pos = int(float(tv))
                await call(
                    "cover",
                    "set_cover_position",
                    {"entity_id": entity_id, "position": max(0, min(100, pos))},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                pass
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "fan":
            if tv_str == "off":
                await call(
                    "fan", "turn_off", {"entity_id": entity_id}, blocking=False
                )
                return
            if tv_str == "on":
                await call(
                    "fan", "turn_on", {"entity_id": entity_id}, blocking=False
                )
                return
            try:
                pct = int(float(tv))
                await call(
                    "fan",
                    "set_percentage",
                    {"entity_id": entity_id, "percentage": max(0, min(100, pct))},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                pass
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain in ("select", "input_select"):
            await call(
                domain,
                "select_option",
                {"entity_id": entity_id, "option": str(tv)},
                blocking=False,
            )
            return

        if domain == "media_player":
            mapping = {
                "play": "media_play",
                "pause": "media_pause",
                "stop": "media_stop",
                "on": "turn_on",
                "off": "turn_off",
            }
            svc = mapping.get(tv_str or "")
            if svc:
                await call(
                    "media_player", svc, {"entity_id": entity_id}, blocking=False
                )
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "lock":
            if tv_str in ("lock", "locked", "on", "true"):
                await call("lock", "lock", {"entity_id": entity_id}, blocking=False)
                return
            if tv_str in ("unlock", "unlocked", "off", "false"):
                await call("lock", "unlock", {"entity_id": entity_id}, blocking=False)
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "vacuum":
            mapping = {
                "start": "start",
                "pause": "pause",
                "stop": "stop",
                "return_to_base": "return_to_base",
                "on": "turn_on",
                "off": "turn_off",
            }
            svc = mapping.get(tv_str or "")
            if svc:
                await call("vacuum", svc, {"entity_id": entity_id}, blocking=False)
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "humidifier":
            if isinstance(tv, dict):
                if "humidity" in tv:
                    await call(
                        "humidifier",
                        "turn_on",
                        {"entity_id": entity_id},
                        blocking=False,
                    )
                    await call(
                        "humidifier",
                        "set_humidity",
                        {"entity_id": entity_id, "humidity": tv["humidity"]},
                        blocking=False,
                    )
                    return
            if tv_str in ("off", "false", "0"):
                await call(
                    "humidifier", "turn_off", {"entity_id": entity_id}, blocking=False
                )
                return
            if tv_str in ("on", "true", "1"):
                await call(
                    "humidifier", "turn_on", {"entity_id": entity_id}, blocking=False
                )
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "water_heater":
            if isinstance(tv, dict):
                await call(
                    "water_heater",
                    "turn_on",
                    {"entity_id": entity_id},
                    blocking=False,
                )
                if "temperature" in tv:
                    await call(
                        "water_heater",
                        "set_temperature",
                        {"entity_id": entity_id, "temperature": tv["temperature"]},
                        blocking=False,
                    )
                return
            if tv_str in ("off", "false", "0"):
                await call(
                    "water_heater",
                    "turn_off",
                    {"entity_id": entity_id},
                    blocking=False,
                )
                return
            if tv_str in ("on", "true", "1"):
                await call(
                    "water_heater",
                    "turn_on",
                    {"entity_id": entity_id},
                    blocking=False,
                )
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "siren":
            service = "turn_on" if tv_str in ("on", "true", "1") else "turn_off"
            await call("siren", service, {"entity_id": entity_id}, blocking=False)
            return

        if domain == "valve":
            if tv_str in ("open", "up"):
                await call(
                    "valve", "open_valve", {"entity_id": entity_id}, blocking=False
                )
                return
            if tv_str in ("close", "closed", "down"):
                await call(
                    "valve", "close_valve", {"entity_id": entity_id}, blocking=False
                )
                return
            try:
                pos = int(float(tv))
                await call(
                    "valve",
                    "set_valve_position",
                    {"entity_id": entity_id, "position": max(0, min(100, pos))},
                    blocking=False,
                )
                return
            except (ValueError, TypeError):
                pass
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "lawn_mower":
            mapping = {
                "start": "start_mowing",
                "pause": "pause",
                "dock": "dock",
            }
            svc = mapping.get(tv_str or "")
            if svc:
                await call(
                    "lawn_mower", svc, {"entity_id": entity_id}, blocking=False
                )
                return
            await self._apply_generic_fallback(entity_id, tv, tv_str)
            return

        if domain == "input_text":
            await call(
                "input_text",
                "set_value",
                {"entity_id": entity_id, "value": str(tv)},
                blocking=False,
            )
            return

        # Unknown domain — try the generic fallback.
        await self._apply_generic_fallback(entity_id, tv, tv_str)

    async def _apply_generic_fallback(
        self, entity_id: str, tv: Any, tv_str: str | None
    ) -> None:
        """Last-resort dispatch via homeassistant.turn_on / turn_off."""
        call = self.hass.services.async_call
        if tv_str in ("on", "true", "1"):
            await call(
                "homeassistant", "turn_on", {"entity_id": entity_id}, blocking=False
            )
            return
        if tv_str in ("off", "false", "0"):
            await call(
                "homeassistant", "turn_off", {"entity_id": entity_id}, blocking=False
            )
            return
        _LOGGER.warning(
            "Timer Card: don't know how to apply value %r to %s", tv, entity_id
        )


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Timer Card from a config entry."""
    await _async_setup_runtime(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry (only unloads the sensor platform; data stays loaded)."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_setup_runtime(hass: HomeAssistant) -> None:
    """Set up runtime state, register services and serve the frontend."""
    if hass.data.get(DOMAIN, {}).get("setup_done"):
        return

    store = TimerStore(hass)
    await store.async_load()
    hass.data.setdefault(DOMAIN, {})["store"] = store
    hass.data[DOMAIN]["setup_done"] = True

    # --- Services -----------------------------------------------------------
    async def _handle_create(call: ServiceCall) -> dict[str, Any]:
        data = CREATE_SCHEMA(dict(call.data))
        timer_id = await store.async_create(
            card_id=data["card_id"],
            entity_id=data["entity_id"],
            target_value=data["target_value"],
            duration=data["duration"],
            label=data.get("label"),
        )
        return {"timer_id": timer_id}

    async def _handle_delete(call: ServiceCall) -> None:
        data = DELETE_SCHEMA(dict(call.data))
        await store.async_delete(data["timer_id"])

    async def _handle_update(call: ServiceCall) -> None:
        data = UPDATE_SCHEMA(dict(call.data))
        await store.async_update(
            timer_id=data["timer_id"],
            duration=data.get("duration"),
            delta=data.get("delta"),
        )

    async def _handle_clear(call: ServiceCall) -> None:
        data = CLEAR_SCHEMA(dict(call.data))
        await store.async_clear_finished(data.get("card_id"))

    hass.services.async_register(
        DOMAIN,
        SERVICE_CREATE,
        _handle_create,
        schema=CREATE_SCHEMA,
        supports_response="optional",
    )
    hass.services.async_register(
        DOMAIN, SERVICE_DELETE, _handle_delete, schema=DELETE_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE, _handle_update, schema=UPDATE_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_CLEAR_FINISHED, _handle_clear, schema=CLEAR_SCHEMA
    )

    # --- Frontend -----------------------------------------------------------
    frontend_path = os.path.join(os.path.dirname(__file__), FRONTEND_FILE)

    # Register static path. register_static_paths is the newer API; fall back to
    # register_static_path for older HA versions.
    try:
        from homeassistant.components.http import StaticPathConfig  # type: ignore

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL, frontend_path, False)]
        )
    except Exception:  # noqa: BLE001
        try:
            hass.http.register_static_path(FRONTEND_URL, frontend_path, False)
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Failed to register Timer Card frontend static path")
            return

    # Add a version query so HA invalidates the browser cache when the
    # integration is updated.
    manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")

    def _load_version() -> str:
        try:
            import json

            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            return str(manifest.get("version", "0"))
        except Exception:  # noqa: BLE001
            return "0"

    # Read on the executor to avoid blocking the event loop.
    version = await hass.async_add_executor_job(_load_version)

    versioned_url = f"{FRONTEND_URL}?v={version}"

    from homeassistant.components.frontend import add_extra_js_url

    add_extra_js_url(hass, versioned_url)
