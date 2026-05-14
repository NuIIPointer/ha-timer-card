/*!
 * Timer Card — a Lovelace card that creates server-side timers which set
 * any entity to a desired value when they expire.
 *
 * Pairs with the `timer_card` custom integration.
 *
 * Implementation note: this file uses vanilla Web Components (HTMLElement)
 * rather than Lit so we don't have to bundle a second copy of Lit nor rely
 * on fragile prototype-extraction tricks that broke in HA's Lit 3 upgrade.
 * Heavy lifting (entity picker, dialog, text fields) is delegated to HA's
 * own registered components, which we compose via innerHTML.
 */
(() => {
  "use strict";

  const CARD_VERSION = "0.1.11";
  const SENSOR_ENTITY = "sensor.timer_card";
  // Domains where the user can normally set a value via the HA UI. Entities
  // outside this list (sensors, binary_sensors, device_tracker, weather, etc.)
  // are read-only and not useful as timer targets.
  const DEFAULT_DOMAINS = [
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
  ];

  // ------------------------------------------------------------------
  // i18n
  // ------------------------------------------------------------------
  const STRINGS = {
    "en": {
      add_timer: "Add timer",
      no_timers: "No active timers",
      step_entity: "Choose entity",
      step_value: "Target value",
      step_time: "Timer duration",
      favorites: "Favorites",
      entity: "Entity",
      target_value: "Target value",
      tab_duration: "Duration",
      tab_time: "Time",
      hours: "h",
      minutes: "m",
      seconds: "s",
      at_time: "At time",
      label_optional: "Label (optional)",
      cancel: "Cancel",
      back: "Back",
      next: "Next",
      ok: "OK",
      delete: "Delete",
      edit: "Edit",
      adjust_duration: "Adjust duration",
      current_remaining: "Current remaining",
      new_duration: "New duration",
      add: "Add",
      subtract: "Subtract",
      finished: "Finished",
      clear_finished: "Clear finished",
      will_set: "Sets",
      to: "to",
      on: "On",
      off: "Off",
      open: "Open",
      close: "Close",
      play: "Play",
      pause: "Pause",
      stop: "Stop",
      position: "Position",
      brightness: "Brightness",
      temperature: "Temperature",
      hvac_mode: "Mode",
      percentage: "Percentage",
      min_short: "m",
      h_short: "h",
      now: "Now",
      in_1h: "In 1h",
      tomorrow_morning: "7 AM",
      humidity: "Humidity",
      lock_lock: "Lock",
      lock_unlock: "Unlock",
      vacuum_start: "Start",
      vacuum_return: "Dock",
      lawn_start: "Start",
      lawn_dock: "Dock",
      domain_filter: "Allowed entity domains",
      favorites_label: "Quick-select favorites",
      add_favorite: "Add favorite…",
      remove_favorite: "Remove",
      title_label: "Card title (optional)",
      title_placeholder: "Timer Card",
      card_id_label: "Card ID (advanced)",
      card_id_help: "Identifies this card instance. Timers are scoped to this id.",
      regenerate: "Regenerate",
      configure_hint: "Add favorites and choose which entity domains can be selected.",
      missing_value: "Please choose a target value.",
      missing_duration: "Duration must be greater than zero.",
      missing_time: "Please pick a time.",
      missing_entity: "Please choose an entity.",
      sensor_missing: "sensor.timer_card not found — is the integration installed?",
      show_finished_label: "Show finished timers",
    },
    "de": {
      add_timer: "Timer hinzufügen",
      no_timers: "Keine aktiven Timer",
      step_entity: "Entität wählen",
      step_value: "Zielwert",
      step_time: "Timer-Dauer",
      favorites: "Favoriten",
      entity: "Entität",
      target_value: "Zielwert",
      tab_duration: "Dauer",
      tab_time: "Uhrzeit",
      hours: "Std.",
      minutes: "Min.",
      seconds: "Sek.",
      at_time: "Uhrzeit",
      label_optional: "Bezeichnung (optional)",
      cancel: "Abbrechen",
      back: "Zurück",
      next: "Weiter",
      ok: "OK",
      delete: "Löschen",
      edit: "Bearbeiten",
      adjust_duration: "Dauer anpassen",
      current_remaining: "Aktuell verbleibend",
      new_duration: "Neue Dauer",
      add: "Verlängern",
      subtract: "Verkürzen",
      finished: "Abgeschlossen",
      clear_finished: "Abgeschlossene leeren",
      will_set: "Setzt",
      to: "auf",
      on: "An",
      off: "Aus",
      open: "Öffnen",
      close: "Schließen",
      play: "Wiedergabe",
      pause: "Pause",
      stop: "Stopp",
      position: "Position",
      brightness: "Helligkeit",
      temperature: "Temperatur",
      hvac_mode: "Modus",
      percentage: "Prozent",
      min_short: "min",
      h_short: "h",
      now: "Jetzt",
      in_1h: "In 1h",
      tomorrow_morning: "7 Uhr",
      humidity: "Luftfeuchte",
      lock_lock: "Abschließen",
      lock_unlock: "Aufschließen",
      vacuum_start: "Starten",
      vacuum_return: "Dock",
      lawn_start: "Starten",
      lawn_dock: "Dock",
      domain_filter: "Erlaubte Entitäts-Domains",
      favorites_label: "Schnellauswahl-Favoriten",
      add_favorite: "Favorit hinzufügen…",
      remove_favorite: "Entfernen",
      title_label: "Karten-Titel (optional)",
      title_placeholder: "Timer Card",
      card_id_label: "Karten-ID (Fortgeschritten)",
      card_id_help: "Identifiziert diese Karteninstanz. Timer sind dieser ID zugeordnet.",
      regenerate: "Neu generieren",
      configure_hint: "Füge Favoriten hinzu und lege fest, welche Entitäts-Domains wählbar sind.",
      missing_value: "Bitte wähle einen Zielwert.",
      missing_duration: "Die Dauer muss größer als 0 sein.",
      missing_time: "Bitte wähle eine Uhrzeit.",
      missing_entity: "Bitte wähle eine Entität.",
      sensor_missing: "sensor.timer_card wurde nicht gefunden – ist die Integration installiert?",
      show_finished_label: "Abgeschlossene Timer anzeigen",
    },
    "fr": {
      add_timer: "Ajouter un minuteur",
      no_timers: "Aucun minuteur actif",
      step_entity: "Choisir une entité",
      step_value: "Valeur cible",
      step_time: "Durée du minuteur",
      favorites: "Favoris",
      entity: "Entité",
      target_value: "Valeur cible",
      tab_duration: "Durée",
      tab_time: "Heure",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "À l'heure",
      label_optional: "Étiquette (facultatif)",
      cancel: "Annuler",
      back: "Retour",
      next: "Suivant",
      ok: "OK",
      delete: "Supprimer",
      edit: "Modifier",
      adjust_duration: "Ajuster la durée",
      current_remaining: "Temps restant",
      new_duration: "Nouvelle durée",
      add: "Prolonger",
      subtract: "Raccourcir",
      finished: "Terminés",
      clear_finished: "Effacer les terminés",
      will_set: "Définit",
      to: "sur",
      on: "Marche",
      off: "Arrêt",
      open: "Ouvrir",
      close: "Fermer",
      play: "Lecture",
      pause: "Pause",
      stop: "Arrêt",
      position: "Position",
      brightness: "Luminosité",
      temperature: "Température",
      hvac_mode: "Mode",
      percentage: "Pourcentage",
      min_short: "min",
      h_short: "h",
      now: "Maintenant",
      in_1h: "Dans 1h",
      tomorrow_morning: "7h",
      humidity: "Humidité",
      lock_lock: "Verrouiller",
      lock_unlock: "Déverrouiller",
      vacuum_start: "Démarrer",
      vacuum_return: "Base",
      lawn_start: "Démarrer",
      lawn_dock: "Base",
      domain_filter: "Domaines d'entités autorisés",
      favorites_label: "Favoris pour sélection rapide",
      add_favorite: "Ajouter un favori…",
      remove_favorite: "Supprimer",
      title_label: "Titre de la carte (facultatif)",
      title_placeholder: "Timer Card",
      card_id_label: "ID de la carte (avancé)",
      card_id_help: "Identifie cette instance de carte. Les minuteurs sont rattachés à cet ID.",
      regenerate: "Régénérer",
      configure_hint: "Ajoutez des favoris et choisissez les domaines d'entités sélectionnables.",
      missing_value: "Veuillez choisir une valeur cible.",
      missing_duration: "La durée doit être supérieure à zéro.",
      missing_time: "Veuillez choisir une heure.",
      missing_entity: "Veuillez choisir une entité.",
      sensor_missing: "sensor.timer_card introuvable — l'intégration est-elle installée ?",
      show_finished_label: "Afficher les minuteurs terminés",
    },
    "es": {
      add_timer: "Añadir temporizador",
      no_timers: "Sin temporizadores activos",
      step_entity: "Elegir entidad",
      step_value: "Valor objetivo",
      step_time: "Duración del temporizador",
      favorites: "Favoritos",
      entity: "Entidad",
      target_value: "Valor objetivo",
      tab_duration: "Duración",
      tab_time: "Hora",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "A las",
      label_optional: "Etiqueta (opcional)",
      cancel: "Cancelar",
      back: "Atrás",
      next: "Siguiente",
      ok: "OK",
      delete: "Eliminar",
      edit: "Editar",
      adjust_duration: "Ajustar duración",
      current_remaining: "Tiempo restante",
      new_duration: "Nueva duración",
      add: "Ampliar",
      subtract: "Acortar",
      finished: "Finalizados",
      clear_finished: "Borrar finalizados",
      will_set: "Establece",
      to: "a",
      on: "Encendido",
      off: "Apagado",
      open: "Abrir",
      close: "Cerrar",
      play: "Reproducir",
      pause: "Pausa",
      stop: "Detener",
      position: "Posición",
      brightness: "Brillo",
      temperature: "Temperatura",
      hvac_mode: "Modo",
      percentage: "Porcentaje",
      min_short: "min",
      h_short: "h",
      now: "Ahora",
      in_1h: "En 1h",
      tomorrow_morning: "7:00",
      humidity: "Humedad",
      lock_lock: "Bloquear",
      lock_unlock: "Desbloquear",
      vacuum_start: "Iniciar",
      vacuum_return: "Base",
      lawn_start: "Iniciar",
      lawn_dock: "Base",
      domain_filter: "Dominios de entidad permitidos",
      favorites_label: "Favoritos de selección rápida",
      add_favorite: "Añadir favorito…",
      remove_favorite: "Eliminar",
      title_label: "Título de la tarjeta (opcional)",
      title_placeholder: "Timer Card",
      card_id_label: "ID de la tarjeta (avanzado)",
      card_id_help: "Identifica esta instancia de tarjeta. Los temporizadores están asociados a este ID.",
      regenerate: "Regenerar",
      configure_hint: "Añade favoritos y elige qué dominios de entidad se pueden seleccionar.",
      missing_value: "Elige un valor objetivo.",
      missing_duration: "La duración debe ser mayor que cero.",
      missing_time: "Elige una hora.",
      missing_entity: "Elige una entidad.",
      sensor_missing: "sensor.timer_card no encontrado — ¿está instalada la integración?",
      show_finished_label: "Mostrar temporizadores finalizados",
    },
    "it": {
      add_timer: "Aggiungi timer",
      no_timers: "Nessun timer attivo",
      step_entity: "Scegli entità",
      step_value: "Valore target",
      step_time: "Durata timer",
      favorites: "Preferiti",
      entity: "Entità",
      target_value: "Valore target",
      tab_duration: "Durata",
      tab_time: "Orario",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "Alle",
      label_optional: "Etichetta (opzionale)",
      cancel: "Annulla",
      back: "Indietro",
      next: "Avanti",
      ok: "OK",
      delete: "Elimina",
      edit: "Modifica",
      adjust_duration: "Modifica durata",
      current_remaining: "Tempo rimanente",
      new_duration: "Nuova durata",
      add: "Estendi",
      subtract: "Riduci",
      finished: "Completati",
      clear_finished: "Cancella completati",
      will_set: "Imposta",
      to: "a",
      on: "Acceso",
      off: "Spento",
      open: "Apri",
      close: "Chiudi",
      play: "Riproduci",
      pause: "Pausa",
      stop: "Stop",
      position: "Posizione",
      brightness: "Luminosità",
      temperature: "Temperatura",
      hvac_mode: "Modalità",
      percentage: "Percentuale",
      min_short: "min",
      h_short: "h",
      now: "Ora",
      in_1h: "Tra 1h",
      tomorrow_morning: "7:00",
      humidity: "Umidità",
      lock_lock: "Blocca",
      lock_unlock: "Sblocca",
      vacuum_start: "Avvia",
      vacuum_return: "Base",
      lawn_start: "Avvia",
      lawn_dock: "Base",
      domain_filter: "Domini entità consentiti",
      favorites_label: "Preferiti di selezione rapida",
      add_favorite: "Aggiungi preferito…",
      remove_favorite: "Rimuovi",
      title_label: "Titolo scheda (opzionale)",
      title_placeholder: "Timer Card",
      card_id_label: "ID scheda (avanzato)",
      card_id_help: "Identifica questa istanza della scheda. I timer sono legati a questo ID.",
      regenerate: "Rigenera",
      configure_hint: "Aggiungi preferiti e scegli quali domini entità sono selezionabili.",
      missing_value: "Scegli un valore target.",
      missing_duration: "La durata deve essere maggiore di zero.",
      missing_time: "Scegli un orario.",
      missing_entity: "Scegli un'entità.",
      sensor_missing: "sensor.timer_card non trovato — l'integrazione è installata?",
      show_finished_label: "Mostra timer completati",
    },
    "nl": {
      add_timer: "Timer toevoegen",
      no_timers: "Geen actieve timers",
      step_entity: "Entiteit kiezen",
      step_value: "Doelwaarde",
      step_time: "Timerduur",
      favorites: "Favorieten",
      entity: "Entiteit",
      target_value: "Doelwaarde",
      tab_duration: "Duur",
      tab_time: "Tijdstip",
      hours: "u",
      minutes: "min",
      seconds: "s",
      at_time: "Om",
      label_optional: "Label (optioneel)",
      cancel: "Annuleren",
      back: "Terug",
      next: "Volgende",
      ok: "OK",
      delete: "Verwijderen",
      edit: "Bewerken",
      adjust_duration: "Duur aanpassen",
      current_remaining: "Resterende tijd",
      new_duration: "Nieuwe duur",
      add: "Verlengen",
      subtract: "Verkorten",
      finished: "Voltooid",
      clear_finished: "Voltooide wissen",
      will_set: "Stelt",
      to: "in op",
      on: "Aan",
      off: "Uit",
      open: "Open",
      close: "Dicht",
      play: "Afspelen",
      pause: "Pauze",
      stop: "Stop",
      position: "Positie",
      brightness: "Helderheid",
      temperature: "Temperatuur",
      hvac_mode: "Modus",
      percentage: "Percentage",
      min_short: "min",
      h_short: "u",
      now: "Nu",
      in_1h: "Over 1u",
      tomorrow_morning: "7:00",
      humidity: "Luchtvochtigheid",
      lock_lock: "Vergrendelen",
      lock_unlock: "Ontgrendelen",
      vacuum_start: "Start",
      vacuum_return: "Dock",
      lawn_start: "Start",
      lawn_dock: "Dock",
      domain_filter: "Toegestane entiteitsdomeinen",
      favorites_label: "Favorieten voor snelkeuze",
      add_favorite: "Favoriet toevoegen…",
      remove_favorite: "Verwijderen",
      title_label: "Kaarttitel (optioneel)",
      title_placeholder: "Timer Card",
      card_id_label: "Kaart-ID (geavanceerd)",
      card_id_help: "Identificeert deze kaartinstantie. Timers zijn aan dit ID gekoppeld.",
      regenerate: "Vernieuwen",
      configure_hint: "Voeg favorieten toe en kies welke entiteitsdomeinen selecteerbaar zijn.",
      missing_value: "Kies een doelwaarde.",
      missing_duration: "De duur moet groter zijn dan nul.",
      missing_time: "Kies een tijdstip.",
      missing_entity: "Kies een entiteit.",
      sensor_missing: "sensor.timer_card niet gevonden — is de integratie geïnstalleerd?",
      show_finished_label: "Voltooide timers tonen",
    },
    "pt": {
      add_timer: "Adicionar temporizador",
      no_timers: "Sem temporizadores activos",
      step_entity: "Escolher entidade",
      step_value: "Valor alvo",
      step_time: "Duração do temporizador",
      favorites: "Favoritos",
      entity: "Entidade",
      target_value: "Valor alvo",
      tab_duration: "Duração",
      tab_time: "Hora",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "Às",
      label_optional: "Etiqueta (opcional)",
      cancel: "Cancelar",
      back: "Voltar",
      next: "Seguinte",
      ok: "OK",
      delete: "Eliminar",
      edit: "Editar",
      adjust_duration: "Ajustar duração",
      current_remaining: "Tempo restante",
      new_duration: "Nova duração",
      add: "Estender",
      subtract: "Encurtar",
      finished: "Concluídos",
      clear_finished: "Limpar concluídos",
      will_set: "Define",
      to: "para",
      on: "Ligado",
      off: "Desligado",
      open: "Abrir",
      close: "Fechar",
      play: "Reproduzir",
      pause: "Pausa",
      stop: "Parar",
      position: "Posição",
      brightness: "Brilho",
      temperature: "Temperatura",
      hvac_mode: "Modo",
      percentage: "Percentagem",
      min_short: "min",
      h_short: "h",
      now: "Agora",
      in_1h: "Em 1h",
      tomorrow_morning: "7:00",
      humidity: "Humidade",
      lock_lock: "Bloquear",
      lock_unlock: "Desbloquear",
      vacuum_start: "Iniciar",
      vacuum_return: "Base",
      lawn_start: "Iniciar",
      lawn_dock: "Base",
      domain_filter: "Domínios de entidade permitidos",
      favorites_label: "Favoritos de seleção rápida",
      add_favorite: "Adicionar favorito…",
      remove_favorite: "Remover",
      title_label: "Título do cartão (opcional)",
      title_placeholder: "Timer Card",
      card_id_label: "ID do cartão (avançado)",
      card_id_help: "Identifica esta instância do cartão. Os temporizadores estão ligados a este ID.",
      regenerate: "Regenerar",
      configure_hint: "Adicione favoritos e escolha que domínios de entidade são selecionáveis.",
      missing_value: "Escolha um valor alvo.",
      missing_duration: "A duração deve ser maior que zero.",
      missing_time: "Escolha uma hora.",
      missing_entity: "Escolha uma entidade.",
      sensor_missing: "sensor.timer_card não encontrado — a integração está instalada?",
      show_finished_label: "Mostrar temporizadores concluídos",
    },
    "pl": {
      add_timer: "Dodaj minutnik",
      no_timers: "Brak aktywnych minutników",
      step_entity: "Wybierz encję",
      step_value: "Wartość docelowa",
      step_time: "Czas minutnika",
      favorites: "Ulubione",
      entity: "Encja",
      target_value: "Wartość docelowa",
      tab_duration: "Czas trwania",
      tab_time: "Godzina",
      hours: "godz.",
      minutes: "min",
      seconds: "s",
      at_time: "O godz.",
      label_optional: "Etykieta (opcjonalna)",
      cancel: "Anuluj",
      back: "Wstecz",
      next: "Dalej",
      ok: "OK",
      delete: "Usuń",
      edit: "Edytuj",
      adjust_duration: "Dostosuj czas",
      current_remaining: "Pozostały czas",
      new_duration: "Nowy czas",
      add: "Wydłuż",
      subtract: "Skróć",
      finished: "Zakończone",
      clear_finished: "Wyczyść zakończone",
      will_set: "Ustawia",
      to: "na",
      on: "Wł.",
      off: "Wył.",
      open: "Otwórz",
      close: "Zamknij",
      play: "Odtwarzaj",
      pause: "Pauza",
      stop: "Stop",
      position: "Pozycja",
      brightness: "Jasność",
      temperature: "Temperatura",
      hvac_mode: "Tryb",
      percentage: "Procent",
      min_short: "min",
      h_short: "godz.",
      now: "Teraz",
      in_1h: "Za 1h",
      tomorrow_morning: "7:00",
      humidity: "Wilgotność",
      lock_lock: "Zablokuj",
      lock_unlock: "Odblokuj",
      vacuum_start: "Start",
      vacuum_return: "Dok",
      lawn_start: "Start",
      lawn_dock: "Dok",
      domain_filter: "Dozwolone domeny encji",
      favorites_label: "Ulubione do szybkiego wyboru",
      add_favorite: "Dodaj ulubione…",
      remove_favorite: "Usuń",
      title_label: "Tytuł karty (opcjonalny)",
      title_placeholder: "Timer Card",
      card_id_label: "ID karty (zaawansowane)",
      card_id_help: "Identyfikuje tę instancję karty. Minutniki są powiązane z tym ID.",
      regenerate: "Wygeneruj ponownie",
      configure_hint: "Dodaj ulubione i wybierz, które domeny encji są wybieralne.",
      missing_value: "Wybierz wartość docelową.",
      missing_duration: "Czas trwania musi być większy od zera.",
      missing_time: "Wybierz godzinę.",
      missing_entity: "Wybierz encję.",
      sensor_missing: "Nie znaleziono sensor.timer_card — czy integracja jest zainstalowana?",
      show_finished_label: "Pokaż zakończone minutniki",
    },
    "sv": {
      add_timer: "Lägg till timer",
      no_timers: "Inga aktiva timers",
      step_entity: "Välj entitet",
      step_value: "Målvärde",
      step_time: "Timerns längd",
      favorites: "Favoriter",
      entity: "Entitet",
      target_value: "Målvärde",
      tab_duration: "Tid",
      tab_time: "Klockslag",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "Klockan",
      label_optional: "Etikett (valfri)",
      cancel: "Avbryt",
      back: "Tillbaka",
      next: "Nästa",
      ok: "OK",
      delete: "Ta bort",
      edit: "Redigera",
      adjust_duration: "Justera tid",
      current_remaining: "Återstående tid",
      new_duration: "Ny tid",
      add: "Förläng",
      subtract: "Förkorta",
      finished: "Klara",
      clear_finished: "Rensa klara",
      will_set: "Sätter",
      to: "till",
      on: "På",
      off: "Av",
      open: "Öppna",
      close: "Stäng",
      play: "Spela",
      pause: "Paus",
      stop: "Stopp",
      position: "Position",
      brightness: "Ljusstyrka",
      temperature: "Temperatur",
      hvac_mode: "Läge",
      percentage: "Procent",
      min_short: "min",
      h_short: "h",
      now: "Nu",
      in_1h: "Om 1h",
      tomorrow_morning: "07:00",
      humidity: "Luftfuktighet",
      lock_lock: "Lås",
      lock_unlock: "Lås upp",
      vacuum_start: "Starta",
      vacuum_return: "Docka",
      lawn_start: "Starta",
      lawn_dock: "Docka",
      domain_filter: "Tillåtna entitetsdomäner",
      favorites_label: "Snabbvalsfavoriter",
      add_favorite: "Lägg till favorit…",
      remove_favorite: "Ta bort",
      title_label: "Korttitel (valfri)",
      title_placeholder: "Timer Card",
      card_id_label: "Kort-ID (avancerat)",
      card_id_help: "Identifierar denna kortinstans. Timers är kopplade till detta ID.",
      regenerate: "Generera nytt",
      configure_hint: "Lägg till favoriter och välj vilka entitetsdomäner som kan väljas.",
      missing_value: "Välj ett målvärde.",
      missing_duration: "Tiden måste vara större än noll.",
      missing_time: "Välj ett klockslag.",
      missing_entity: "Välj en entitet.",
      sensor_missing: "sensor.timer_card hittades inte — är integrationen installerad?",
      show_finished_label: "Visa klara timers",
    },
    "da": {
      add_timer: "Tilføj timer",
      no_timers: "Ingen aktive timere",
      step_entity: "Vælg entitet",
      step_value: "Målværdi",
      step_time: "Timerens varighed",
      favorites: "Favoritter",
      entity: "Entitet",
      target_value: "Målværdi",
      tab_duration: "Varighed",
      tab_time: "Tidspunkt",
      hours: "t",
      minutes: "min",
      seconds: "s",
      at_time: "Kl.",
      label_optional: "Etiket (valgfri)",
      cancel: "Annullér",
      back: "Tilbage",
      next: "Næste",
      ok: "OK",
      delete: "Slet",
      edit: "Rediger",
      adjust_duration: "Justér varighed",
      current_remaining: "Tilbageværende",
      new_duration: "Ny varighed",
      add: "Forlæng",
      subtract: "Forkort",
      finished: "Færdige",
      clear_finished: "Ryd færdige",
      will_set: "Sætter",
      to: "til",
      on: "Tændt",
      off: "Slukket",
      open: "Åbn",
      close: "Luk",
      play: "Afspil",
      pause: "Pause",
      stop: "Stop",
      position: "Position",
      brightness: "Lysstyrke",
      temperature: "Temperatur",
      hvac_mode: "Tilstand",
      percentage: "Procent",
      min_short: "min",
      h_short: "t",
      now: "Nu",
      in_1h: "Om 1t",
      tomorrow_morning: "07:00",
      humidity: "Luftfugtighed",
      lock_lock: "Lås",
      lock_unlock: "Lås op",
      vacuum_start: "Start",
      vacuum_return: "Dock",
      lawn_start: "Start",
      lawn_dock: "Dock",
      domain_filter: "Tilladte entitetsdomæner",
      favorites_label: "Hurtigvalg-favoritter",
      add_favorite: "Tilføj favorit…",
      remove_favorite: "Fjern",
      title_label: "Korttitel (valgfri)",
      title_placeholder: "Timer Card",
      card_id_label: "Kort-ID (avanceret)",
      card_id_help: "Identificerer denne kortinstans. Timere er knyttet til dette ID.",
      regenerate: "Generér ny",
      configure_hint: "Tilføj favoritter og vælg, hvilke entitetsdomæner der kan vælges.",
      missing_value: "Vælg en målværdi.",
      missing_duration: "Varigheden skal være større end nul.",
      missing_time: "Vælg et tidspunkt.",
      missing_entity: "Vælg en entitet.",
      sensor_missing: "sensor.timer_card ikke fundet — er integrationen installeret?",
      show_finished_label: "Vis færdige timere",
    },
    "nb": {
      add_timer: "Legg til tidtaker",
      no_timers: "Ingen aktive tidtakere",
      step_entity: "Velg entitet",
      step_value: "Målverdi",
      step_time: "Tidtakerlengde",
      favorites: "Favoritter",
      entity: "Entitet",
      target_value: "Målverdi",
      tab_duration: "Varighet",
      tab_time: "Klokkeslett",
      hours: "t",
      minutes: "min",
      seconds: "s",
      at_time: "Kl.",
      label_optional: "Etikett (valgfri)",
      cancel: "Avbryt",
      back: "Tilbake",
      next: "Neste",
      ok: "OK",
      delete: "Slett",
      edit: "Rediger",
      adjust_duration: "Juster varighet",
      current_remaining: "Gjenstående tid",
      new_duration: "Ny varighet",
      add: "Forleng",
      subtract: "Forkort",
      finished: "Ferdige",
      clear_finished: "Tøm ferdige",
      will_set: "Setter",
      to: "til",
      on: "På",
      off: "Av",
      open: "Åpne",
      close: "Lukk",
      play: "Spill",
      pause: "Pause",
      stop: "Stopp",
      position: "Posisjon",
      brightness: "Lysstyrke",
      temperature: "Temperatur",
      hvac_mode: "Modus",
      percentage: "Prosent",
      min_short: "min",
      h_short: "t",
      now: "Nå",
      in_1h: "Om 1t",
      tomorrow_morning: "07:00",
      humidity: "Luftfuktighet",
      lock_lock: "Lås",
      lock_unlock: "Lås opp",
      vacuum_start: "Start",
      vacuum_return: "Dokk",
      lawn_start: "Start",
      lawn_dock: "Dokk",
      domain_filter: "Tillatte entitetsdomener",
      favorites_label: "Hurtigvalg-favoritter",
      add_favorite: "Legg til favoritt…",
      remove_favorite: "Fjern",
      title_label: "Korttittel (valgfri)",
      title_placeholder: "Timer Card",
      card_id_label: "Kort-ID (avansert)",
      card_id_help: "Identifiserer denne kortinstansen. Tidtakere er knyttet til denne ID-en.",
      regenerate: "Generer ny",
      configure_hint: "Legg til favoritter og velg hvilke entitetsdomener som kan velges.",
      missing_value: "Velg en målverdi.",
      missing_duration: "Varigheten må være større enn null.",
      missing_time: "Velg et klokkeslett.",
      missing_entity: "Velg en entitet.",
      sensor_missing: "sensor.timer_card ikke funnet — er integrasjonen installert?",
      show_finished_label: "Vis ferdige tidtakere",
    },
    "fi": {
      add_timer: "Lisää ajastin",
      no_timers: "Ei aktiivisia ajastimia",
      step_entity: "Valitse entiteetti",
      step_value: "Kohdearvo",
      step_time: "Ajastimen kesto",
      favorites: "Suosikit",
      entity: "Entiteetti",
      target_value: "Kohdearvo",
      tab_duration: "Kesto",
      tab_time: "Kellonaika",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "Klo",
      label_optional: "Nimike (valinnainen)",
      cancel: "Peruuta",
      back: "Takaisin",
      next: "Seuraava",
      ok: "OK",
      delete: "Poista",
      edit: "Muokkaa",
      adjust_duration: "Säädä kestoa",
      current_remaining: "Jäljellä",
      new_duration: "Uusi kesto",
      add: "Pidennä",
      subtract: "Lyhennä",
      finished: "Päättyneet",
      clear_finished: "Tyhjennä päättyneet",
      will_set: "Asettaa",
      to: "arvoon",
      on: "Päällä",
      off: "Pois",
      open: "Avaa",
      close: "Sulje",
      play: "Toista",
      pause: "Tauko",
      stop: "Pysäytä",
      position: "Sijainti",
      brightness: "Kirkkaus",
      temperature: "Lämpötila",
      hvac_mode: "Tila",
      percentage: "Prosentti",
      min_short: "min",
      h_short: "h",
      now: "Nyt",
      in_1h: "1h kuluttua",
      tomorrow_morning: "07:00",
      humidity: "Kosteus",
      lock_lock: "Lukitse",
      lock_unlock: "Avaa lukitus",
      vacuum_start: "Aloita",
      vacuum_return: "Telakka",
      lawn_start: "Aloita",
      lawn_dock: "Telakka",
      domain_filter: "Sallitut entiteettialueet",
      favorites_label: "Pikavalinta-suosikit",
      add_favorite: "Lisää suosikki…",
      remove_favorite: "Poista",
      title_label: "Kortin otsikko (valinnainen)",
      title_placeholder: "Timer Card",
      card_id_label: "Kortti-ID (edistynyt)",
      card_id_help: "Tunnistaa tämän korttiinstanssin. Ajastimet on sidottu tähän ID:hen.",
      regenerate: "Luo uusi",
      configure_hint: "Lisää suosikkeja ja valitse mitä entiteettialueita voidaan valita.",
      missing_value: "Valitse kohdearvo.",
      missing_duration: "Keston on oltava suurempi kuin nolla.",
      missing_time: "Valitse kellonaika.",
      missing_entity: "Valitse entiteetti.",
      sensor_missing: "sensor.timer_card ei löytynyt — onko integraatio asennettu?",
      show_finished_label: "Näytä päättyneet ajastimet",
    },
    "cs": {
      add_timer: "Přidat časovač",
      no_timers: "Žádné aktivní časovače",
      step_entity: "Vybrat entitu",
      step_value: "Cílová hodnota",
      step_time: "Délka časovače",
      favorites: "Oblíbené",
      entity: "Entita",
      target_value: "Cílová hodnota",
      tab_duration: "Délka",
      tab_time: "Čas",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "V",
      label_optional: "Název (volitelný)",
      cancel: "Zrušit",
      back: "Zpět",
      next: "Další",
      ok: "OK",
      delete: "Smazat",
      edit: "Upravit",
      adjust_duration: "Upravit délku",
      current_remaining: "Zbývá",
      new_duration: "Nová délka",
      add: "Prodloužit",
      subtract: "Zkrátit",
      finished: "Dokončené",
      clear_finished: "Vymazat dokončené",
      will_set: "Nastaví",
      to: "na",
      on: "Zap.",
      off: "Vyp.",
      open: "Otevřít",
      close: "Zavřít",
      play: "Přehrát",
      pause: "Pauza",
      stop: "Stop",
      position: "Pozice",
      brightness: "Jas",
      temperature: "Teplota",
      hvac_mode: "Režim",
      percentage: "Procento",
      min_short: "min",
      h_short: "h",
      now: "Teď",
      in_1h: "Za 1h",
      tomorrow_morning: "7:00",
      humidity: "Vlhkost",
      lock_lock: "Zamknout",
      lock_unlock: "Odemknout",
      vacuum_start: "Start",
      vacuum_return: "Dok",
      lawn_start: "Start",
      lawn_dock: "Dok",
      domain_filter: "Povolené domény entit",
      favorites_label: "Rychlý výběr oblíbených",
      add_favorite: "Přidat oblíbenou…",
      remove_favorite: "Odebrat",
      title_label: "Titulek karty (volitelný)",
      title_placeholder: "Timer Card",
      card_id_label: "ID karty (pokročilé)",
      card_id_help: "Identifikuje tuto instanci karty. Časovače jsou vázány na toto ID.",
      regenerate: "Vygenerovat znovu",
      configure_hint: "Přidejte oblíbené a zvolte, které domény entit lze vybrat.",
      missing_value: "Vyberte cílovou hodnotu.",
      missing_duration: "Délka musí být větší než nula.",
      missing_time: "Vyberte čas.",
      missing_entity: "Vyberte entitu.",
      sensor_missing: "sensor.timer_card nenalezen — je integrace nainstalována?",
      show_finished_label: "Zobrazit dokončené časovače",
    },
    "hu": {
      add_timer: "Időzítő hozzáadása",
      no_timers: "Nincs aktív időzítő",
      step_entity: "Entitás kiválasztása",
      step_value: "Célérték",
      step_time: "Időzítő időtartama",
      favorites: "Kedvencek",
      entity: "Entitás",
      target_value: "Célérték",
      tab_duration: "Időtartam",
      tab_time: "Időpont",
      hours: "ó",
      minutes: "p",
      seconds: "mp",
      at_time: "Időpont",
      label_optional: "Címke (opcionális)",
      cancel: "Mégse",
      back: "Vissza",
      next: "Tovább",
      ok: "OK",
      delete: "Törlés",
      edit: "Szerkesztés",
      adjust_duration: "Időtartam módosítása",
      current_remaining: "Hátralévő idő",
      new_duration: "Új időtartam",
      add: "Meghosszabbít",
      subtract: "Lerövidít",
      finished: "Befejezett",
      clear_finished: "Befejezettek törlése",
      will_set: "Beállítja",
      to: "értékre",
      on: "Be",
      off: "Ki",
      open: "Nyit",
      close: "Zár",
      play: "Lejátszás",
      pause: "Szünet",
      stop: "Leállítás",
      position: "Pozíció",
      brightness: "Fényerő",
      temperature: "Hőmérséklet",
      hvac_mode: "Mód",
      percentage: "Százalék",
      min_short: "p",
      h_short: "ó",
      now: "Most",
      in_1h: "1 ó múlva",
      tomorrow_morning: "7:00",
      humidity: "Páratartalom",
      lock_lock: "Bezár",
      lock_unlock: "Kinyit",
      vacuum_start: "Indít",
      vacuum_return: "Dokk",
      lawn_start: "Indít",
      lawn_dock: "Dokk",
      domain_filter: "Engedélyezett entitás-domének",
      favorites_label: "Gyorsválasztó kedvencek",
      add_favorite: "Kedvenc hozzáadása…",
      remove_favorite: "Eltávolít",
      title_label: "Kártya címe (opcionális)",
      title_placeholder: "Timer Card",
      card_id_label: "Kártya azonosító (haladó)",
      card_id_help: "Azonosítja ezt a kártyapéldányt. Az időzítők ehhez az ID-hez tartoznak.",
      regenerate: "Újragenerálás",
      configure_hint: "Adj hozzá kedvenceket és válaszd ki, mely entitás-domének választhatók.",
      missing_value: "Válassz egy célértéket.",
      missing_duration: "Az időtartamnak nagyobbnak kell lennie nullánál.",
      missing_time: "Válassz egy időpontot.",
      missing_entity: "Válassz egy entitást.",
      sensor_missing: "sensor.timer_card nem található — az integráció telepítve van?",
      show_finished_label: "Befejezett időzítők megjelenítése",
    },
    "ru": {
      add_timer: "Добавить таймер",
      no_timers: "Нет активных таймеров",
      step_entity: "Выбрать сущность",
      step_value: "Целевое значение",
      step_time: "Длительность таймера",
      favorites: "Избранное",
      entity: "Сущность",
      target_value: "Целевое значение",
      tab_duration: "Длительность",
      tab_time: "Время",
      hours: "ч",
      minutes: "мин",
      seconds: "с",
      at_time: "В",
      label_optional: "Метка (необязательно)",
      cancel: "Отмена",
      back: "Назад",
      next: "Далее",
      ok: "ОК",
      delete: "Удалить",
      edit: "Изменить",
      adjust_duration: "Изменить длительность",
      current_remaining: "Осталось",
      new_duration: "Новая длительность",
      add: "Продлить",
      subtract: "Сократить",
      finished: "Завершённые",
      clear_finished: "Очистить завершённые",
      will_set: "Установит",
      to: "на",
      on: "Вкл.",
      off: "Выкл.",
      open: "Открыть",
      close: "Закрыть",
      play: "Воспроизвести",
      pause: "Пауза",
      stop: "Стоп",
      position: "Позиция",
      brightness: "Яркость",
      temperature: "Температура",
      hvac_mode: "Режим",
      percentage: "Процент",
      min_short: "мин",
      h_short: "ч",
      now: "Сейчас",
      in_1h: "Через 1ч",
      tomorrow_morning: "7:00",
      humidity: "Влажность",
      lock_lock: "Запереть",
      lock_unlock: "Отпереть",
      vacuum_start: "Старт",
      vacuum_return: "База",
      lawn_start: "Старт",
      lawn_dock: "База",
      domain_filter: "Разрешённые домены сущностей",
      favorites_label: "Избранное быстрого выбора",
      add_favorite: "Добавить избранное…",
      remove_favorite: "Удалить",
      title_label: "Заголовок карты (необязательно)",
      title_placeholder: "Timer Card",
      card_id_label: "ID карты (продвинутое)",
      card_id_help: "Идентифицирует этот экземпляр карты. Таймеры привязаны к этому ID.",
      regenerate: "Сгенерировать заново",
      configure_hint: "Добавьте избранное и выберите, какие домены сущностей доступны для выбора.",
      missing_value: "Выберите целевое значение.",
      missing_duration: "Длительность должна быть больше нуля.",
      missing_time: "Выберите время.",
      missing_entity: "Выберите сущность.",
      sensor_missing: "sensor.timer_card не найден — установлена ли интеграция?",
      show_finished_label: "Показывать завершённые таймеры",
    },
    "tr": {
      add_timer: "Zamanlayıcı ekle",
      no_timers: "Aktif zamanlayıcı yok",
      step_entity: "Varlık seç",
      step_value: "Hedef değer",
      step_time: "Zamanlayıcı süresi",
      favorites: "Favoriler",
      entity: "Varlık",
      target_value: "Hedef değer",
      tab_duration: "Süre",
      tab_time: "Saat",
      hours: "sa",
      minutes: "dk",
      seconds: "sn",
      at_time: "Saatte",
      label_optional: "Etiket (isteğe bağlı)",
      cancel: "İptal",
      back: "Geri",
      next: "İleri",
      ok: "Tamam",
      delete: "Sil",
      edit: "Düzenle",
      adjust_duration: "Süreyi ayarla",
      current_remaining: "Kalan süre",
      new_duration: "Yeni süre",
      add: "Uzat",
      subtract: "Kısalt",
      finished: "Tamamlananlar",
      clear_finished: "Tamamlananları temizle",
      will_set: "Ayarlar",
      to: "değerine",
      on: "Açık",
      off: "Kapalı",
      open: "Aç",
      close: "Kapat",
      play: "Oynat",
      pause: "Duraklat",
      stop: "Durdur",
      position: "Konum",
      brightness: "Parlaklık",
      temperature: "Sıcaklık",
      hvac_mode: "Mod",
      percentage: "Yüzde",
      min_short: "dk",
      h_short: "sa",
      now: "Şimdi",
      in_1h: "1 sa sonra",
      tomorrow_morning: "07:00",
      humidity: "Nem",
      lock_lock: "Kilitle",
      lock_unlock: "Kilidi aç",
      vacuum_start: "Başlat",
      vacuum_return: "Dok",
      lawn_start: "Başlat",
      lawn_dock: "Dok",
      domain_filter: "İzin verilen varlık alan adları",
      favorites_label: "Hızlı seçim favorileri",
      add_favorite: "Favori ekle…",
      remove_favorite: "Kaldır",
      title_label: "Kart başlığı (isteğe bağlı)",
      title_placeholder: "Timer Card",
      card_id_label: "Kart kimliği (gelişmiş)",
      card_id_help: "Bu kart örneğini tanımlar. Zamanlayıcılar bu kimliğe bağlıdır.",
      regenerate: "Yeniden oluştur",
      configure_hint: "Favoriler ekleyin ve hangi varlık alan adlarının seçilebileceğini belirleyin.",
      missing_value: "Bir hedef değer seçin.",
      missing_duration: "Süre sıfırdan büyük olmalı.",
      missing_time: "Bir saat seçin.",
      missing_entity: "Bir varlık seçin.",
      sensor_missing: "sensor.timer_card bulunamadı — entegrasyon kurulu mu?",
      show_finished_label: "Tamamlanan zamanlayıcıları göster",
    },
    "ja": {
      add_timer: "タイマーを追加",
      no_timers: "アクティブなタイマーはありません",
      step_entity: "エンティティを選択",
      step_value: "目標値",
      step_time: "タイマーの長さ",
      favorites: "お気に入り",
      entity: "エンティティ",
      target_value: "目標値",
      tab_duration: "期間",
      tab_time: "時刻",
      hours: "時",
      minutes: "分",
      seconds: "秒",
      at_time: "時刻",
      label_optional: "ラベル(任意)",
      cancel: "キャンセル",
      back: "戻る",
      next: "次へ",
      ok: "OK",
      delete: "削除",
      edit: "編集",
      adjust_duration: "期間を調整",
      current_remaining: "残り時間",
      new_duration: "新しい期間",
      add: "延長",
      subtract: "短縮",
      finished: "完了",
      clear_finished: "完了をクリア",
      will_set: "設定",
      to: "→",
      on: "オン",
      off: "オフ",
      open: "開",
      close: "閉",
      play: "再生",
      pause: "一時停止",
      stop: "停止",
      position: "位置",
      brightness: "明るさ",
      temperature: "温度",
      hvac_mode: "モード",
      percentage: "%",
      min_short: "分",
      h_short: "時",
      now: "今",
      in_1h: "1時間後",
      tomorrow_morning: "7時",
      humidity: "湿度",
      lock_lock: "施錠",
      lock_unlock: "解錠",
      vacuum_start: "開始",
      vacuum_return: "ドック",
      lawn_start: "開始",
      lawn_dock: "ドック",
      domain_filter: "許可するエンティティドメイン",
      favorites_label: "クイック選択のお気に入り",
      add_favorite: "お気に入りを追加…",
      remove_favorite: "削除",
      title_label: "カードタイトル(任意)",
      title_placeholder: "Timer Card",
      card_id_label: "カードID(詳細)",
      card_id_help: "このカードインスタンスを識別します。タイマーはこのIDに紐付けられます。",
      regenerate: "再生成",
      configure_hint: "お気に入りを追加し、選択可能なエンティティドメインを選んでください。",
      missing_value: "目標値を選択してください。",
      missing_duration: "期間は0より大きくなければなりません。",
      missing_time: "時刻を選択してください。",
      missing_entity: "エンティティを選択してください。",
      sensor_missing: "sensor.timer_card が見つかりません — 統合はインストールされていますか?",
      show_finished_label: "完了したタイマーを表示",
    },
    "zh-Hans": {
      add_timer: "添加定时器",
      no_timers: "没有活动的定时器",
      step_entity: "选择实体",
      step_value: "目标值",
      step_time: "定时器时长",
      favorites: "收藏",
      entity: "实体",
      target_value: "目标值",
      tab_duration: "时长",
      tab_time: "时间",
      hours: "时",
      minutes: "分",
      seconds: "秒",
      at_time: "时间",
      label_optional: "标签(可选)",
      cancel: "取消",
      back: "返回",
      next: "下一步",
      ok: "确定",
      delete: "删除",
      edit: "编辑",
      adjust_duration: "调整时长",
      current_remaining: "剩余时间",
      new_duration: "新时长",
      add: "延长",
      subtract: "缩短",
      finished: "已完成",
      clear_finished: "清除已完成",
      will_set: "设置",
      to: "为",
      on: "开",
      off: "关",
      open: "打开",
      close: "关闭",
      play: "播放",
      pause: "暂停",
      stop: "停止",
      position: "位置",
      brightness: "亮度",
      temperature: "温度",
      hvac_mode: "模式",
      percentage: "百分比",
      min_short: "分",
      h_short: "时",
      now: "现在",
      in_1h: "1小时后",
      tomorrow_morning: "7点",
      humidity: "湿度",
      lock_lock: "锁定",
      lock_unlock: "解锁",
      vacuum_start: "开始",
      vacuum_return: "回基座",
      lawn_start: "开始",
      lawn_dock: "回基座",
      domain_filter: "允许的实体域",
      favorites_label: "快速选择收藏",
      add_favorite: "添加收藏…",
      remove_favorite: "移除",
      title_label: "卡片标题(可选)",
      title_placeholder: "Timer Card",
      card_id_label: "卡片 ID(高级)",
      card_id_help: "标识此卡片实例。定时器与此 ID 关联。",
      regenerate: "重新生成",
      configure_hint: "添加收藏并选择可选择的实体域。",
      missing_value: "请选择目标值。",
      missing_duration: "时长必须大于零。",
      missing_time: "请选择时间。",
      missing_entity: "请选择实体。",
      sensor_missing: "未找到 sensor.timer_card —— 集成已安装?",
      show_finished_label: "显示已完成的定时器",
    },
    "ko": {
      add_timer: "타이머 추가",
      no_timers: "활성 타이머 없음",
      step_entity: "엔티티 선택",
      step_value: "목표 값",
      step_time: "타이머 시간",
      favorites: "즐겨찾기",
      entity: "엔티티",
      target_value: "목표 값",
      tab_duration: "지속 시간",
      tab_time: "시각",
      hours: "시",
      minutes: "분",
      seconds: "초",
      at_time: "시각",
      label_optional: "라벨(선택)",
      cancel: "취소",
      back: "뒤로",
      next: "다음",
      ok: "확인",
      delete: "삭제",
      edit: "편집",
      adjust_duration: "시간 조정",
      current_remaining: "남은 시간",
      new_duration: "새 시간",
      add: "연장",
      subtract: "단축",
      finished: "완료됨",
      clear_finished: "완료된 항목 지우기",
      will_set: "설정",
      to: "→",
      on: "켜짐",
      off: "꺼짐",
      open: "열기",
      close: "닫기",
      play: "재생",
      pause: "일시정지",
      stop: "정지",
      position: "위치",
      brightness: "밝기",
      temperature: "온도",
      hvac_mode: "모드",
      percentage: "퍼센트",
      min_short: "분",
      h_short: "시",
      now: "지금",
      in_1h: "1시간 후",
      tomorrow_morning: "7시",
      humidity: "습도",
      lock_lock: "잠금",
      lock_unlock: "잠금 해제",
      vacuum_start: "시작",
      vacuum_return: "도크",
      lawn_start: "시작",
      lawn_dock: "도크",
      domain_filter: "허용된 엔티티 도메인",
      favorites_label: "빠른 선택 즐겨찾기",
      add_favorite: "즐겨찾기 추가…",
      remove_favorite: "제거",
      title_label: "카드 제목(선택)",
      title_placeholder: "Timer Card",
      card_id_label: "카드 ID(고급)",
      card_id_help: "이 카드 인스턴스를 식별합니다. 타이머는 이 ID에 연결됩니다.",
      regenerate: "다시 생성",
      configure_hint: "즐겨찾기를 추가하고 선택 가능한 엔티티 도메인을 고르세요.",
      missing_value: "목표 값을 선택하세요.",
      missing_duration: "시간은 0보다 커야 합니다.",
      missing_time: "시각을 선택하세요.",
      missing_entity: "엔티티를 선택하세요.",
      sensor_missing: "sensor.timer_card 를 찾을 수 없습니다 — 통합이 설치되어 있나요?",
      show_finished_label: "완료된 타이머 표시",
    },
    "ca": {
      add_timer: "Afegir temporitzador",
      no_timers: "Cap temporitzador actiu",
      step_entity: "Tria entitat",
      step_value: "Valor objectiu",
      step_time: "Durada del temporitzador",
      favorites: "Preferits",
      entity: "Entitat",
      target_value: "Valor objectiu",
      tab_duration: "Durada",
      tab_time: "Hora",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "A les",
      label_optional: "Etiqueta (opcional)",
      cancel: "Cancel·la",
      back: "Enrere",
      next: "Següent",
      ok: "D'acord",
      delete: "Elimina",
      edit: "Edita",
      adjust_duration: "Ajusta durada",
      current_remaining: "Temps restant",
      new_duration: "Nova durada",
      add: "Allarga",
      subtract: "Escurça",
      finished: "Finalitzats",
      clear_finished: "Esborra finalitzats",
      will_set: "Estableix",
      to: "a",
      on: "Encès",
      off: "Apagat",
      open: "Obre",
      close: "Tanca",
      play: "Reprodueix",
      pause: "Pausa",
      stop: "Atura",
      position: "Posició",
      brightness: "Brillantor",
      temperature: "Temperatura",
      hvac_mode: "Mode",
      percentage: "Percentatge",
      min_short: "min",
      h_short: "h",
      now: "Ara",
      in_1h: "En 1h",
      tomorrow_morning: "7:00",
      humidity: "Humitat",
      lock_lock: "Bloqueja",
      lock_unlock: "Desbloqueja",
      vacuum_start: "Inicia",
      vacuum_return: "Base",
      lawn_start: "Inicia",
      lawn_dock: "Base",
      domain_filter: "Dominis d'entitat permesos",
      favorites_label: "Preferits de selecció ràpida",
      add_favorite: "Afegeix preferit…",
      remove_favorite: "Elimina",
      title_label: "Títol de la targeta (opcional)",
      title_placeholder: "Timer Card",
      card_id_label: "ID de la targeta (avançat)",
      card_id_help: "Identifica aquesta instància de targeta. Els temporitzadors estan lligats a aquest ID.",
      regenerate: "Regenera",
      configure_hint: "Afegeix preferits i tria quins dominis d'entitat es poden seleccionar.",
      missing_value: "Tria un valor objectiu.",
      missing_duration: "La durada ha de ser més gran que zero.",
      missing_time: "Tria una hora.",
      missing_entity: "Tria una entitat.",
      sensor_missing: "sensor.timer_card no trobat — la integració està instal·lada?",
      show_finished_label: "Mostra temporitzadors finalitzats",
    },
    "uk": {
      add_timer: "Додати таймер",
      no_timers: "Немає активних таймерів",
      step_entity: "Вибрати сутність",
      step_value: "Цільове значення",
      step_time: "Тривалість таймера",
      favorites: "Обране",
      entity: "Сутність",
      target_value: "Цільове значення",
      tab_duration: "Тривалість",
      tab_time: "Час",
      hours: "год",
      minutes: "хв",
      seconds: "с",
      at_time: "О",
      label_optional: "Мітка (необов'язково)",
      cancel: "Скасувати",
      back: "Назад",
      next: "Далі",
      ok: "ОК",
      delete: "Видалити",
      edit: "Редагувати",
      adjust_duration: "Змінити тривалість",
      current_remaining: "Залишилось",
      new_duration: "Нова тривалість",
      add: "Подовжити",
      subtract: "Скоротити",
      finished: "Завершені",
      clear_finished: "Очистити завершені",
      will_set: "Встановить",
      to: "на",
      on: "Увімк.",
      off: "Вимк.",
      open: "Відкрити",
      close: "Закрити",
      play: "Відтворити",
      pause: "Пауза",
      stop: "Зупинити",
      position: "Позиція",
      brightness: "Яскравість",
      temperature: "Температура",
      hvac_mode: "Режим",
      percentage: "Відсоток",
      min_short: "хв",
      h_short: "год",
      now: "Зараз",
      in_1h: "Через 1 год",
      tomorrow_morning: "7:00",
      humidity: "Вологість",
      lock_lock: "Замкнути",
      lock_unlock: "Відімкнути",
      vacuum_start: "Старт",
      vacuum_return: "База",
      lawn_start: "Старт",
      lawn_dock: "База",
      domain_filter: "Дозволені домени сутностей",
      favorites_label: "Обране швидкого вибору",
      add_favorite: "Додати в обране…",
      remove_favorite: "Видалити",
      title_label: "Заголовок картки (необов'язково)",
      title_placeholder: "Timer Card",
      card_id_label: "ID картки (просунуто)",
      card_id_help: "Ідентифікує цей екземпляр картки. Таймери прив'язані до цього ID.",
      regenerate: "Згенерувати знову",
      configure_hint: "Додайте обране та оберіть, які домени сутностей доступні для вибору.",
      missing_value: "Виберіть цільове значення.",
      missing_duration: "Тривалість має бути більше нуля.",
      missing_time: "Виберіть час.",
      missing_entity: "Виберіть сутність.",
      sensor_missing: "sensor.timer_card не знайдено — інтеграцію встановлено?",
      show_finished_label: "Показувати завершені таймери",
    },
    "ro": {
      add_timer: "Adaugă cronometru",
      no_timers: "Niciun cronometru activ",
      step_entity: "Alege entitatea",
      step_value: "Valoare țintă",
      step_time: "Durata cronometrului",
      favorites: "Favorite",
      entity: "Entitate",
      target_value: "Valoare țintă",
      tab_duration: "Durată",
      tab_time: "Oră",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "La ora",
      label_optional: "Etichetă (opțional)",
      cancel: "Anulează",
      back: "Înapoi",
      next: "Înainte",
      ok: "OK",
      delete: "Șterge",
      edit: "Editează",
      adjust_duration: "Ajustează durata",
      current_remaining: "Timp rămas",
      new_duration: "Durată nouă",
      add: "Prelungește",
      subtract: "Scurtează",
      finished: "Finalizate",
      clear_finished: "Șterge finalizate",
      will_set: "Setează",
      to: "la",
      on: "Pornit",
      off: "Oprit",
      open: "Deschide",
      close: "Închide",
      play: "Redă",
      pause: "Pauză",
      stop: "Oprește",
      position: "Poziție",
      brightness: "Luminozitate",
      temperature: "Temperatură",
      hvac_mode: "Mod",
      percentage: "Procent",
      min_short: "min",
      h_short: "h",
      now: "Acum",
      in_1h: "În 1h",
      tomorrow_morning: "7:00",
      humidity: "Umiditate",
      lock_lock: "Blochează",
      lock_unlock: "Deblochează",
      vacuum_start: "Pornește",
      vacuum_return: "Bază",
      lawn_start: "Pornește",
      lawn_dock: "Bază",
      domain_filter: "Domenii de entități permise",
      favorites_label: "Favorite selecție rapidă",
      add_favorite: "Adaugă favorit…",
      remove_favorite: "Elimină",
      title_label: "Titlu card (opțional)",
      title_placeholder: "Timer Card",
      card_id_label: "ID card (avansat)",
      card_id_help: "Identifică această instanță de card. Cronometrele sunt legate de acest ID.",
      regenerate: "Regenerează",
      configure_hint: "Adaugă favorite și alege ce domenii de entități pot fi selectate.",
      missing_value: "Alege o valoare țintă.",
      missing_duration: "Durata trebuie să fie mai mare ca zero.",
      missing_time: "Alege o oră.",
      missing_entity: "Alege o entitate.",
      sensor_missing: "sensor.timer_card nu a fost găsit — este integrarea instalată?",
      show_finished_label: "Afișează cronometrele finalizate",
    },
    "sk": {
      add_timer: "Pridať časovač",
      no_timers: "Žiadne aktívne časovače",
      step_entity: "Vybrať entitu",
      step_value: "Cieľová hodnota",
      step_time: "Dĺžka časovača",
      favorites: "Obľúbené",
      entity: "Entita",
      target_value: "Cieľová hodnota",
      tab_duration: "Dĺžka",
      tab_time: "Čas",
      hours: "h",
      minutes: "min",
      seconds: "s",
      at_time: "O",
      label_optional: "Názov (voliteľný)",
      cancel: "Zrušiť",
      back: "Späť",
      next: "Ďalej",
      ok: "OK",
      delete: "Odstrániť",
      edit: "Upraviť",
      adjust_duration: "Upraviť dĺžku",
      current_remaining: "Zostáva",
      new_duration: "Nová dĺžka",
      add: "Predĺžiť",
      subtract: "Skrátiť",
      finished: "Dokončené",
      clear_finished: "Vyčistiť dokončené",
      will_set: "Nastaví",
      to: "na",
      on: "Zap.",
      off: "Vyp.",
      open: "Otvoriť",
      close: "Zavrieť",
      play: "Prehrať",
      pause: "Pauza",
      stop: "Stop",
      position: "Pozícia",
      brightness: "Jas",
      temperature: "Teplota",
      hvac_mode: "Režim",
      percentage: "Percento",
      min_short: "min",
      h_short: "h",
      now: "Teraz",
      in_1h: "O 1h",
      tomorrow_morning: "7:00",
      humidity: "Vlhkosť",
      lock_lock: "Zamknúť",
      lock_unlock: "Odomknúť",
      vacuum_start: "Štart",
      vacuum_return: "Dok",
      lawn_start: "Štart",
      lawn_dock: "Dok",
      domain_filter: "Povolené domény entít",
      favorites_label: "Rýchly výber obľúbených",
      add_favorite: "Pridať obľúbené…",
      remove_favorite: "Odstrániť",
      title_label: "Názov karty (voliteľný)",
      title_placeholder: "Timer Card",
      card_id_label: "ID karty (pokročilé)",
      card_id_help: "Identifikuje túto inštanciu karty. Časovače sú viazané na toto ID.",
      regenerate: "Vygenerovať znovu",
      configure_hint: "Pridajte obľúbené a zvoľte, ktoré domény entít je možné vybrať.",
      missing_value: "Vyberte cieľovú hodnotu.",
      missing_duration: "Dĺžka musí byť väčšia ako nula.",
      missing_time: "Vyberte čas.",
      missing_entity: "Vyberte entitu.",
      sensor_missing: "sensor.timer_card nenájdený — je integrácia nainštalovaná?",
      show_finished_label: "Zobraziť dokončené časovače",
    },
    "el": {
      add_timer: "Προσθήκη χρονομέτρου",
      no_timers: "Δεν υπάρχουν ενεργά χρονόμετρα",
      step_entity: "Επιλογή οντότητας",
      step_value: "Τιμή στόχου",
      step_time: "Διάρκεια χρονομέτρου",
      favorites: "Αγαπημένα",
      entity: "Οντότητα",
      target_value: "Τιμή στόχου",
      tab_duration: "Διάρκεια",
      tab_time: "Ώρα",
      hours: "ω",
      minutes: "λ",
      seconds: "δ",
      at_time: "Στις",
      label_optional: "Ετικέτα (προαιρετικό)",
      cancel: "Άκυρο",
      back: "Πίσω",
      next: "Επόμενο",
      ok: "OK",
      delete: "Διαγραφή",
      edit: "Επεξεργασία",
      adjust_duration: "Ρύθμιση διάρκειας",
      current_remaining: "Απομένει",
      new_duration: "Νέα διάρκεια",
      add: "Επέκταση",
      subtract: "Μείωση",
      finished: "Ολοκληρωμένα",
      clear_finished: "Εκκαθάριση ολοκληρωμένων",
      will_set: "Ορίζει",
      to: "σε",
      on: "Ενεργό",
      off: "Ανενεργό",
      open: "Άνοιγμα",
      close: "Κλείσιμο",
      play: "Αναπαραγωγή",
      pause: "Παύση",
      stop: "Διακοπή",
      position: "Θέση",
      brightness: "Φωτεινότητα",
      temperature: "Θερμοκρασία",
      hvac_mode: "Λειτουργία",
      percentage: "Ποσοστό",
      min_short: "λ",
      h_short: "ω",
      now: "Τώρα",
      in_1h: "Σε 1ω",
      tomorrow_morning: "7:00",
      humidity: "Υγρασία",
      lock_lock: "Κλείδωμα",
      lock_unlock: "Ξεκλείδωμα",
      vacuum_start: "Έναρξη",
      vacuum_return: "Βάση",
      lawn_start: "Έναρξη",
      lawn_dock: "Βάση",
      domain_filter: "Επιτρεπόμενοι τομείς οντοτήτων",
      favorites_label: "Αγαπημένα γρήγορης επιλογής",
      add_favorite: "Προσθήκη αγαπημένου…",
      remove_favorite: "Αφαίρεση",
      title_label: "Τίτλος κάρτας (προαιρετικό)",
      title_placeholder: "Timer Card",
      card_id_label: "ID κάρτας (προχωρημένο)",
      card_id_help: "Αναγνωρίζει αυτό το στιγμιότυπο κάρτας. Τα χρονόμετρα συσχετίζονται με αυτό το ID.",
      regenerate: "Επαναδημιουργία",
      configure_hint: "Προσθέστε αγαπημένα και επιλέξτε ποιοι τομείς οντοτήτων είναι επιλέξιμοι.",
      missing_value: "Επιλέξτε μια τιμή στόχου.",
      missing_duration: "Η διάρκεια πρέπει να είναι μεγαλύτερη από μηδέν.",
      missing_time: "Επιλέξτε ώρα.",
      missing_entity: "Επιλέξτε οντότητα.",
      sensor_missing: "Το sensor.timer_card δεν βρέθηκε — η ενσωμάτωση είναι εγκατεστημένη;",
      show_finished_label: "Εμφάνιση ολοκληρωμένων χρονομέτρων",
    },
  };
  function t(hass, key) {
    const lang = (hass && hass.locale && hass.locale.language) || "en";
    if (STRINGS[lang] && STRINGS[lang][key] !== undefined) return STRINGS[lang][key];
    const short = String(lang).toLowerCase().split("-")[0];
    const match = Object.keys(STRINGS).find(
      (k) => k.toLowerCase().split("-")[0] === short,
    );
    if (match && STRINGS[match][key] !== undefined) return STRINGS[match][key];
    return (STRINGS.en && STRINGS.en[key]) || key;
  }
  function fmtMinDelta(hass, n) {
    const sign = n >= 0 ? "+" : "\u2212";
    return sign + Math.abs(n) + t(hass, "min_short");
  }
  function fmtHourDelta(hass, n) {
    const sign = n >= 0 ? "+" : "\u2212";
    return sign + Math.abs(n) + t(hass, "h_short");
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const r = (n) =>
      Math.floor(Math.random() * Math.pow(16, n))
        .toString(16)
        .padStart(n, "0");
    return `${r(8)}-${r(4)}-${r(4)}-${r(4)}-${r(12)}`;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function fmtRemaining(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  }
  function entityDomain(eid) {
    return eid ? eid.split(".")[0] : "";
  }
  function entityName(hass, eid) {
    if (!hass || !eid) return eid || "";
    const st = hass.states[eid];
    if (!st) return eid;
    return st.attributes.friendly_name || eid;
  }
  function iconFor(hass, eid) {
    const st = hass && hass.states[eid];
    if (st && st.attributes && st.attributes.icon) return st.attributes.icon;
    const map = {
      switch: "mdi:toggle-switch-outline",
      light: "mdi:lightbulb-outline",
      input_boolean: "mdi:toggle-switch-outline",
      number: "mdi:numeric",
      input_number: "mdi:numeric",
      input_text: "mdi:form-textbox",
      climate: "mdi:thermostat",
      cover: "mdi:window-shutter",
      fan: "mdi:fan",
      select: "mdi:format-list-bulleted",
      input_select: "mdi:format-list-bulleted",
      media_player: "mdi:speaker",
      lock: "mdi:lock",
      vacuum: "mdi:robot-vacuum",
      humidifier: "mdi:air-humidifier",
      water_heater: "mdi:water-boiler",
      siren: "mdi:bullhorn",
      valve: "mdi:valve",
      lawn_mower: "mdi:robot-mower",
    };
    return map[entityDomain(eid)] || "mdi:circle-outline";
  }
  function pickerFor(hass, eid) {
    const domain = entityDomain(eid);
    const st = hass && hass.states[eid];
    const a = (st && st.attributes) || {};
    switch (domain) {
      case "switch":
      case "input_boolean":
        return { kind: "toggle" };
      case "light":
        return { kind: "light" };
      case "number":
      case "input_number":
        return {
          kind: "number",
          min: typeof a.min === "number" ? a.min : 0,
          max: typeof a.max === "number" ? a.max : 100,
          step: typeof a.step === "number" ? a.step : 1,
          unit: a.unit_of_measurement || "",
        };
      case "climate":
        return {
          kind: "climate",
          min: a.min_temp || 7,
          max: a.max_temp || 35,
          step: a.target_temp_step || 0.5,
          unit:
            (hass && hass.config && hass.config.unit_system &&
              hass.config.unit_system.temperature) || "°C",
          modes: a.hvac_modes || [],
        };
      case "cover":
        return {
          kind: "cover",
          supportsPosition: a.current_position !== undefined,
        };
      case "fan":
        return { kind: "fan" };
      case "select":
      case "input_select":
        return { kind: "select", options: a.options || [] };
      case "media_player":
        return { kind: "media" };
      case "lock":
        return { kind: "lock" };
      case "vacuum":
        return { kind: "vacuum" };
      case "humidifier":
        return {
          kind: "humidifier",
          min: a.min_humidity || 30,
          max: a.max_humidity || 99,
        };
      case "water_heater":
        return {
          kind: "water_heater",
          min: a.min_temp || 30,
          max: a.max_temp || 80,
          unit:
            (hass && hass.config && hass.config.unit_system &&
              hass.config.unit_system.temperature) || "°C",
        };
      case "siren":
        return { kind: "toggle" };
      case "valve":
        return { kind: "cover", supportsPosition: a.current_position !== undefined };
      case "lawn_mower":
        return { kind: "lawn_mower" };
      case "input_text":
        return { kind: "text" };
      default:
        return { kind: "text" };
    }
  }

  // ------------------------------------------------------------------
  // Shared CSS for the card and editor
  // ------------------------------------------------------------------
  const SHARED_STYLE = /* css */ `
    :host { display: block; }
    * { box-sizing: border-box; }
    ha-card {
      padding: 0;
      overflow: hidden;
      border-radius: var(--ha-card-border-radius, 22px);
    }
    .card-title {
      padding: 18px 18px 4px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .content {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .empty {
      padding: 22px 14px;
      text-align: center;
      color: var(--secondary-text-color);
      background: var(--secondary-background-color);
      border-radius: 14px;
      font-size: 14px;
    }
    .empty.error {
      color: var(--error-color, #f44336);
      background: color-mix(in srgb, var(--error-color, #f44336) 10%, transparent);
    }
    .add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px;
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      color: var(--primary-color);
      border: 1px dashed color-mix(in srgb, var(--primary-color) 50%, transparent);
      border-radius: 16px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 160ms ease, transform 120ms ease;
    }
    .add-btn:hover { background: color-mix(in srgb, var(--primary-color) 20%, transparent); }
    .add-btn:active { transform: scale(0.99); }
    .add-btn ha-icon { --mdc-icon-size: 22px; }
    .timer-list { display: flex; flex-direction: column; gap: 10px; }
    .timer-row {
      display: grid;
      grid-template-columns: 44px 1fr auto auto auto;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--secondary-background-color);
      border-radius: 18px;
      transition: background-color 160ms ease, box-shadow 160ms ease;
    }
    .timer-row:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .timer-row.finished { opacity: 0.78; }
    .timer-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--card-background-color);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-color);
      box-shadow: inset 0 0 0 1px var(--divider-color);
    }
    .timer-icon ha-icon { --mdc-icon-size: 22px; }
    .timer-info { min-width: 0; }
    .timer-label {
      font-weight: 500;
      color: var(--primary-text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.25;
    }
    .timer-sub {
      font-size: 12px;
      color: var(--secondary-text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }
    .progress {
      margin-top: 8px;
      height: 4px;
      background: var(--divider-color);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(
        90deg,
        var(--primary-color),
        color-mix(in srgb, var(--primary-color) 70%, white)
      );
      transition: width 800ms linear;
      border-radius: 4px;
    }
    .timer-remaining {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--primary-color);
      font-size: 18px;
      letter-spacing: -0.01em;
    }
    .timer-remaining.urgent { color: var(--warning-color, #ff9800); }
    .row-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--secondary-text-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 160ms ease, color 160ms ease;
      padding: 0;
    }
    .row-btn ha-icon { --mdc-icon-size: 20px; }
    .edit-btn:hover {
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      color: var(--primary-color);
    }
    .delete-btn:hover {
      background: color-mix(in srgb, var(--error-color, #f44336) 12%, transparent);
      color: var(--error-color, #f44336);
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-top: 4px;
      padding: 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .link {
      background: none;
      border: none;
      color: var(--primary-color);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      text-transform: none;
      letter-spacing: 0;
    }
    .link:hover { text-decoration: underline; }
  `;

  // ------------------------------------------------------------------
  // Main card
  // ------------------------------------------------------------------
  class TimerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._config = null;
      this._tick = null;
      this._lastKey = "";
      this._timerNodes = new Map(); // id -> {row, remainingEl, progressEl}
    }

    static getConfigElement() {
      return document.createElement("timer-card-editor");
    }
    static getStubConfig() {
      return {
        card_id: uuid(),
        title: "",
        favorites: [],
        domains: DEFAULT_DOMAINS,
        show_finished: true,
      };
    }

    setConfig(config) {
      if (!config) throw new Error("Invalid config");
      this._config = {
        // Preserve the type field — Lovelace requires it on every saved
        // config and HA's card-config-editor round-trips this object.
        type: config.type || "custom:timer-card",
        card_id: config.card_id || uuid(),
        title: config.title || "",
        favorites: Array.isArray(config.favorites) ? config.favorites : [],
        domains: Array.isArray(config.domains)
          ? config.domains
          : DEFAULT_DOMAINS,
        show_finished:
          config.show_finished === undefined ? true : !!config.show_finished,
      };
      this._renderShell();
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._config) return;
      if (first) this._renderShell();
      this._renderBody();
      // Keep our own dialogs (if attached) in sync.
      if (this._dialog) this._dialog.hass = hass;
      if (this._editDialog) this._editDialog.hass = hass;
    }
    get hass() {
      return this._hass;
    }

    getCardSize() {
      const c = (this._timersForCard() || []).length;
      return Math.max(1, Math.ceil(c / 2) + 1);
    }

    connectedCallback() {
      if (!this._tick) {
        this._tick = setInterval(() => this._updateRemaining(), 1000);
      }
    }
    disconnectedCallback() {
      if (this._tick) clearInterval(this._tick);
      this._tick = null;
      if (this._dialog && this._dialog.parentNode) {
        this._dialog.parentNode.removeChild(this._dialog);
      }
      this._dialog = null;
      if (this._editDialog && this._editDialog.parentNode) {
        this._editDialog.parentNode.removeChild(this._editDialog);
      }
      this._editDialog = null;
    }

    _renderShell() {
      this.shadowRoot.innerHTML = `
        <style>${SHARED_STYLE}</style>
        <ha-card>
          <div class="root">
            <div class="card-title" data-slot="title"></div>
            <div class="content">
              <div data-slot="body"></div>
              <button class="add-btn" data-slot="add">
                <ha-icon icon="mdi:plus"></ha-icon>
                <span data-slot="add-label"></span>
              </button>
            </div>
          </div>
        </ha-card>
      `;
      const titleEl = this.shadowRoot.querySelector('[data-slot="title"]');
      if (this._config && this._config.title) {
        titleEl.textContent = this._config.title;
        titleEl.style.display = "";
      } else {
        titleEl.style.display = "none";
      }
      const addBtn = this.shadowRoot.querySelector('[data-slot="add"]');
      addBtn.addEventListener("click", () => this._openDialog());
      this._timerNodes.clear();
      this._lastKey = "";
    }

    _sensor() {
      return this._hass && this._hass.states[SENSOR_ENTITY];
    }
    _timersForCard() {
      const st = this._sensor();
      if (!st) return null;
      const a = st.attributes || {};
      const all = Array.isArray(a.timers) ? a.timers : [];
      return all.filter((t) => t.card_id === this._config.card_id);
    }
    _finishedForCard() {
      const st = this._sensor();
      if (!st) return [];
      const a = st.attributes || {};
      const all = Array.isArray(a.finished) ? a.finished : [];
      return all.filter((t) => t.card_id === this._config.card_id);
    }

    _renderBody() {
      if (!this._hass || !this._config) return;
      const addLabel = this.shadowRoot.querySelector('[data-slot="add-label"]');
      if (addLabel) addLabel.textContent = t(this._hass, "add_timer");

      const body = this.shadowRoot.querySelector('[data-slot="body"]');
      if (!body) return;

      const sensor = this._sensor();
      const active = this._timersForCard();
      const finished = this._config.show_finished ? this._finishedForCard() : [];

      // Key reflects structural changes (which timer ids are present).
      const key = JSON.stringify({
        sensor: !!sensor,
        active: (active || []).map((t) => t.id),
        finished: finished.map((t) => t.id),
      });
      if (key === this._lastKey) {
        this._updateRemaining();
        return;
      }
      this._lastKey = key;
      this._timerNodes.clear();

      if (!sensor) {
        body.innerHTML = `<div class="empty error">${escapeHtml(
          t(this._hass, "sensor_missing"),
        )}</div>`;
        return;
      }
      if (!active || active.length === 0) {
        body.innerHTML = `<div class="empty">${escapeHtml(
          t(this._hass, "no_timers"),
        )}</div>`;
      } else {
        body.innerHTML = `<div class="timer-list" data-slot="list"></div>`;
        const list = body.querySelector('[data-slot="list"]');
        active.forEach((tm) => list.appendChild(this._buildTimerRow(tm, false)));
      }

      if (finished.length) {
        const section = document.createElement("div");
        section.innerHTML = `
          <div class="section-head">
            <span>${escapeHtml(t(this._hass, "finished"))}</span>
            <button class="link" data-action="clear">${escapeHtml(
              t(this._hass, "clear_finished"),
            )}</button>
          </div>
          <div class="timer-list" data-slot="finished-list"></div>
        `;
        const list = section.querySelector('[data-slot="finished-list"]');
        finished.forEach((tm) =>
          list.appendChild(this._buildTimerRow(tm, true)),
        );
        section
          .querySelector('[data-action="clear"]')
          .addEventListener("click", () => this._clearFinished());
        body.appendChild(section);
      }

      this._updateRemaining();
    }

    _buildTimerRow(timer, isFinished) {
      const row = document.createElement("div");
      row.className = "timer-row" + (isFinished ? " finished" : "");
      row.innerHTML = `
        <div class="timer-icon">
          <ha-icon icon="${escapeHtml(
            isFinished ? "mdi:check-circle-outline" : iconFor(this._hass, timer.entity_id),
          )}"></ha-icon>
        </div>
        <div class="timer-info">
          <div class="timer-label"></div>
          <div class="timer-sub"></div>
          ${isFinished ? "" : '<div class="progress"><div class="progress-bar" data-slot="bar"></div></div>'}
        </div>
        ${isFinished
          ? ""
          : '<div class="timer-remaining" data-slot="remaining">--:--</div>' +
            '<button class="row-btn edit-btn" data-action="edit" title="' +
            escapeHtml(t(this._hass, "edit")) +
            '"><ha-icon icon="mdi:pencil-outline"></ha-icon></button>' +
            '<button class="row-btn delete-btn" data-action="delete" title="' +
            escapeHtml(t(this._hass, "delete")) +
            '"><ha-icon icon="mdi:close"></ha-icon></button>'}
      `;
      row.querySelector(".timer-label").textContent =
        timer.label || entityName(this._hass, timer.entity_id);
      const sub = row.querySelector(".timer-sub");
      sub.textContent = `${t(this._hass, "will_set")} ${entityName(
        this._hass,
        timer.entity_id,
      )} ${t(this._hass, "to")} ${this._formatTarget(timer)}`;
      if (!isFinished) {
        row
          .querySelector('[data-action="delete"]')
          .addEventListener("click", () => this._deleteTimer(timer.id));
        row
          .querySelector('[data-action="edit"]')
          .addEventListener("click", () => this._editTimer(timer));
        this._timerNodes.set(timer.id, {
          row,
          remainingEl: row.querySelector('[data-slot="remaining"]'),
          progressEl: row.querySelector('[data-slot="bar"]'),
          finishTime: Number(timer.finish_time) || 0,
          duration: Number(timer.duration) || 1,
        });
      }
      return row;
    }

    _formatTarget(timer) {
      const v = timer.target_value;
      if (v === null || v === undefined) return "—";
      if (typeof v === "object") {
        return Object.entries(v)
          .map(([k, vv]) => `${k}=${vv}`)
          .join(", ");
      }
      return String(v);
    }

    _updateRemaining() {
      const now = Date.now() / 1000;
      for (const node of this._timerNodes.values()) {
        const remaining = node.finishTime - now;
        const total = node.duration || 1;
        const progress = Math.max(0, Math.min(1, 1 - remaining / total));
        if (node.remainingEl) {
          node.remainingEl.textContent = fmtRemaining(remaining);
          node.remainingEl.classList.toggle("urgent", remaining > 0 && remaining < 60);
        }
        if (node.progressEl) {
          node.progressEl.style.width = (progress * 100).toFixed(1) + "%";
        }
      }
    }

    _openDialog() {
      // Use a per-card-instance dialog so two cards on the same dashboard
      // don't fight over a shared node.
      if (!this._dialog) {
        this._dialog = document.createElement("timer-card-create-dialog");
        document.body.appendChild(this._dialog);
      }
      this._dialog.hass = this._hass;
      this._dialog.show(this._config);
    }

    async _deleteTimer(timer_id) {
      try {
        await this._hass.callService("timer_card", "delete", { timer_id });
      } catch (err) {
        console.error("[timer-card] delete failed", err);
      }
    }

    _editTimer(timer) {
      if (!this._editDialog) {
        this._editDialog = document.createElement("timer-card-edit-dialog");
        document.body.appendChild(this._editDialog);
      }
      this._editDialog.hass = this._hass;
      this._editDialog.show(timer);
    }
    async _clearFinished() {
      try {
        await this._hass.callService("timer_card", "clear_finished", {
          card_id: this._config.card_id,
        });
      } catch (err) {
        console.error("[timer-card] clear_finished failed", err);
      }
    }
  }
  customElements.define("timer-card", TimerCard);

  // ------------------------------------------------------------------
  // Create dialog
  // ------------------------------------------------------------------
  const DIALOG_STYLE = /* css */ `
    :host { display: contents; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: tc-fade-in 160ms ease;
    }
    @keyframes tc-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes tc-scale-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-card {
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 22px;
      max-width: 480px;
      width: 100%;
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: tc-scale-in 200ms cubic-bezier(.2,.9,.3,1);
    }
    .modal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px 8px 4px;
      border-bottom: 1px solid var(--divider-color);
    }
    .modal-close { --mdc-icon-button-size: 40px; --mdc-icon-size: 22px; color: var(--primary-text-color); }
    .modal-title { font-size: 18px; font-weight: 600; flex: 1; }
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 18px 20px 6px;
      overflow-y: auto;
      flex: 1;
    }
    .stepper {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
    }
    .stepper-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--secondary-text-color);
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stepper-item.active {
      color: var(--primary-color);
      font-weight: 600;
    }
    .stepper-item.done .stepper-dot {
      background: color-mix(in srgb, var(--primary-color) 50%, transparent);
      color: var(--text-primary-color, white);
    }
    .stepper-item.active .stepper-dot {
      background: var(--primary-color);
      color: var(--text-primary-color, white);
    }
    .stepper-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--divider-color);
      color: var(--primary-text-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      flex: 0 0 22px;
      transition: background-color 160ms ease, color 160ms ease;
    }
    .section-title {
      font-size: 13px;
      color: var(--secondary-text-color);
      margin: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      border-radius: 999px;
      padding: 6px 12px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
    }
    .chip ha-icon { --mdc-icon-size: 18px; }
    .chip:hover { background: var(--secondary-background-color); }
    .chip.active {
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      color: var(--primary-color);
    }
    .toggle-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .toggle {
      flex: 1 1 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 14px;
      background: var(--secondary-background-color);
      border: 1px solid transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      transition: all 160ms ease;
    }
    .toggle ha-icon { --mdc-icon-size: 20px; }
    .toggle:hover { background: var(--divider-color); }
    .toggle.active {
      background: color-mix(in srgb, var(--primary-color) 18%, transparent);
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
    .slider-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slider-row input[type="range"] {
      flex: 1;
      accent-color: var(--primary-color);
    }
    .badge {
      min-width: 64px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    select.select {
      appearance: none;
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color);
      border-radius: 12px;
      padding: 10px 14px;
      font: inherit;
      width: 100%;
    }
    .duration-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .duration-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .hms {
      font-size: 28px;
      font-weight: 500;
      text-align: center;
      padding: 10px;
      border-radius: 14px;
      border: 1px solid var(--divider-color);
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
      width: 100%;
      box-sizing: border-box;
    }
    .hms:focus {
      outline: 2px solid var(--primary-color);
      outline-offset: -2px;
      border-color: var(--primary-color);
    }
    .quick {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .quick button {
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--secondary-background-color);
      color: var(--primary-color);
      border: 1px solid var(--divider-color);
      font: inherit;
      cursor: pointer;
      transition: background-color 160ms;
    }
    .quick button:hover { background: var(--divider-color); }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--secondary-background-color);
      border-radius: 14px;
    }
    .tab {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      border-radius: 12px;
      background: transparent;
      color: var(--primary-text-color);
      border: none;
      cursor: pointer;
      font: inherit;
      transition: background-color 160ms ease;
    }
    .tab.active {
      background: var(--card-background-color);
      color: var(--primary-color);
      box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px var(--divider-color);
    }
    .time-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    [data-slot="time-body"] {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .time-cell {
      font-size: 44px;
      font-weight: 500;
      letter-spacing: 1px;
      width: 110px;
      max-width: 38vw;
      padding: 14px 0;
      border-radius: 16px;
      border: 1px solid var(--divider-color);
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
      text-align: center;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
      -moz-appearance: textfield;
      appearance: textfield;
      box-sizing: border-box;
    }
    .time-cell::-webkit-outer-spin-button,
    .time-cell::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .time-cell:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent);
    }
    .time-cell::placeholder { opacity: 0.4; }
    .time-sep {
      font-size: 40px;
      font-weight: 500;
      color: var(--secondary-text-color);
      user-select: none;
    }
    .error {
      color: var(--error-color, #f44336);
      font-size: 13px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--error-color, #f44336) 12%, transparent);
      border-radius: 12px;
    }
    ha-form { display: block; width: 100%; }
    .tc-input {
      display: block;
      width: 100%;
      padding: 12px 14px;
      font: inherit;
      font-size: 14px;
      color: var(--primary-text-color);
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 12px;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
      box-sizing: border-box;
    }
    .tc-input:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent);
    }
    .tc-field { display: flex; flex-direction: column; gap: 4px; }
    .tc-field-label { font-size: 12px; color: var(--secondary-text-color); }
    ha-button { --mdc-theme-primary: var(--primary-color); }
    .footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px 18px;
      border-top: 1px solid var(--divider-color);
    }
    .primary-btn {
      --ha-button-background-color: var(--primary-color);
      --ha-button-text-color: var(--text-primary-color, white);
    }
    .step { display: flex; flex-direction: column; gap: 12px; }
    .edit-target {
      font-size: 13px;
      color: var(--primary-text-color);
      font-weight: 500;
      text-align: center;
    }
    .edit-remaining {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 20px;
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      border-radius: 16px;
    }
    .edit-remaining-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--secondary-text-color);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .edit-remaining-value {
      font-size: 40px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--primary-color);
      letter-spacing: -0.01em;
      line-height: 1;
    }
    .edit-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .edit-section .section-title {
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 11px;
      font-weight: 500;
    }
    .edit-section .duration-grid { margin-top: 2px; }
  `;

  class TimerCardCreateDialog extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._open = false;
      this._config = null;
      this._step = 0;
      this._entity_id = "";
      this._target = null;
      this._label = "";
      this._tab = "duration";
      this._h = 0;
      this._m = 5;
      this._s = 0;
      this._at = "";
      this._error = "";
    }

    set hass(h) {
      this._hass = h;
      // Update entity-picker hass if alive.
      const ep = this.shadowRoot && this.shadowRoot.querySelector("ha-entity-picker");
      if (ep) ep.hass = h;
    }
    get hass() {
      return this._hass;
    }

    show(config) {
      this._config = config;
      this._open = true;
      this._step = 0;
      this._entity_id = "";
      this._target = null;
      this._label = "";
      this._tab = "duration";
      this._h = 0;
      this._m = 5;
      this._s = 0;
      this._at = "";
      this._error = "";
      this._render();
    }
    _close() {
      this._open = false;
      this._render();
    }

    _render() {
      if (!this._open || !this._hass) {
        this.shadowRoot.innerHTML = "";
        this._mounted = false;
        return;
      }
      if (!this._mounted) {
        this._mountSkeleton();
        this._mounted = true;
      }
      // Update only the parts that actually change between renders. This
      // avoids re-running the entry animation and prevents the visual
      // "flicker" the user noticed when stepping between pages.
      this._updateChrome();
      this._updateStepBody();
      this._updateError();
    }

    _mountSkeleton() {
      this.shadowRoot.innerHTML = `
        <style>${DIALOG_STYLE}</style>
        <div class="modal-backdrop" data-slot="backdrop">
          <div class="modal-card" role="dialog" aria-modal="true">
            <div class="modal-header">
              <ha-icon-button
                class="modal-close"
                label="${escapeHtml(t(this._hass, "cancel"))}"
                data-action="cancel"
              ><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
              <div class="modal-title" data-slot="title"></div>
            </div>
            <div class="dialog-content">
              <div class="stepper" data-slot="stepper"></div>
              <div data-slot="step"></div>
              <div data-slot="error"></div>
            </div>
            <div class="footer-actions">
              <ha-button data-action="back" data-slot="back-btn"></ha-button>
              <ha-button raised data-action="primary" class="primary-btn" data-slot="primary-btn"></ha-button>
            </div>
          </div>
        </div>
      `;
      const backdrop = this.shadowRoot.querySelector('[data-slot="backdrop"]');
      backdrop.addEventListener("click", (ev) => {
        if (ev.target === backdrop) this._close();
      });
      this.shadowRoot
        .querySelector('[data-action="cancel"]')
        .addEventListener("click", () => this._close());
      this.shadowRoot
        .querySelector('[data-action="back"]')
        .addEventListener("click", () => this._onBack());
      this.shadowRoot
        .querySelector('[data-action="primary"]')
        .addEventListener("click", () => this._onPrimary());
    }

    _updateChrome() {
      const titles = [
        t(this._hass, "step_entity"),
        t(this._hass, "step_value"),
        t(this._hass, "step_time"),
      ];
      const titleEl = this.shadowRoot.querySelector('[data-slot="title"]');
      if (titleEl) titleEl.textContent = titles[this._step];

      const stepper = this.shadowRoot.querySelector('[data-slot="stepper"]');
      if (stepper) {
        stepper.innerHTML = titles
          .map(
            (label, i) => `
            <div class="stepper-item ${i === this._step ? "active" : i < this._step ? "done" : ""}">
              <div class="stepper-dot">${i + 1}</div>
              <span>${escapeHtml(label)}</span>
            </div>`,
          )
          .join("");
      }

      const backBtn = this.shadowRoot.querySelector('[data-slot="back-btn"]');
      if (backBtn) {
        backBtn.textContent =
          this._step > 0 ? t(this._hass, "back") : t(this._hass, "cancel");
      }
      const primaryBtn = this.shadowRoot.querySelector('[data-slot="primary-btn"]');
      if (primaryBtn) {
        primaryBtn.textContent =
          this._step < 2 ? t(this._hass, "next") : t(this._hass, "ok");
      }
    }

    _updateStepBody() {
      const stepSlot = this.shadowRoot.querySelector('[data-slot="step"]');
      if (!stepSlot) return;
      if (this._step === 0) this._renderStepEntity(stepSlot);
      else if (this._step === 1) this._renderStepValue(stepSlot);
      else this._renderStepTime(stepSlot);
    }

    _updateError() {
      const slot = this.shadowRoot.querySelector('[data-slot="error"]');
      if (!slot) return;
      if (this._error) {
        slot.innerHTML = `<div class="error">${escapeHtml(this._error)}</div>`;
      } else {
        slot.innerHTML = "";
      }
    }

    _renderStepEntity(slot) {
      const fav = (this._config && this._config.favorites) || [];
      const domains = (this._config && this._config.domains) || DEFAULT_DOMAINS;
      slot.innerHTML = `
        <div class="step">
          ${fav.length
            ? `<div class="section-title">${escapeHtml(t(this._hass, "favorites"))}</div>
               <div class="chips" data-slot="favs"></div>`
            : ""}
          <div class="section-title">${escapeHtml(t(this._hass, "entity"))}</div>
          <ha-form data-slot="entity"></ha-form>
        </div>
      `;
      if (fav.length) {
        const chips = slot.querySelector('[data-slot="favs"]');
        fav.forEach((eid) => {
          const btn = document.createElement("button");
          btn.className =
            "chip" + (this._entity_id === eid ? " active" : "");
          btn.innerHTML = `<ha-icon icon="${escapeHtml(
            iconFor(this._hass, eid),
          )}"></ha-icon><span>${escapeHtml(
            entityName(this._hass, eid),
          )}</span>`;
          btn.addEventListener("click", () => {
            this._setEntity(eid);
          });
          chips.appendChild(btn);
        });
      }
      const form = slot.querySelector("ha-form");
      form.hass = this._hass;
      form.data = { entity: this._entity_id };
      form.schema = [
        {
          name: "entity",
          selector: {
            entity: {
              domain: domains && domains.length ? domains : undefined,
            },
          },
        },
      ];
      form.computeLabel = () => t(this._hass, "entity");
      form.addEventListener("value-changed", (ev) => {
        const eid = ev.detail && ev.detail.value && ev.detail.value.entity;
        // Only react when the value actually changes — ha-form fires on init.
        if ((eid || "") !== this._entity_id) {
          this._setEntity(eid || "");
        }
      });
    }

    // Centralised entity assignment so we can also clear any prior target
    // value (which may have been domain-specific and not compatible with
    // the new entity, e.g. switching from a switch to a climate would have
    // left `_target = "on"` and produced NaN in the temperature badge).
    _setEntity(eid) {
      const prevDomain = entityDomain(this._entity_id);
      this._entity_id = eid;
      if (entityDomain(eid) !== prevDomain) {
        this._target = null;
      }
      this._error = "";
      this._render();
    }

    _renderStepValue(slot) {
      const eid = this._entity_id;
      const p = pickerFor(this._hass, eid);

      slot.innerHTML = `
        <div class="step">
          <div class="section-title">
            ${escapeHtml(t(this._hass, "will_set"))}
            <b>${escapeHtml(entityName(this._hass, eid))}</b>
            ${escapeHtml(t(this._hass, "to"))}:
          </div>
          <div data-slot="value"></div>
          <div class="section-title">${escapeHtml(
            t(this._hass, "label_optional"),
          )}</div>
          <input type="text" class="tc-input" data-slot="label" />
        </div>
      `;
      const labelEl = slot.querySelector('[data-slot="label"]');
      labelEl.value = this._label;
      labelEl.placeholder = entityName(this._hass, eid);
      labelEl.addEventListener("input", (e) => {
        this._label = e.target.value;
      });

      const v = slot.querySelector('[data-slot="value"]');
      this._renderValueWidget(v, p);
    }

    _renderValueWidget(host, p) {
      const setTarget = (val) => {
        this._target = val;
        this._error = "";
        this._renderValueWidget(host, p);
      };

      switch (p.kind) {
        case "toggle": {
          if (this._target == null) this._target = "off";
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${this._target === "on" ? "active" : ""}" data-on>
                <ha-icon icon="mdi:power"></ha-icon>${escapeHtml(t(this._hass, "on"))}
              </button>
              <button class="toggle ${this._target === "off" ? "active" : ""}" data-off>
                <ha-icon icon="mdi:power-off"></ha-icon>${escapeHtml(t(this._hass, "off"))}
              </button>
            </div>`;
          host.querySelector("[data-on]").addEventListener("click", () => setTarget("on"));
          host.querySelector("[data-off]").addEventListener("click", () => setTarget("off"));
          return;
        }
        case "light": {
          if (this._target == null) this._target = "off";
          // Promote bare "on" to an object so the slider has a defined value.
          if (this._target === "on") this._target = { brightness_pct: 100 };
          const isOff = this._target === "off";
          const brightness =
            typeof this._target === "object"
              ? this._target.brightness_pct || 100
              : 100;
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${!isOff ? "active" : ""}" data-on>
                <ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>${escapeHtml(t(this._hass, "on"))}
              </button>
              <button class="toggle ${isOff ? "active" : ""}" data-off>
                <ha-icon icon="mdi:lightbulb-off-outline"></ha-icon>${escapeHtml(t(this._hass, "off"))}
              </button>
            </div>
            ${!isOff
              ? `<div class="section-title">${escapeHtml(t(this._hass, "brightness"))}</div>
                 <div class="slider-row">
                   <input type="range" min="1" max="100" step="1" value="${brightness}" data-slider />
                   <span class="badge" data-badge>${brightness}%</span>
                 </div>`
              : ""}
          `;
          host.querySelector("[data-on]").addEventListener("click", () =>
            setTarget({ brightness_pct: brightness }),
          );
          host.querySelector("[data-off]").addEventListener("click", () => setTarget("off"));
          const slider = host.querySelector("[data-slider]");
          if (slider) {
            const badge = host.querySelector("[data-badge]");
            slider.addEventListener("input", (e) => {
              const v = Number(e.target.value);
              this._target = { brightness_pct: v };
              badge.textContent = v + "%";
            });
          }
          return;
        }
        case "number": {
          if (this._target == null || typeof this._target !== "number") {
            this._target = (p.min + p.max) / 2;
          }
          const val = Number(this._target);
          const decimals = p.step < 1 ? 1 : 0;
          host.innerHTML = `
            <div class="slider-row">
              <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" data-slider />
              <span class="badge" data-badge>${val.toFixed(decimals)} ${escapeHtml(p.unit)}</span>
            </div>
            <input type="number" class="tc-input" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" data-number />
          `;
          const slider = host.querySelector("[data-slider]");
          const badge = host.querySelector("[data-badge]");
          const num = host.querySelector("[data-number]");
          slider.addEventListener("input", (e) => {
            const v = Number(e.target.value);
            this._target = v;
            badge.textContent = v.toFixed(decimals) + " " + p.unit;
            num.value = v;
          });
          num.addEventListener("input", (e) => {
            const v = Number(e.target.value);
            this._target = v;
            badge.textContent = v.toFixed(decimals) + " " + p.unit;
            slider.value = v;
          });
          return;
        }
        case "climate": {
          if (this._target == null) this._target = 21;
          if (typeof this._target !== "number" && typeof this._target !== "string") {
            this._target = 21;
          }
          const isMode = typeof this._target === "string" && p.modes && p.modes.includes(this._target);
          const numVal = isMode ? 21 : Number(this._target);
          host.innerHTML = `
            <div class="section-title">${escapeHtml(t(this._hass, "temperature"))}</div>
            <div class="slider-row">
              <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${numVal}" data-slider ${isMode ? "disabled" : ""} />
              <span class="badge" data-badge>${numVal.toFixed(1)} ${escapeHtml(p.unit)}</span>
            </div>
            ${p.modes && p.modes.length
              ? `<div class="section-title">${escapeHtml(t(this._hass, "hvac_mode"))}</div>
                 <select class="select" data-mode>
                   <option value="">— ${escapeHtml(t(this._hass, "temperature"))} —</option>
                   ${p.modes
                     .map(
                       (m) =>
                         `<option value="${escapeHtml(m)}" ${this._target === m ? "selected" : ""}>${escapeHtml(m)}</option>`,
                     )
                     .join("")}
                 </select>`
              : ""}
          `;
          const slider = host.querySelector("[data-slider]");
          const badge = host.querySelector("[data-badge]");
          slider.addEventListener("input", (e) => {
            const v = Number(e.target.value);
            this._target = v;
            badge.textContent = v.toFixed(1) + " " + p.unit;
          });
          const mode = host.querySelector("[data-mode]");
          if (mode) {
            mode.addEventListener("change", (e) => {
              const m = e.target.value;
              if (m) {
                this._target = m;
                slider.disabled = true;
              } else {
                this._target = numVal;
                slider.disabled = false;
              }
            });
          }
          return;
        }
        case "cover": {
          if (this._target == null) this._target = "close";
          const isPos = typeof this._target === "number";
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${this._target === "open" ? "active" : ""}" data-open>
                <ha-icon icon="mdi:window-shutter-open"></ha-icon>${escapeHtml(t(this._hass, "open"))}
              </button>
              <button class="toggle ${this._target === "close" ? "active" : ""}" data-close>
                <ha-icon icon="mdi:window-shutter"></ha-icon>${escapeHtml(t(this._hass, "close"))}
              </button>
              ${p.supportsPosition
                ? `<button class="toggle ${isPos ? "active" : ""}" data-pos>
                     <ha-icon icon="mdi:tune-vertical"></ha-icon>${escapeHtml(t(this._hass, "position"))}
                   </button>`
                : ""}
            </div>
            ${isPos
              ? `<div class="slider-row">
                   <input type="range" min="0" max="100" step="1" value="${this._target}" data-slider />
                   <span class="badge" data-badge>${this._target}%</span>
                 </div>`
              : ""}
          `;
          host.querySelector("[data-open]").addEventListener("click", () => setTarget("open"));
          host.querySelector("[data-close]").addEventListener("click", () => setTarget("close"));
          const posBtn = host.querySelector("[data-pos]");
          if (posBtn) posBtn.addEventListener("click", () => setTarget(50));
          const slider = host.querySelector("[data-slider]");
          if (slider) {
            const badge = host.querySelector("[data-badge]");
            slider.addEventListener("input", (e) => {
              const v = Number(e.target.value);
              this._target = v;
              badge.textContent = v + "%";
            });
          }
          return;
        }
        case "fan": {
          if (this._target == null) this._target = "off";
          const isPct = typeof this._target === "number";
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${this._target === "off" ? "active" : ""}" data-off>
                <ha-icon icon="mdi:fan-off"></ha-icon>${escapeHtml(t(this._hass, "off"))}
              </button>
              <button class="toggle ${isPct ? "active" : ""}" data-on>
                <ha-icon icon="mdi:fan"></ha-icon>${escapeHtml(t(this._hass, "on"))}
              </button>
            </div>
            ${isPct
              ? `<div class="section-title">${escapeHtml(t(this._hass, "percentage"))}</div>
                 <div class="slider-row">
                   <input type="range" min="0" max="100" step="1" value="${this._target}" data-slider />
                   <span class="badge" data-badge>${this._target}%</span>
                 </div>`
              : ""}
          `;
          host.querySelector("[data-off]").addEventListener("click", () => setTarget("off"));
          host.querySelector("[data-on]").addEventListener("click", () => setTarget(50));
          const slider = host.querySelector("[data-slider]");
          if (slider) {
            const badge = host.querySelector("[data-badge]");
            slider.addEventListener("input", (e) => {
              const v = Number(e.target.value);
              this._target = v;
              badge.textContent = v + "%";
            });
          }
          return;
        }
        case "select": {
          if (this._target == null) this._target = (p.options && p.options[0]) || "";
          host.innerHTML = `<select class="select" data-sel>${(p.options || [])
            .map(
              (o) =>
                `<option value="${escapeHtml(o)}" ${this._target === o ? "selected" : ""}>${escapeHtml(o)}</option>`,
            )
            .join("")}</select>`;
          host.querySelector("[data-sel]").addEventListener("change", (e) => {
            this._target = e.target.value;
          });
          return;
        }
        case "media": {
          if (this._target == null) this._target = "pause";
          const options = ["play", "pause", "stop", "on", "off"];
          host.innerHTML = `<div class="toggle-row">${options
            .map(
              (o) => `
                <button class="toggle ${this._target === o ? "active" : ""}" data-val="${o}">
                  <ha-icon icon="${
                    {
                      play: "mdi:play",
                      pause: "mdi:pause",
                      stop: "mdi:stop",
                      on: "mdi:power",
                      off: "mdi:power-off",
                    }[o]
                  }"></ha-icon>${escapeHtml(t(this._hass, o))}
                </button>`,
            )
            .join("")}</div>`;
          host.querySelectorAll("[data-val]").forEach((btn) => {
            btn.addEventListener("click", () => setTarget(btn.dataset.val));
          });
          return;
        }
        case "lock": {
          if (this._target == null) this._target = "lock";
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${this._target === "lock" ? "active" : ""}" data-v="lock">
                <ha-icon icon="mdi:lock"></ha-icon>${escapeHtml(t(this._hass, "lock_lock"))}
              </button>
              <button class="toggle ${this._target === "unlock" ? "active" : ""}" data-v="unlock">
                <ha-icon icon="mdi:lock-open"></ha-icon>${escapeHtml(t(this._hass, "lock_unlock"))}
              </button>
            </div>`;
          host.querySelectorAll("[data-v]").forEach((btn) => {
            btn.addEventListener("click", () => setTarget(btn.dataset.v));
          });
          return;
        }
        case "vacuum": {
          if (this._target == null) this._target = "return_to_base";
          const opts = [
            { v: "start", icon: "mdi:play", label: t(this._hass, "vacuum_start") },
            { v: "pause", icon: "mdi:pause", label: t(this._hass, "pause") },
            { v: "return_to_base", icon: "mdi:home", label: t(this._hass, "vacuum_return") },
            { v: "stop", icon: "mdi:stop", label: t(this._hass, "stop") },
          ];
          host.innerHTML = `<div class="toggle-row">${opts
            .map(
              (o) => `
              <button class="toggle ${this._target === o.v ? "active" : ""}" data-v="${o.v}">
                <ha-icon icon="${o.icon}"></ha-icon>${escapeHtml(o.label)}
              </button>`,
            )
            .join("")}</div>`;
          host.querySelectorAll("[data-v]").forEach((btn) => {
            btn.addEventListener("click", () => setTarget(btn.dataset.v));
          });
          return;
        }
        case "humidifier": {
          if (this._target == null) this._target = "off";
          if (this._target === "on") this._target = { humidity: 50 };
          const isOff = this._target === "off";
          const humidity =
            typeof this._target === "object" && this._target.humidity != null
              ? this._target.humidity
              : 50;
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${!isOff ? "active" : ""}" data-v-on>
                <ha-icon icon="mdi:water-percent"></ha-icon>${escapeHtml(t(this._hass, "on"))}
              </button>
              <button class="toggle ${isOff ? "active" : ""}" data-v-off>
                <ha-icon icon="mdi:water-off"></ha-icon>${escapeHtml(t(this._hass, "off"))}
              </button>
            </div>
            ${!isOff
              ? `<div class="section-title">${escapeHtml(t(this._hass, "humidity"))}</div>
                 <div class="slider-row">
                   <input type="range" min="${p.min}" max="${p.max}" step="1" value="${humidity}" data-slider />
                   <span class="badge" data-badge>${humidity}%</span>
                 </div>`
              : ""}`;
          host.querySelector("[data-v-on]").addEventListener("click", () =>
            setTarget({ humidity: humidity }),
          );
          host.querySelector("[data-v-off]").addEventListener("click", () => setTarget("off"));
          const slider = host.querySelector("[data-slider]");
          if (slider) {
            const badge = host.querySelector("[data-badge]");
            slider.addEventListener("input", (e) => {
              const v = Number(e.target.value);
              this._target = { humidity: v };
              badge.textContent = v + "%";
            });
          }
          return;
        }
        case "water_heater": {
          if (this._target == null) this._target = "off";
          if (this._target === "on") this._target = { temperature: 50 };
          const isOff = this._target === "off";
          const temp =
            typeof this._target === "object" && this._target.temperature != null
              ? this._target.temperature
              : 50;
          host.innerHTML = `
            <div class="toggle-row">
              <button class="toggle ${!isOff ? "active" : ""}" data-v-on>
                <ha-icon icon="mdi:water-boiler"></ha-icon>${escapeHtml(t(this._hass, "on"))}
              </button>
              <button class="toggle ${isOff ? "active" : ""}" data-v-off>
                <ha-icon icon="mdi:water-boiler-off"></ha-icon>${escapeHtml(t(this._hass, "off"))}
              </button>
            </div>
            ${!isOff
              ? `<div class="section-title">${escapeHtml(t(this._hass, "temperature"))}</div>
                 <div class="slider-row">
                   <input type="range" min="${p.min}" max="${p.max}" step="1" value="${temp}" data-slider />
                   <span class="badge" data-badge>${temp} ${escapeHtml(p.unit)}</span>
                 </div>`
              : ""}`;
          host.querySelector("[data-v-on]").addEventListener("click", () =>
            setTarget({ temperature: temp }),
          );
          host.querySelector("[data-v-off]").addEventListener("click", () => setTarget("off"));
          const slider = host.querySelector("[data-slider]");
          if (slider) {
            const badge = host.querySelector("[data-badge]");
            slider.addEventListener("input", (e) => {
              const v = Number(e.target.value);
              this._target = { temperature: v };
              badge.textContent = v + " " + p.unit;
            });
          }
          return;
        }
        case "lawn_mower": {
          if (this._target == null) this._target = "dock";
          const opts = [
            { v: "start", icon: "mdi:play", label: t(this._hass, "lawn_start") },
            { v: "pause", icon: "mdi:pause", label: t(this._hass, "pause") },
            { v: "dock", icon: "mdi:home", label: t(this._hass, "lawn_dock") },
          ];
          host.innerHTML = `<div class="toggle-row">${opts
            .map(
              (o) => `
              <button class="toggle ${this._target === o.v ? "active" : ""}" data-v="${o.v}">
                <ha-icon icon="${o.icon}"></ha-icon>${escapeHtml(o.label)}
              </button>`,
            )
            .join("")}</div>`;
          host.querySelectorAll("[data-v]").forEach((btn) => {
            btn.addEventListener("click", () => setTarget(btn.dataset.v));
          });
          return;
        }
        case "text":
        default: {
          if (this._target == null) this._target = "";
          host.innerHTML = `<input type="text" class="tc-input" data-text />`;
          const tf = host.querySelector("[data-text]");
          tf.value = String(this._target);
          tf.addEventListener("input", (e) => {
            this._target = e.target.value;
          });
        }
      }
    }

    _renderStepTime(slot) {
      slot.innerHTML = `
        <div class="step">
          <div class="tabs">
            <button class="tab ${this._tab === "duration" ? "active" : ""}" data-tab="duration">
              <ha-icon icon="mdi:timer-sand"></ha-icon>${escapeHtml(t(this._hass, "tab_duration"))}
            </button>
            <button class="tab ${this._tab === "time" ? "active" : ""}" data-tab="time">
              <ha-icon icon="mdi:clock-outline"></ha-icon>${escapeHtml(t(this._hass, "tab_time"))}
            </button>
          </div>
          <div data-slot="time-body"></div>
        </div>
      `;
      slot.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._tab = btn.dataset.tab;
          this._error = "";
          this._render();
        });
      });
      this._renderTimeBody(slot.querySelector('[data-slot="time-body"]'));
    }

    _renderTimeBody(host) {
      if (this._tab === "duration") {
        host.innerHTML = `
          <div class="duration-grid">
            <label class="duration-cell">
              <span>${escapeHtml(t(this._hass, "hours"))}</span>
              <input class="hms" type="number" min="0" max="99" value="${this._h}" data-h />
            </label>
            <label class="duration-cell">
              <span>${escapeHtml(t(this._hass, "minutes"))}</span>
              <input class="hms" type="number" min="0" max="59" value="${this._m}" data-m />
            </label>
            <label class="duration-cell">
              <span>${escapeHtml(t(this._hass, "seconds"))}</span>
              <input class="hms" type="number" min="0" max="59" value="${this._s}" data-s />
            </label>
          </div>
          <div class="quick">
            <button data-add="15">${escapeHtml(fmtMinDelta(this._hass, 15))}</button>
            <button data-add="30">${escapeHtml(fmtMinDelta(this._hass, 30))}</button>
            <button data-add="60">${escapeHtml(fmtHourDelta(this._hass, 1))}</button>
          </div>
        `;
        const hEl = host.querySelector("[data-h]");
        const mEl = host.querySelector("[data-m]");
        const sEl = host.querySelector("[data-s]");
        hEl.addEventListener("input", (e) => {
          this._h = Math.max(0, Math.min(99, Number(e.target.value) || 0));
        });
        mEl.addEventListener("input", (e) => {
          this._m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
        });
        sEl.addEventListener("input", (e) => {
          this._s = Math.max(0, Math.min(59, Number(e.target.value) || 0));
        });
        host.querySelectorAll("[data-add]").forEach((btn) => {
          btn.addEventListener("click", () => {
            this._addMinutes(Number(btn.dataset.add));
            hEl.value = this._h;
            mEl.value = this._m;
            sEl.value = this._s;
          });
        });
      } else {
        // Custom HH:MM input — native <input type="time"> is unreliable
        // inside a custom modal (especially on mobile, where the OS picker
        // can't always position itself correctly over the overlay).
        const parts = (this._at || "").split(":");
        const hVal = parts[0] !== undefined && parts[0] !== "" ? parts[0] : "";
        const mVal = parts[1] !== undefined && parts[1] !== "" ? parts[1] : "";
        const nowD = new Date();
        const nowH = String(nowD.getHours()).padStart(2, "0");
        const nowM = String(nowD.getMinutes()).padStart(2, "0");
        host.innerHTML = `
          <div class="time-row">
            <input
              class="time-cell"
              type="number"
              inputmode="numeric"
              min="0" max="23"
              placeholder="${nowH}"
              value="${escapeHtml(hVal)}"
              data-th
              aria-label="${escapeHtml(t(this._hass, "hours"))}"
            />
            <span class="time-sep">:</span>
            <input
              class="time-cell"
              type="number"
              inputmode="numeric"
              min="0" max="59"
              placeholder="${nowM}"
              value="${escapeHtml(mVal)}"
              data-tm
              aria-label="${escapeHtml(t(this._hass, "minutes"))}"
            />
          </div>
          <div class="quick">
            <button data-quick-time="now">${escapeHtml(t(this._hass, "now"))}</button>
            <button data-quick-time="1h">${escapeHtml(t(this._hass, "in_1h"))}</button>
            <button data-quick-time="morning">${escapeHtml(t(this._hass, "tomorrow_morning"))}</button>
          </div>
        `;
        const hIn = host.querySelector("[data-th]");
        const mIn = host.querySelector("[data-tm]");
        const sync = () => {
          const hh = hIn.value === "" ? null : Math.max(0, Math.min(23, Number(hIn.value) || 0));
          const mm = mIn.value === "" ? null : Math.max(0, Math.min(59, Number(mIn.value) || 0));
          if (hh === null && mm === null) {
            this._at = "";
          } else {
            this._at =
              String(hh ?? 0).padStart(2, "0") +
              ":" +
              String(mm ?? 0).padStart(2, "0");
          }
        };
        hIn.addEventListener("input", sync);
        mIn.addEventListener("input", sync);
        // Auto-jump from hours to minutes when 2 digits typed.
        hIn.addEventListener("input", (e) => {
          if (e.target.value.length >= 2) mIn.focus();
        });
        host.querySelectorAll("[data-quick-time]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const which = btn.dataset.quickTime;
            const d = new Date();
            if (which === "1h") d.setHours(d.getHours() + 1);
            else if (which === "morning") {
              d.setDate(d.getDate() + 1);
              d.setHours(7, 0, 0, 0);
            }
            hIn.value = String(d.getHours()).padStart(2, "0");
            mIn.value = String(d.getMinutes()).padStart(2, "0");
            sync();
          });
        });
      }
    }

    _addMinutes(min) {
      let total = this._h * 3600 + this._m * 60 + this._s + min * 60;
      total = Math.max(0, total);
      this._h = Math.floor(total / 3600);
      this._m = Math.floor((total % 3600) / 60);
      this._s = total % 60;
    }

    _currentDuration() {
      if (this._tab === "duration") {
        return this._h * 3600 + this._m * 60 + this._s;
      }
      if (!this._at) return 0;
      const [hh, mm] = this._at.split(":").map((x) => Number(x));
      // Resolve the wall-clock time in the HA server's timezone, so that
      // when a user picks "21:00" and the dashboard is on a phone in a
      // different timezone, the timer still fires at 21:00 server-local
      // time (which is what they see in HA's UI).
      const serverTz =
        (this._hass &&
          this._hass.config &&
          this._hass.config.time_zone) ||
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      const now = new Date();
      // Compute "now" in server tz via formatToParts (locale-independent,
      // robust across browsers and DST edges).
      let Y, M, D;
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: serverTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour12: false,
        })
          .formatToParts(now)
          .reduce((m, p) => {
            m[p.type] = p.value;
            return m;
          }, {});
        Y = Number(parts.year);
        M = Number(parts.month) - 1;
        D = Number(parts.day);
      } catch (e) {
        Y = now.getFullYear();
        M = now.getMonth();
        D = now.getDate();
      }

      // Build the target wall-clock and then translate that wall-clock
      // (assumed to be in serverTz) into an absolute UTC timestamp.
      const targetWallStr = `${Y.toString().padStart(4, "0")}-${(M + 1)
        .toString()
        .padStart(2, "0")}-${D.toString().padStart(2, "0")}T${String(
        hh || 0,
      ).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00`;
      let target = this._wallTimeInTzToDate(targetWallStr, serverTz);
      if (!target || target.getTime() <= now.getTime()) {
        // Roll forward one day.
        const nextDay = new Date(Y, M, D + 1);
        const Y2 = nextDay.getFullYear();
        const M2 = nextDay.getMonth();
        const D2 = nextDay.getDate();
        const tomorrowStr = `${Y2.toString().padStart(4, "0")}-${(M2 + 1)
          .toString()
          .padStart(2, "0")}-${D2.toString().padStart(2, "0")}T${String(
          hh || 0,
        ).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00`;
        target = this._wallTimeInTzToDate(tomorrowStr, serverTz);
      }
      if (!target) return 0;
      return Math.round((target.getTime() - now.getTime()) / 1000);
    }

    // Convert a "YYYY-MM-DDTHH:mm:ss" wall-time string in a given IANA timezone
    // to an absolute Date by binary-searching the UTC offset.
    _wallTimeInTzToDate(wallStr, tz) {
      try {
        // Start with a UTC guess; the wall-clock format in serverTz at this
        // UTC time should match `wallStr` exactly.
        let guess = new Date(wallStr + "Z");
        for (let i = 0; i < 3; i++) {
          const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          const parts = fmt.formatToParts(guess).reduce((m, p) => {
            m[p.type] = p.value;
            return m;
          }, {});
          const rebuilt = `${parts.year}-${parts.month}-${parts.day}T${(
            parts.hour === "24" ? "00" : parts.hour
          )}:${parts.minute}:${parts.second}`;
          const diff =
            new Date(wallStr + "Z").getTime() - new Date(rebuilt + "Z").getTime();
          if (Math.abs(diff) < 1000) break;
          guess = new Date(guess.getTime() + diff);
        }
        return guess;
      } catch (e) {
        return null;
      }
    }

    _onBack() {
      this._error = "";
      if (this._step > 0) {
        this._step -= 1;
        this._render();
      } else {
        this._close();
      }
    }
    async _onPrimary() {
      if (this._step === 0) {
        if (!this._entity_id) {
          this._error = t(this._hass, "missing_entity");
          this._updateError();
          return;
        }
        // Initialize target via picker default.
        const p = pickerFor(this._hass, this._entity_id);
        if (this._target == null) {
          if (p.kind === "toggle" || p.kind === "fan") this._target = "off";
          else if (p.kind === "light") this._target = "off";
          else if (p.kind === "number") {
            const mid = (p.min + p.max) / 2;
            const step = p.step || 1;
            this._target = Math.round((mid - p.min) / step) * step + p.min;
          } else if (p.kind === "climate") this._target = 21;
          else if (p.kind === "cover") this._target = "close";
          else if (p.kind === "select") this._target = (p.options || [""])[0];
          else if (p.kind === "media") this._target = "pause";
          else if (p.kind === "lock") this._target = "lock";
          else if (p.kind === "vacuum") this._target = "return_to_base";
          else if (p.kind === "humidifier") this._target = "off";
          else if (p.kind === "water_heater") this._target = "off";
          else if (p.kind === "lawn_mower") this._target = "dock";
          else this._target = "";
        }
        this._step = 1;
        this._error = "";
        this._render();
        return;
      }
      if (this._step === 1) {
        if (this._target === null || this._target === undefined || this._target === "") {
          this._error = t(this._hass, "missing_value");
          this._updateError();
          return;
        }
        this._step = 2;
        this._error = "";
        this._render();
        return;
      }
      // Step 2 -> submit
      if (this._tab === "time" && !this._at) {
        this._error = t(this._hass, "missing_time");
        this._updateError();
        return;
      }
      const dur = this._currentDuration();
      if (!dur || dur < 1) {
        this._error = t(this._hass, "missing_duration");
        this._updateError();
        return;
      }
      try {
        await this._hass.callService("timer_card", "create", {
          card_id: this._config.card_id,
          entity_id: this._entity_id,
          target_value: this._target,
          duration: dur,
          label: this._label || undefined,
        });
        this._close();
      } catch (err) {
        this._error = String((err && err.message) || err);
        this._updateError();
      }
    }
  }
  customElements.define("timer-card-create-dialog", TimerCardCreateDialog);

  // ------------------------------------------------------------------
  // Edit (adjust duration) dialog
  // ------------------------------------------------------------------
  class TimerCardEditDialog extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._open = false;
      this._timer = null;
      this._mounted = false;
      this._h = 0;
      this._m = 0;
      this._s = 0;
      this._tick = null;
      this._error = "";
    }

    set hass(h) {
      this._hass = h;
    }
    get hass() {
      return this._hass;
    }

    show(timer) {
      this._timer = timer;
      this._open = true;
      this._error = "";
      // Pre-fill the inputs with the current remaining duration so the
      // user can see and edit the absolute value comfortably.
      const remaining = this._currentRemaining();
      this._h = Math.floor(remaining / 3600);
      this._m = Math.floor((remaining % 3600) / 60);
      this._s = remaining % 60;
      this._render();
      this._startTick();
    }

    _close() {
      this._open = false;
      this._stopTick();
      this._render();
    }

    _startTick() {
      if (this._tick) return;
      this._tick = setInterval(() => this._updateLive(), 1000);
    }
    _stopTick() {
      if (this._tick) clearInterval(this._tick);
      this._tick = null;
    }

    _currentRemaining() {
      if (!this._timer) return 0;
      const now = Date.now() / 1000;
      return Math.max(0, Math.round((this._timer.finish_time || 0) - now));
    }

    _updateLive() {
      const remEl = this.shadowRoot.querySelector('[data-slot="remaining"]');
      if (remEl) remEl.textContent = fmtRemaining(this._currentRemaining());
    }

    _render() {
      if (!this._open || !this._hass || !this._timer) {
        this.shadowRoot.innerHTML = "";
        this._mounted = false;
        return;
      }
      if (!this._mounted) {
        this._mountSkeleton();
        this._mounted = true;
      }
      this._updateChrome();
    }

    _mountSkeleton() {
      this.shadowRoot.innerHTML = `
        <style>${DIALOG_STYLE}</style>
        <div class="modal-backdrop" data-slot="backdrop">
          <div class="modal-card" role="dialog" aria-modal="true">
            <div class="modal-header">
              <ha-icon-button class="modal-close" data-action="cancel" label="${escapeHtml(
                t(this._hass, "cancel"),
              )}"><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
              <div class="modal-title">${escapeHtml(t(this._hass, "adjust_duration"))}</div>
            </div>
            <div class="dialog-content">
              <div class="edit-target" data-slot="label"></div>
              <div class="edit-remaining">
                <div class="edit-remaining-label">${escapeHtml(
                  t(this._hass, "current_remaining"),
                )}</div>
                <div class="edit-remaining-value" data-slot="remaining">--:--</div>
              </div>
              <div class="edit-section">
                <div class="section-title">${escapeHtml(t(this._hass, "add"))}</div>
                <div class="quick">
                  <button data-delta="60">${escapeHtml(fmtMinDelta(this._hass, 1))}</button>
                  <button data-delta="300">${escapeHtml(fmtMinDelta(this._hass, 5))}</button>
                  <button data-delta="600">${escapeHtml(fmtMinDelta(this._hass, 10))}</button>
                  <button data-delta="1800">${escapeHtml(fmtMinDelta(this._hass, 30))}</button>
                  <button data-delta="3600">${escapeHtml(fmtHourDelta(this._hass, 1))}</button>
                </div>
              </div>
              <div class="edit-section">
                <div class="section-title">${escapeHtml(t(this._hass, "subtract"))}</div>
                <div class="quick">
                  <button data-delta="-60">${escapeHtml(fmtMinDelta(this._hass, -1))}</button>
                  <button data-delta="-300">${escapeHtml(fmtMinDelta(this._hass, -5))}</button>
                  <button data-delta="-600">${escapeHtml(fmtMinDelta(this._hass, -10))}</button>
                  <button data-delta="-1800">${escapeHtml(fmtMinDelta(this._hass, -30))}</button>
                </div>
              </div>
              <div class="edit-section">
                <div class="section-title">${escapeHtml(t(this._hass, "new_duration"))}</div>
                <div class="duration-grid">
                  <label class="duration-cell">
                    <span>${escapeHtml(t(this._hass, "hours"))}</span>
                    <input class="hms" type="number" min="0" max="99" data-h />
                  </label>
                  <label class="duration-cell">
                    <span>${escapeHtml(t(this._hass, "minutes"))}</span>
                    <input class="hms" type="number" min="0" max="59" data-m />
                  </label>
                  <label class="duration-cell">
                    <span>${escapeHtml(t(this._hass, "seconds"))}</span>
                    <input class="hms" type="number" min="0" max="59" data-s />
                  </label>
                </div>
              </div>
              <div data-slot="error"></div>
            </div>
            <div class="footer-actions">
              <ha-button data-action="cancel">${escapeHtml(t(this._hass, "cancel"))}</ha-button>
              <ha-button raised data-action="set" class="primary-btn">${escapeHtml(
                t(this._hass, "ok"),
              )}</ha-button>
            </div>
          </div>
        </div>
      `;
      const backdrop = this.shadowRoot.querySelector('[data-slot="backdrop"]');
      backdrop.addEventListener("click", (ev) => {
        if (ev.target === backdrop) this._close();
      });
      this.shadowRoot
        .querySelectorAll('[data-action="cancel"]')
        .forEach((el) => el.addEventListener("click", () => this._close()));
      this.shadowRoot.querySelectorAll("[data-delta]").forEach((btn) => {
        btn.addEventListener("click", () => this._applyDelta(Number(btn.dataset.delta)));
      });
      const hEl = this.shadowRoot.querySelector("[data-h]");
      const mEl = this.shadowRoot.querySelector("[data-m]");
      const sEl = this.shadowRoot.querySelector("[data-s]");
      hEl.addEventListener("input", (e) => {
        this._h = Math.max(0, Math.min(99, Number(e.target.value) || 0));
      });
      mEl.addEventListener("input", (e) => {
        this._m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
      });
      sEl.addEventListener("input", (e) => {
        this._s = Math.max(0, Math.min(59, Number(e.target.value) || 0));
      });
      this.shadowRoot
        .querySelector('[data-action="set"]')
        .addEventListener("click", () => this._applyAbsolute());
    }

    _updateChrome() {
      const labelEl = this.shadowRoot.querySelector('[data-slot="label"]');
      if (labelEl) {
        labelEl.textContent =
          this._timer.label ||
          entityName(this._hass, this._timer.entity_id) ||
          this._timer.entity_id;
      }
      const remEl = this.shadowRoot.querySelector('[data-slot="remaining"]');
      if (remEl) remEl.textContent = fmtRemaining(this._currentRemaining());
      const hEl = this.shadowRoot.querySelector("[data-h]");
      const mEl = this.shadowRoot.querySelector("[data-m]");
      const sEl = this.shadowRoot.querySelector("[data-s]");
      if (hEl) hEl.value = this._h;
      if (mEl) mEl.value = this._m;
      if (sEl) sEl.value = this._s;
      const slot = this.shadowRoot.querySelector('[data-slot="error"]');
      if (slot) {
        slot.innerHTML = this._error
          ? `<div class="error">${escapeHtml(this._error)}</div>`
          : "";
      }
    }

    async _applyDelta(delta) {
      this._error = "";
      try {
        await this._hass.callService("timer_card", "update", {
          timer_id: this._timer.id,
          delta,
        });
        // Update local timer reference so subsequent +/- buttons compose.
        this._timer = {
          ...this._timer,
          finish_time: (this._timer.finish_time || 0) + delta,
        };
        const remaining = Math.max(0, this._currentRemaining());
        this._h = Math.floor(remaining / 3600);
        this._m = Math.floor((remaining % 3600) / 60);
        this._s = remaining % 60;
        this._updateChrome();
      } catch (err) {
        this._error = String((err && err.message) || err);
        this._updateChrome();
      }
    }

    async _applyAbsolute() {
      this._error = "";
      const duration = this._h * 3600 + this._m * 60 + this._s;
      if (!duration || duration < 1) {
        this._error = t(this._hass, "missing_duration");
        this._updateChrome();
        return;
      }
      try {
        await this._hass.callService("timer_card", "update", {
          timer_id: this._timer.id,
          duration,
        });
        this._close();
      } catch (err) {
        this._error = String((err && err.message) || err);
        this._updateChrome();
      }
    }
  }
  customElements.define("timer-card-edit-dialog", TimerCardEditDialog);

  // ------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------
  const EDITOR_STYLE = /* css */ `
    :host { display: block; }
    * { box-sizing: border-box; }
    .editor { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
    .hint { color: var(--secondary-text-color); font-size: 13px; }
    ha-form { display: block; width: 100%; }
    .tc-input {
      display: block; width: 100%; padding: 12px 14px;
      font: inherit; font-size: 14px;
      color: var(--primary-text-color);
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 12px; outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
      box-sizing: border-box;
    }
    .tc-input:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent);
    }
    .tc-field { display: flex; flex-direction: column; gap: 4px; }
    .tc-field-label { font-size: 12px; color: var(--secondary-text-color); }
    ha-switch { --mdc-theme-secondary: var(--primary-color); }
    .section { display: flex; flex-direction: column; gap: 8px; }
    .section-title { font-weight: 500; font-size: 13px; color: var(--primary-text-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      padding: 6px 12px; border-radius: 999px; background: var(--secondary-background-color);
      border: 1px solid var(--divider-color); font: inherit; color: var(--primary-text-color); cursor: pointer;
      font-size: 13px;
    }
    .chip.active { background: color-mix(in srgb, var(--primary-color) 18%, transparent); color: var(--primary-color); border-color: var(--primary-color); }
    .fav-list { display: flex; flex-direction: column; gap: 4px; }
    .fav-row {
      display: grid; grid-template-columns: auto 1fr auto auto; align-items: center;
      gap: 8px; padding: 8px 10px; background: var(--secondary-background-color); border-radius: 12px;
    }
    .muted { color: var(--secondary-text-color); font-size: 12px; }
    .card-id-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    code { font-family: var(--code-font-family, monospace); padding: 4px 8px; background: var(--secondary-background-color); border-radius: 6px; font-size: 12px; }
    .link { background: none; border: none; color: var(--primary-color); font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
    .switch-row { display: flex; align-items: center; gap: 10px; }
  `;

  class TimerCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._config = null;
    }

    set hass(h) {
      this._hass = h;
      this._render();
    }
    get hass() {
      return this._hass;
    }

    setConfig(config) {
      this._config = {
        // Preserve the `type` so every emitted config keeps it. Without
        // this the visual editor would save a config that Lovelace
        // rejects with "Kein Typ angegeben" / "No card type configured".
        type: config.type || "custom:timer-card",
        card_id: config.card_id || uuid(),
        title: config.title || "",
        favorites: Array.isArray(config.favorites) ? config.favorites : [],
        domains: Array.isArray(config.domains) ? config.domains : DEFAULT_DOMAINS,
        show_finished:
          config.show_finished === undefined ? true : !!config.show_finished,
      };
      this._render();
    }

    _emit() {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        }),
      );
    }
    _set(field, value) {
      this._config = { ...this._config, [field]: value };
      this._emit();
      this._render();
    }
    _toggleDomain(domain) {
      const list = new Set(this._config.domains);
      if (list.has(domain)) list.delete(domain);
      else list.add(domain);
      this._set("domains", Array.from(list));
    }
    _addFavorite(eid) {
      if (!eid || this._config.favorites.includes(eid)) return;
      this._set("favorites", [...this._config.favorites, eid]);
    }
    _removeFavorite(eid) {
      this._set(
        "favorites",
        this._config.favorites.filter((e) => e !== eid),
      );
    }

    _render() {
      if (!this._config || !this._hass) {
        this.shadowRoot.innerHTML = `<style>${EDITOR_STYLE}</style>`;
        return;
      }
      this.shadowRoot.innerHTML = `
        <style>${EDITOR_STYLE}</style>
        <div class="editor">
          <div class="hint">${escapeHtml(t(this._hass, "configure_hint"))}</div>

          <div class="tc-field">
            <span class="tc-field-label">${escapeHtml(t(this._hass, "title_label"))}</span>
            <input
              type="text"
              class="tc-input"
              data-title
              placeholder="${escapeHtml(t(this._hass, "title_placeholder"))}"
            />
          </div>

          <div class="section">
            <div class="section-title">${escapeHtml(t(this._hass, "domain_filter"))}</div>
            <div class="chips" data-slot="domains"></div>
          </div>

          <div class="section">
            <div class="section-title">${escapeHtml(t(this._hass, "favorites_label"))}</div>
            <div class="fav-list" data-slot="favs"></div>
            <ha-form data-fav-picker></ha-form>
          </div>

          <div class="switch-row">
            <ha-switch data-show-finished></ha-switch>
            <span>${escapeHtml(t(this._hass, "show_finished_label"))}</span>
          </div>

          <div class="section">
            <div class="section-title">${escapeHtml(t(this._hass, "card_id_label"))}</div>
            <div class="card-id-row">
              <code>${escapeHtml(this._config.card_id)}</code>
              <button class="link" data-action="regen">${escapeHtml(t(this._hass, "regenerate"))}</button>
            </div>
            <div class="muted">${escapeHtml(t(this._hass, "card_id_help"))}</div>
          </div>
        </div>
      `;

      const titleEl = this.shadowRoot.querySelector("[data-title]");
      titleEl.value = this._config.title;
      titleEl.addEventListener("input", (e) => {
        this._config = { ...this._config, title: e.target.value };
        this._emit();
      });

      const domains = this.shadowRoot.querySelector('[data-slot="domains"]');
      DEFAULT_DOMAINS.forEach((d) => {
        const btn = document.createElement("button");
        btn.className =
          "chip" + (this._config.domains.includes(d) ? " active" : "");
        btn.textContent = d;
        btn.addEventListener("click", () => this._toggleDomain(d));
        domains.appendChild(btn);
      });

      const favs = this.shadowRoot.querySelector('[data-slot="favs"]');
      this._config.favorites.forEach((eid) => {
        const row = document.createElement("div");
        row.className = "fav-row";
        row.innerHTML = `
          <ha-icon icon="${escapeHtml(iconFor(this._hass, eid))}"></ha-icon>
          <span>${escapeHtml(entityName(this._hass, eid))}</span>
          <span class="muted">${escapeHtml(eid)}</span>
          <button class="link" data-rm="${escapeHtml(eid)}">${escapeHtml(t(this._hass, "remove_favorite"))}</button>
        `;
        row
          .querySelector("[data-rm]")
          .addEventListener("click", () => this._removeFavorite(eid));
        favs.appendChild(row);
      });

      // ha-form with entity selector — works without bundling ha-entity-picker
      // ourselves; ha-form dynamically loads the picker module on first render.
      const favForm = this.shadowRoot.querySelector("[data-fav-picker]");
      favForm.hass = this._hass;
      favForm.data = { entity: "" };
      favForm.schema = [
        {
          name: "entity",
          selector: {
            entity: {
              domain:
                this._config.domains && this._config.domains.length
                  ? this._config.domains
                  : undefined,
            },
          },
        },
      ];
      favForm.computeLabel = () => t(this._hass, "add_favorite");
      favForm.addEventListener("value-changed", (ev) => {
        const eid = ev.detail && ev.detail.value && ev.detail.value.entity;
        if (eid) {
          this._addFavorite(eid);
        }
      });

      const showFin = this.shadowRoot.querySelector("[data-show-finished]");
      const setSwitchChecked = () => {
        try {
          showFin.checked = !!this._config.show_finished;
        } catch (e) {
          /* upgrade race */
        }
      };
      if (customElements.get("ha-switch")) setSwitchChecked();
      else customElements.whenDefined("ha-switch").then(setSwitchChecked);
      showFin.addEventListener("change", (e) => {
        this._set("show_finished", !!e.target.checked);
      });

      this.shadowRoot
        .querySelector('[data-action="regen"]')
        .addEventListener("click", () => this._set("card_id", uuid()));
    }
  }
  customElements.define("timer-card-editor", TimerCardEditor);

  // ------------------------------------------------------------------
  // Register with the Lovelace card picker
  // ------------------------------------------------------------------
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "timer-card",
    name: "Timer Card",
    description:
      "Create timers that set any entity to a desired value when they expire.",
    preview: false,
    documentationURL: "https://github.com/NuIIPointer/ha-timer-card",
  });

  /* eslint-disable no-console */
  console.info(
    "%c TIMER-CARD %c v" + CARD_VERSION + " ",
    "color:white;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
    "color:#03a9f4;background:white;font-weight:700;border-radius:0 3px 3px 0;padding:2px 4px;border:1px solid #03a9f4",
  );
})();
