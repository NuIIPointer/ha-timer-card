"""Constants for the Timer Card integration."""

DOMAIN = "timer_card"
PLATFORMS = ["sensor"]

# Storage
STORAGE_KEY = "timer_card.timers"
STORAGE_VERSION = 1

# Services
SERVICE_CREATE = "create"
SERVICE_DELETE = "delete"
SERVICE_UPDATE = "update"
SERVICE_CLEAR_FINISHED = "clear_finished"

# Event
EVENT_FINISHED = "timer_card_finished"

# Dispatcher signal (used to push sensor refreshes)
SIGNAL_UPDATE = "timer_card_update"

# Frontend
FRONTEND_URL = "/timer_card_static/timer-card.js"
FRONTEND_FILE = "timer-card.js"

# How long finished timers are retained in the sensor's "finished" attribute (seconds)
FINISHED_RETENTION_SECONDS = 30 * 60

# Domains the user can normally set a value for via the HA UI. Restricting
# the picker to these prevents creating timers for read-only entities like
# sensors, binary_sensors, weather, device_tracker, etc.
SUPPORTED_DOMAINS = (
    "switch",
    "light",
    "input_boolean",
    "number",
    "input_number",
    "input_text",
    "climate",
    "cover",
    "fan",
    "select",
    "input_select",
    "media_player",
    "lock",
    "vacuum",
    "humidifier",
    "water_heater",
    "siren",
    "valve",
    "lawn_mower",
)
