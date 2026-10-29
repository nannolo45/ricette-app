// Translations: Italiano, Deutsch, English.

export const LANGS = { it: 'Italiano', de: 'Deutsch', en: 'English' };

const plural = (n, one, many) => (n === 1 ? one : many);

const dict = {
  it: {
    photos: 'Foto', addPhoto: 'Aggiungi foto', cover: '★ Copertina', makeCover: '☆ Copertina', photoError: 'Impossibile leggere questa immagine.',
    appName: 'Ricette',
    tabRecipes: 'Ricette', tabList: 'Spesa', tabPantry: 'Dispensa', tabSettings: 'Impostazioni',
    pasteLink: 'Incolla il link di una ricetta…', import: 'Importa',
    importNeedsGithub: 'Per importare i link in automatico collega GitHub nelle Impostazioni. Intanto il link resta in coda.',
    search: 'Cerca ricette o ingredienti', manual: 'Nuova', noRecipes: 'Nessuna ricetta. Incolla un link qui sopra o creane una a mano.',
    importing: 'Importazione in corso…', importQueuedOffline: 'In coda: verrà importata alla prossima sincronizzazione.',
    importFailed: 'Non sono riuscito a leggere questa pagina.', retry: 'Riprova', addManually: 'Aggiungi a mano', remove: 'Rimuovi',
    people: (n) => `${n} ${plural(n, 'persona', 'persone')}`,
    ingredients: 'Ingredienti', steps: 'Preparazione', notes: 'Note', source: 'Ricetta originale',
    addToList: 'Aggiungi alla spesa', cooked: "L'ho cucinata", edit: 'Modifica', delete: 'Elimina',
    confirmDelete: 'Eliminare questa ricetta?',
    addToListTitle: (n) => `Spesa per ${n} ${plural(n, 'persona', 'persone')}`,
    usePantry: 'Tieni conto della dispensa', inPantry: 'in dispensa', haveEnough: 'ce l\'hai già',
    addNItems: (n) => `Aggiungi ${n} ${plural(n, 'articolo', 'articoli')}`,
    cancel: 'Annulla', save: 'Salva',
    addedToList: (n) => `${n} ${plural(n, 'articolo aggiunto', 'articoli aggiunti')} alla spesa`,
    cookedConfirm: (n) => `Togliere dalla dispensa gli ingredienti usati per ${n} ${plural(n, 'persona', 'persone')}?`,
    pantryUpdated: (n) => `Dispensa aggiornata (${n} ${plural(n, 'ingrediente', 'ingredienti')})`,
    listEmpty: 'La lista della spesa è vuota.', addItemPh: 'Es. 1 l latte', inCart: 'Nel carrello',
    clearChecked: 'Svuota il carrello', share: 'Condividi lista', copied: 'Lista copiata', fromPantry: 'scorta bassa',
    pantryEmpty: 'Dispensa vuota. Aggiungi ciò che hai in casa.', addPantryPh: 'Es. 1 kg farina',
    pantryHint: 'Tocca un prodotto per impostare la soglia: quando scende sotto, finisce nella spesa da solo.',
    low: 'in esaurimento', name: 'Nome', quantity: 'Quantità', unit: 'Unità',
    minQty: 'Avvisami quando scende a', minHint: 'Lascia vuoto per non tracciarlo.',
    target: 'Ricompra fino a', targetHint: 'Facoltativo. Di default il doppio della soglia.',
    language: 'Lingua', sync: 'Sincronizzazione con GitHub', owner: 'Utente GitHub', repo: 'Repository dei dati', branch: 'Branch',
    token: 'Token di accesso', tokenHint: 'Resta salvato solo su questo dispositivo.',
    saveTest: 'Salva e verifica', syncNow: 'Sincronizza ora', lastSync: 'Ultima sincronizzazione', never: 'mai',
    connected: 'Collegato correttamente.',
    err_auth: 'Token non valido o scaduto.', err_forbidden: 'Accesso negato: controlla i permessi del token.',
    err_notfound: 'Repository non trovato: controlla utente, nome e permessi del token.', err_network: 'Nessuna connessione.',
    err_conflict: 'Conflitto ripetuto, riprova tra poco.', err_http: 'Errore di GitHub, riprova più tardi.',
    err_readonly: 'Il token può solo leggere: serve il permesso "Contents: Read and write".',
    err_missing: 'Compila utente, repository e token.', err_unknown: 'Errore sconosciuto.',
    st_synced: 'Sincronizzato', st_pending: 'Modifiche da sincronizzare', st_offline: 'Offline: le modifiche restano sul dispositivo',
    st_syncing: 'Sincronizzazione…', st_local: 'Solo su questo dispositivo', st_error: 'Errore di sincronizzazione',
    backup: 'Backup', exportData: 'Scarica una copia dei dati',
    setupHelp: 'Le istruzioni passo passo sono nel file README del repository dell\'app.',
    title: 'Titolo', url: 'Link', servingsLabel: 'Per quante persone', time: 'Tempo', image: 'Oppure link a un\'immagine',
    ingredientsHelp: 'Un ingrediente per riga, es. "200 g farina"', stepsHelp: 'Un passaggio per riga',
    newRecipe: 'Nuova ricetta', editRecipe: 'Modifica ricetta', notFound: 'Non trovato.', back: 'Indietro',
    importedN: (n) => `${n} ${plural(n, 'nuova ricetta importata', 'nuove ricette importate')}`,
    installHint: 'Suggerimento: aggiungi l\'app alla schermata Home per usarla come un\'app, anche offline.',
  },
  de: {
    photos: 'Fotos', addPhoto: 'Foto hinzufügen', cover: '★ Titelbild', makeCover: '☆ Titelbild', photoError: 'Dieses Bild konnte nicht gelesen werden.',
    appName: 'Rezepte',
    tabRecipes: 'Rezepte', tabList: 'Einkauf', tabPantry: 'Vorrat', tabSettings: 'Einstellungen',
    pasteLink: 'Rezept-Link einfügen…', import: 'Importieren',
    importNeedsGithub: 'Um Links automatisch zu importieren, verbinde GitHub in den Einstellungen. Der Link bleibt bis dahin in der Warteschlange.',
    search: 'Rezepte oder Zutaten suchen', manual: 'Neu', noRecipes: 'Noch keine Rezepte. Füge oben einen Link ein oder lege eins von Hand an.',
    importing: 'Wird importiert…', importQueuedOffline: 'In der Warteschlange: wird bei der nächsten Synchronisierung importiert.',
    importFailed: 'Diese Seite konnte nicht gelesen werden.', retry: 'Erneut versuchen', addManually: 'Von Hand anlegen', remove: 'Entfernen',
    people: (n) => `${n} ${plural(n, 'Person', 'Personen')}`,
    ingredients: 'Zutaten', steps: 'Zubereitung', notes: 'Notizen', source: 'Originalrezept',
    addToList: 'Auf die Einkaufsliste', cooked: 'Gekocht', edit: 'Bearbeiten', delete: 'Löschen',
    confirmDelete: 'Dieses Rezept löschen?',
    addToListTitle: (n) => `Einkauf für ${n} ${plural(n, 'Person', 'Personen')}`,
    usePantry: 'Vorrat berücksichtigen', inPantry: 'im Vorrat', haveEnough: 'schon vorhanden',
    addNItems: (n) => `${n} ${plural(n, 'Artikel', 'Artikel')} hinzufügen`,
    cancel: 'Abbrechen', save: 'Speichern',
    addedToList: (n) => `${n} ${plural(n, 'Artikel', 'Artikel')} zur Einkaufsliste hinzugefügt`,
    cookedConfirm: (n) => `Die verwendeten Zutaten für ${n} ${plural(n, 'Person', 'Personen')} vom Vorrat abziehen?`,
    pantryUpdated: (n) => `Vorrat aktualisiert (${n} ${plural(n, 'Zutat', 'Zutaten')})`,
    listEmpty: 'Die Einkaufsliste ist leer.', addItemPh: 'z. B. 1 l Milch', inCart: 'Im Wagen',
    clearChecked: 'Erledigte entfernen', share: 'Liste teilen', copied: 'Liste kopiert', fromPantry: 'Vorrat knapp',
    pantryEmpty: 'Der Vorrat ist leer. Trage ein, was du zu Hause hast.', addPantryPh: 'z. B. 1 kg Mehl',
    pantryHint: 'Tippe auf ein Produkt, um eine Mindestmenge festzulegen: Darunter landet es automatisch auf der Einkaufsliste.',
    low: 'wird knapp', name: 'Name', quantity: 'Menge', unit: 'Einheit',
    minQty: 'Erinnern, wenn es sinkt auf', minHint: 'Leer lassen, um es nicht zu verfolgen.',
    target: 'Auffüllen bis', targetHint: 'Optional. Standard: doppelte Mindestmenge.',
    language: 'Sprache', sync: 'Synchronisierung mit GitHub', owner: 'GitHub-Benutzer', repo: 'Daten-Repository', branch: 'Branch',
    token: 'Zugriffstoken', tokenHint: 'Wird nur auf diesem Gerät gespeichert.',
    saveTest: 'Speichern und prüfen', syncNow: 'Jetzt synchronisieren', lastSync: 'Letzte Synchronisierung', never: 'nie',
    connected: 'Verbindung erfolgreich.',
    err_auth: 'Token ungültig oder abgelaufen.', err_forbidden: 'Zugriff verweigert: Prüfe die Token-Berechtigungen.',
    err_notfound: 'Repository nicht gefunden: Prüfe Benutzer, Name und Token-Berechtigungen.', err_network: 'Keine Verbindung.',
    err_conflict: 'Wiederholter Konflikt, versuche es gleich noch einmal.', err_http: 'GitHub-Fehler, versuche es später erneut.',
    err_readonly: 'Der Token kann nur lesen: Nötig ist "Contents: Read and write".',
    err_missing: 'Bitte Benutzer, Repository und Token ausfüllen.', err_unknown: 'Unbekannter Fehler.',
    st_synced: 'Synchronisiert', st_pending: 'Änderungen noch nicht synchronisiert', st_offline: 'Offline: Änderungen bleiben auf dem Gerät',
    st_syncing: 'Synchronisiere…', st_local: 'Nur auf diesem Gerät', st_error: 'Synchronisierungsfehler',
    backup: 'Sicherung', exportData: 'Kopie der Daten herunterladen',
    setupHelp: 'Die Schritt-für-Schritt-Anleitung steht in der README des App-Repositorys.',
    title: 'Titel', url: 'Link', servingsLabel: 'Für wie viele Personen', time: 'Zeit', image: 'Oder Link zu einem Bild',
    ingredientsHelp: 'Eine Zutat pro Zeile, z. B. "200 g Mehl"', stepsHelp: 'Ein Schritt pro Zeile',
    newRecipe: 'Neues Rezept', editRecipe: 'Rezept bearbeiten', notFound: 'Nicht gefunden.', back: 'Zurück',
    importedN: (n) => `${n} ${plural(n, 'neues Rezept importiert', 'neue Rezepte importiert')}`,
    installHint: 'Tipp: Füge die App zum Home-Bildschirm hinzu, dann funktioniert sie wie eine App, auch offline.',
  },
  en: {
    photos: 'Photos', addPhoto: 'Add photo', cover: '★ Cover', makeCover: '☆ Cover', photoError: "Couldn't read this image.",
    appName: 'Recipes',
    tabRecipes: 'Recipes', tabList: 'Shopping', tabPantry: 'Pantry', tabSettings: 'Settings',
    pasteLink: 'Paste a recipe link…', import: 'Import',
    importNeedsGithub: 'Connect GitHub in Settings to import links automatically. Until then the link waits in the queue.',
    search: 'Search recipes or ingredients', manual: 'New', noRecipes: 'No recipes yet. Paste a link above or add one by hand.',
    importing: 'Importing…', importQueuedOffline: 'Queued: it will be imported at the next sync.',
    importFailed: "Couldn't read this page.", retry: 'Retry', addManually: 'Add by hand', remove: 'Remove',
    people: (n) => `${n} ${plural(n, 'person', 'people')}`,
    ingredients: 'Ingredients', steps: 'Method', notes: 'Notes', source: 'Original recipe',
    addToList: 'Add to shopping list', cooked: 'I cooked it', edit: 'Edit', delete: 'Delete',
    confirmDelete: 'Delete this recipe?',
    addToListTitle: (n) => `Shopping for ${n} ${plural(n, 'person', 'people')}`,
    usePantry: 'Take the pantry into account', inPantry: 'in pantry', haveEnough: 'you have it',
    addNItems: (n) => `Add ${n} ${plural(n, 'item', 'items')}`,
    cancel: 'Cancel', save: 'Save',
    addedToList: (n) => `${n} ${plural(n, 'item', 'items')} added to the shopping list`,
    cookedConfirm: (n) => `Subtract the ingredients used for ${n} ${plural(n, 'person', 'people')} from the pantry?`,
    pantryUpdated: (n) => `Pantry updated (${n} ${plural(n, 'ingredient', 'ingredients')})`,
    listEmpty: 'Your shopping list is empty.', addItemPh: 'e.g. 1 l milk', inCart: 'In the cart',
    clearChecked: 'Clear checked items', share: 'Share list', copied: 'List copied', fromPantry: 'running low',
    pantryEmpty: 'Your pantry is empty. Add what you have at home.', addPantryPh: 'e.g. 1 kg flour',
    pantryHint: 'Tap an item to set a threshold: when it drops below, it goes on the shopping list by itself.',
    low: 'running low', name: 'Name', quantity: 'Quantity', unit: 'Unit',
    minQty: 'Remind me when it drops to', minHint: 'Leave empty to not track it.',
    target: 'Restock up to', targetHint: 'Optional. Defaults to twice the threshold.',
    language: 'Language', sync: 'Sync with GitHub', owner: 'GitHub user', repo: 'Data repository', branch: 'Branch',
    token: 'Access token', tokenHint: 'Stored only on this device.',
    saveTest: 'Save and check', syncNow: 'Sync now', lastSync: 'Last sync', never: 'never',
    connected: 'Connected.',
    err_auth: 'Invalid or expired token.', err_forbidden: 'Access denied: check the token permissions.',
    err_notfound: 'Repository not found: check user, name and token permissions.', err_network: 'No connection.',
    err_conflict: 'Repeated conflict, try again shortly.', err_http: 'GitHub error, try again later.',
    err_readonly: 'The token is read-only: it needs "Contents: Read and write".',
    err_missing: 'Fill in user, repository and token.', err_unknown: 'Unknown error.',
    st_synced: 'Synced', st_pending: 'Changes waiting to sync', st_offline: 'Offline: changes stay on this device',
    st_syncing: 'Syncing…', st_local: 'Only on this device', st_error: 'Sync error',
    backup: 'Backup', exportData: 'Download a copy of your data',
    setupHelp: 'Step-by-step instructions are in the README of the app repository.',
    title: 'Title', url: 'Link', servingsLabel: 'Serves', time: 'Time', image: 'Or link to an image',
    ingredientsHelp: 'One ingredient per line, e.g. "200 g flour"', stepsHelp: 'One step per line',
    newRecipe: 'New recipe', editRecipe: 'Edit recipe', notFound: 'Not found.', back: 'Back',
    importedN: (n) => `${n} new ${plural(n, 'recipe', 'recipes')} imported`,
    installHint: 'Tip: add the app to your home screen to use it like an app, offline too.',
  },
};

const unitLabels = {
  it: { tsp: ['cucchiaino', 'cucchiaini'], tbsp: ['cucchiaio', 'cucchiai'], cup: ['tazza', 'tazze'], pinch: ['pizzico', 'pizzichi'],
    clove: ['spicchio', 'spicchi'], can: ['lattina', 'lattine'], pcs: ['pz', 'pz'], bunch: ['mazzo', 'mazzi'], slice: ['fetta', 'fette'],
    packet: ['conf.', 'conf.'], floz: ['fl oz', 'fl oz'] },
  de: { tsp: ['TL', 'TL'], tbsp: ['EL', 'EL'], cup: ['Tasse', 'Tassen'], pinch: ['Prise', 'Prisen'], clove: ['Zehe', 'Zehen'],
    can: ['Dose', 'Dosen'], pcs: ['Stk.', 'Stk.'], bunch: ['Bund', 'Bund'], slice: ['Scheibe', 'Scheiben'], packet: ['Pck.', 'Pck.'], floz: ['fl oz', 'fl oz'] },
  en: { tsp: ['tsp', 'tsp'], tbsp: ['tbsp', 'tbsp'], cup: ['cup', 'cups'], pinch: ['pinch', 'pinches'], clove: ['clove', 'cloves'],
    can: ['can', 'cans'], pcs: ['pc', 'pcs'], bunch: ['bunch', 'bunches'], slice: ['slice', 'slices'], packet: ['pack', 'packs'], floz: ['fl oz', 'fl oz'] },
};

let lang = 'it';

export function detectLang() {
  const prefs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const p of prefs) { const code = String(p).slice(0, 2).toLowerCase(); if (code in dict) return code; }
  return 'en';
}

export function setLang(code) { lang = code in dict ? code : detectLang(); document.documentElement.lang = lang; }
export function getLang() { return lang; }

export function t(key, ...args) {
  const v = dict[lang][key] ?? dict.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

export function unitLabel(unit, qty) {
  if (!unit) return '';
  const l = unitLabels[lang][unit];
  if (!l) return unit;
  return qty != null && qty > 1 ? l[1] : l[0];
}

export function unitOptionLabel(unit) {
  if (!unit) return '—';
  const l = unitLabels[lang][unit];
  return l ? l[0] : unit;
}

export const _dict = dict; // for tests
