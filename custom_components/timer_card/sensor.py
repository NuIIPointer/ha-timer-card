"""Sensor exposing all Timer Card timers as attributes."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_UPDATE


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    domain_data = hass.data.get(DOMAIN) or {}
    store = domain_data.get("store")
    if store is None:
        # Runtime setup somehow didn't complete; bail out gracefully so HA
        # surfaces the underlying error rather than a confusing AttributeError.
        return
    async_add_entities([TimerCardSensor(store)], update_before_add=False)


class TimerCardSensor(SensorEntity):
    """Single sensor that lists all active and recently finished timers.

    Cards filter by `card_id` client-side.
    """

    _attr_has_entity_name = False
    _attr_name = "Timer Card"
    _attr_unique_id = "timer_card_active_timers"
    _attr_icon = "mdi:timer-outline"
    _attr_should_poll = False

    def __init__(self, store) -> None:
        self._store = store

    @property
    def native_value(self) -> int:
        return len(self._store.timers)

    @property
    def extra_state_attributes(self) -> dict:
        # Return *copies* of the timer dicts so HA's state-equality check
        # (which compares old vs new attributes via ``==``) can detect
        # changes made by mutating the underlying dicts in-place. Without
        # this, in-place updates like extending a running timer would
        # never publish a state change to clients.
        return {
            "timers": [dict(t) for t in self._store.timers.values()],
            "finished": [dict(t) for t in self._store.finished],
        }

    async def async_added_to_hass(self) -> None:
        @callback
        def _update():
            self.async_write_ha_state()

        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, _update)
        )
