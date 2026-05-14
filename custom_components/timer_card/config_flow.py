"""Config flow for Timer Card.

Single-entry, no inputs. The integration is essentially a global utility, so
we just create one entry on demand.
"""
from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN


class TimerCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="Timer Card", data={})
