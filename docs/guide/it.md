# Ricette: guida per l'utente

Tutto quello che serve per configurare Ricette e usarlo ogni giorno: le ricette, la lista della spesa e la dispensa.

<div class="desk-only" markdown="1">
**Stai leggendo la guida per il computer.** Le immagini mostrano l'app su uno schermo largo: i filtri a sinistra, la scheda in mezzo e un pannello a destra (vedi [Su un computer](#su-un-computer)). Dove la guida dice *tocca*, sul computer è un clic. In cima, **📱 Telefono** mostra la guida per il telefono (la scelta resta). Clicca un'immagine per ingrandirla.
</div>
<div class="phone-only" markdown="1">
*Questa è la guida per il telefono. In cima, **💻 Computer** mostra quella per il computer.*
</div>

## Cos'è Ricette

Ricette raccoglie le tue ricette e le tiene insieme a quello che hai in casa. Le importi da un link, da una foto o da un libro intero, le scrivi a mano, e le dividi tra **Preferite**, quelle che rifai, e **Da provare**. Accanto ci sono la **lista della spesa** e la **dispensa**: ogni ricetta sa cosa ti manca, e con un tocco lo mette in lista.

Funziona nel browser, su telefono o computer, e si installa come un'app normale. I dati restano tuoi: stanno sui tuoi dispositivi e in uno spazio privato su GitHub che vedi solo tu. Non c'è un account da noi e niente da pagare.

Cosa non è: non è un sito di ricette e non ti propone piatti che non hai scelto tu. Non pianifica i pasti della settimana: lo fa l'app Everyday, che usa le ricette di Ricette (vedi [Con Everyday](#con-everyday)).

## Prima configurazione

Servono dieci minuti e un account GitHub (gratuito). Tutto avviene in Impostazioni: tocca l'ingranaggio in alto a destra. Le Impostazioni sono un breve elenco, e ogni voce apre una pagina sua. La scheda in cima dice se i dati sono sincronizzati, con *Sincronizza ora*.

![Impostazioni: la sincronizzazione in cima e le pagine](guide/it/03-settings.png)

### 1. Installare l'app

Apri l'indirizzo dell'app in Chrome sul telefono, o in un browser qualsiasi sul computer. Su Android scegli *Installa app* dal menu del browser; sul computer clicca l'icona di installazione nella barra dell'indirizzo. L'app funziona anche senza connessione. Le nuove versioni arrivano da sole; in fondo alle Impostazioni vedi quale hai.

### 2. Collegare il tuo spazio su GitHub

È dove vengono salvati i dati, e il modo in cui telefono e computer restano allineati. Senza, Ricette funziona lo stesso, ma solo su questo dispositivo e senza importazioni.

1. Su GitHub crea un repository privato e vuoto, ad esempio `ricette-data`. Un repository è una cartella su GitHub.
2. Crea un token di accesso (GitHub → Settings → Developer settings → Fine-grained tokens) che possa leggere e scrivere i *Contents* di quel repository. Un token è come una password fatta per le app.
3. In Impostazioni → *Collegamento GitHub* scrivi il tuo *Utente GitHub*, il *Repository* e il *Token di accesso*, poi tocca *Salva e verifica*.

![Utente, repository e token](guide/it/01-sync-form.png)

Quando funziona, la pagina dice **Collegato** e l'etichetta in alto diventa verde. Il token resta solo su questo dispositivo: ripeti il passo su ogni telefono o computer che usi.

![Collegato: il repository e l'ultima sincronizzazione](guide/it/02-sync-connected.png)

### 3. Facoltativo: gli avvisi di scadenza

In Impostazioni → *Dispensa e promemoria* tocca *Attiva le notifiche*. Ogni mattina ricevi un avviso se qualcosa in dispensa sta per scadere, anche ad app chiusa. Qui scegli anche quanti giorni prima avvisarti.

![Dispensa e promemoria](guide/it/04-settings-pantry.png)

### 4. Facoltativo: persone e lingua

In Impostazioni → *Ricette* scegli per quante persone cucini di solito: quantità, lista della spesa e *Con la dispensa* si adeguano. In *Lingua* scegli italiano, inglese o tedesco. In *Aspetto* scegli il tema (automatico come il telefono, chiaro o scuro) e il colore dell'app: melanzana, petrolio, terracotta o fiordaliso. Lingua, tema e colore valgono solo sul dispositivo su cui li scegli.

### 5. Una seconda persona

Ognuno ha il suo repository e il suo token. Sul suo telefono apri lo stesso indirizzo e collega il suo repository. Se il dispositivo conteneva i dati di qualcun altro, l'app chiede se partire vuoto: scegli quello. *Svuota questo dispositivo*, in *Collegamento GitHub*, fa lo stesso quando vuoi.

## Le tre schede

| Scheda | A cosa serve |
|---|---|
| Ricette | La tua raccolta, divisa in Preferite, Da provare e Tutte. Si cerca, si filtra e si aggiungono ricette. |
| Spesa | La lista della spesa, divisa per reparti, ricette o negozi, con il carrello. |
| Dispensa | Quello che hai in casa, in credenza, frigo e freezer: quantità, scadenze e scorte che stanno finendo. |

Le tre schede funzionano allo stesso modo: in alto la ricerca con **Filtri** accanto, in basso a destra il **+** arancione per aggiungere. L'ingranaggio in alto apre le Impostazioni. Il pallino accanto dice se i dati sono sincronizzati: verde vuol dire tutto a posto; toccalo per sincronizzare subito.

## Ricette

![Ricette: le cartelle in cima, poi tutte le ricette](guide/it/10-recipes.png)

### Preferite, Da provare, Tutte

Ogni ricetta ha uno stato. **Preferite** sono quelle che rifai. **Da provare** sono quelle importate e non ancora giudicate: ogni importazione arriva qui. **Tutte** mostra anche le cartelle, per esempio *Cene veloci* o *Dolci*.

![Preferite: le ricette che rifai](guide/it/11-favourites.png)

Per cambiare stato tocca la ☆ sulla pagina della ricetta. Le ricette archiviate restano, ma nascoste.

### Trovare e filtrare

Scrivi nella ricerca un nome o un ingrediente: cerca in tutta la raccolta. **Filtri** apre un pannello proprio lì sotto:

- in alto l'ordine (*Aggiunte di recente*, *Più veloci*, *Più cucinate*… anche *Al contrario*) ed *Elenco* o *Griglia*;
- gli interruttori rapidi: *Con la dispensa*, **≤ 15 / 30 / 60 min** e i tuoi tag fissati;
- le sezioni *Portata*, *Alimentazione*, *Origine*, *Altri tag* e *Lavoro, calorie, fonte*, che si aprono una alla volta.

![Il pannello Filtri, con Portata aperta](guide/it/12-filters.png)

Chiuso il pannello, sotto la ricerca restano i filtri attivi: tocca ✕ per toglierne uno.

### Con la dispensa

L'interruttore **Con la dispensa** mette in cima le ricette per cui hai quasi tutto in casa e dice cosa manca. *Aggiungi i mancanti alla spesa* lo mette in lista. Sale, pepe e olio si possono dare per scontati.

![Con la dispensa: prima quello che puoi cucinare](guide/it/13-with-pantry.png)

### La pagina della ricetta

Accanto agli ingredienti, − e + cambiano le persone. Ogni ingrediente dice se ce l'hai: *in casa* o *manca*. In basso:

- **alla spesa** mette in lista solo quello che manca;
- **L'ho cucinata** toglie dalla dispensa quello che hai usato;
- **⋯** per modificare, spostare in una cartella, condividere o eliminare.

![La pagina di una ricetta: cosa hai in casa e cosa manca](guide/it/14-recipe.png)

Dopo *L'ho cucinata* su una ricetta da provare, l'app chiede **Com'era?**: *Da rifare: preferita*, *Buona, provata* o *Non fa per noi: archivia*.

![Com'era? dopo la prima volta](guide/it/15-how-was-it.png)

## Aggiungere ricette

Tocca **+** su Ricette. Il foglio ha una scheda per ogni modo, e in fondo *Salva in* per scegliere la cartella. Tutto quello che importi arriva in *Da provare* in un minuto o due.

### Da un link

Incolla l'indirizzo della ricetta e tocca *Importa*. Puoi anche condividere un link da un'altra app direttamente a Ricette.

![Link: incolla l'indirizzo](guide/it/20-add-link.png)

### Da una foto

Per una ricetta da un libro o da un appunto. Tocca *Scatta o scegli le foto*: l'app ti guida in tre passi.

1. **Ingredienti:** fotografa la lista degli ingredienti; se va su più pagine, una foto per pagina.
2. **Preparazione:** i passaggi, nell'ordine in cui li leggi. Se sono sulla stessa pagina degli ingredienti, spunta *Ingredienti e preparazione sono sulla stessa pagina* e questo passo si salta.
3. **Il piatto:** facoltativo. Diventa la copertina e non viene letto; con *Salta* ne cerco una io.

![Da una foto: prima gli ingredienti](guide/it/21-add-photo.png)

Alla fine *Tutto a posto?* riassume le foto: *Rifai* cambia un gruppo, *Importa la ricetta* la manda. Se hai già il testo (Live Text, Google Lens), incollalo al primo passo in *Oppure incolla il testo*. Il testo viene letto sul tuo GitHub, non da un servizio esterno.

### Un libro intero

*Libro* importa un intero libro di cucina, PDF o EPUB. Ogni ricetta diventa una ricetta a parte, con la pagina del libro e, se c'è, la sua foto. Un libro di qualche centinaio di pagine può richiedere un'ora.

![Libro: un PDF o un EPUB intero](guide/it/22-add-book.png)

### Da zero

*Da zero* apre il modulo vuoto. In *Va in* scegli se la ricetta va tra le *Preferite* o *Da provare*.

![Da zero: il modulo, con Va in](guide/it/23-new-recipe.png)

### Modificare una ricetta

Dalla pagina della ricetta tocca ⋯ → *Modifica*. *Salva* resta in alto; se esci con modifiche non salvate, l'app chiede prima.

| Parte | Cosa imposti |
|---|---|
| Foto | La copertina e le altre foto; *Cerca online* trova una foto del piatto |
| Titolo, persone | Il nome e per quante persone sono le dosi |
| Tempo, Cartella, Fonte | Il tempo totale e di lavoro, la cartella, il link o il libro con la pagina |
| Ingredienti | Una riga per ingrediente: quantità, nome, dettaglio. *+ Gruppo* per «Per la salsa» |
| Preparazione | Un passaggio per scheda; trascina ⠿ per riordinare |
| Tag | Quelli verdi sono automatici; aggiungi i tuoi con *+ Tag* |

![Gli ingredienti come righe](guide/it/24-edit.png)

Tocca un ingrediente per cambiarlo. Sotto il nome c'è il cibo riconosciuto; se è sbagliato o manca, tocca **Correggi**. *Scrivi come testo* mostra tutta la lista come testo, comodo per incollare.

![Un ingrediente: quantità, gruppo e Correggi](guide/it/25-ingredient.png)

### Ingredienti e cibi

Ricette riconosce i cibi in italiano, inglese e tedesco: così le uova della ricetta sono le uova in dispensa, e ogni cosa va nel reparto giusto. In Impostazioni → *Ingredienti e cibi* trovi i nomi che non ha riconosciuto: collegali a un cibo o creane uno tuo. Vale per tutte le ricette, la spesa e la dispensa.

![Ingredienti e cibi: i nomi da sistemare](guide/it/26-foods.png)

## La spesa

![La spesa, divisa per reparti](guide/it/30-list.png)

### Aggiungere

Tocca **+** e scrivi, per esempio `2 l latte, uova, 1,5 kg farina`, poi Invio. Quantità e reparto si capiscono da soli, e il campo resta aperto per la prossima. Sotto compare quello che hai appena aggiunto: tocca un nome per cambiarlo.

![Il + su Spesa: più cose insieme](guide/it/31-list-add.png)

Dalle ricette, *alla spesa* aggiunge gli ingredienti che mancano, già con la quantità. Quello che in dispensa sta finendo entra in lista da solo.

### Viste e filtri

**Filtri** apre la scelta della vista: *Raggruppa per* reparti, ricette o negozi, oppure *In fila*: *Mio ordine*, *A–Z*, recenti. Sotto, i filtri rapidi per negozio. Reparti, ricette e il tuo ordine valgono su tutti i dispositivi, anche in Everyday.

![Scegliere la vista](guide/it/32-list-views.png)

### La scheda di un prodotto

Tocca il nome di una voce: si apre la scheda del prodotto, la stessa che apri dal carrello e dalla dispensa. In cima, tre schede dicono dove si trova: *In lista*, *Nel carrello* e *In casa*, con quantità e posto.

- Sotto c'è la parte di quel posto: quanto comprare, quanto hai preso, oppure quanto ce n'è in casa.
- In fondo, *Il prodotto, ovunque*: reparto, negozi in *Si trova da* e note, uguali dappertutto. Nessun negozio vuol dire «ovunque».
- Se il prodotto non è in lista, *Aggiungi alla lista* ce lo mette; se non è in casa, *Mettilo in dispensa*.
- Il pulsante rosso dice cosa toglie: *Togli dalla lista*, *Togli dal carrello* o *Togli dalla dispensa* (con *Annulla* subito dopo).

![La scheda di un prodotto: dove si trova, quanto, negozi](guide/it/33-list-item.png)

### Il carrello e Metti in dispensa

Spunta quello che metti nel carrello: scende in **Nel carrello**. A casa tocca **Metti in dispensa**: controlli quantità, scadenze e dove va ogni cosa (credenza, frigo o freezer), poi tutto entra in dispensa ed esce dalla lista. Un prodotto nuovo si porta dietro i negozi della voce.

![Il carrello](guide/it/34-cart.png)

![Metti in dispensa: quantità e scadenze](guide/it/35-put-away.png)

### Il prossimo giro

Se usi Everyday e pianifichi un giro di spesa, la lista mostra **Prossimo giro**: quando e in quali negozi. Ogni voce dice in quale giro la compri; *Mostra solo questo* lascia solo quelle.

![Il prossimo giro, pianificato in Everyday](guide/it/36-trips.png)

## La dispensa

![La dispensa: in scadenza in cima, poi per reparto](guide/it/40-pantry.png)

### Credenza, frigo e freezer

In cima scegli dove guardare: *Tutto*, *Credenza*, *Frigo* o *Freezer*, ognuno con quanti prodotti contiene. Ogni prodotto ha il suo posto. Finché non lo scegli tu, l'app lo indovina dal reparto: latticini, carne e pesce in frigo, i surgelati in freezer, il resto in credenza. Per spostarlo apri la sua scheda e tocca il posto in *Dove*.

![Solo il frigo](guide/it/45-pantry-fridge.png)

### Aggiungere e scansionare

Tocca **+** e scrivi, per esempio `6 uova scade 20/11, 1 kg farina`: «scade 20/11» mette la scadenza. *Va in* sceglie il posto: quello che stai guardando, oppure *Da solo* e ogni cosa va al suo. Con *Scansiona* inquadri il codice a barre e il prodotto si riconosce da solo.

![Il + su Dispensa](guide/it/41-pantry-add.png)

### Scadenze e soglie

Tocca un prodotto per la sua scheda, la stessa della spesa (vedi [La scheda di un prodotto](#la-scheda-di-un-prodotto)). *Avvisami quando scende a* è la soglia: sotto, il prodotto entra da solo nella lista della spesa. *Ricompra fino a* dice quanto comprarne. *Scadenza* e *Avvisami giorni prima* decidono l'avviso del mattino. I negozi in *Si trova da* tornano con il prodotto quando finisce e rientra in lista.

![Un prodotto: quantità, soglia, scadenza](guide/it/42-pantry-product.png)

### Scorte: C'è, Poca, Finita

Per sale, olio, spezie e simili non serve contare i grammi. In *Come la conti* scegli **C'è / Poca / Finita**: *Poca* e *Finita* lo mettono in lista, e quando lo rimetti in dispensa torna *C'è*. Cucinare non lo scala.

![Una scorta: C'è, Poca, Finita](guide/it/43-staple.png)

### Filtri

**Filtri** sceglie la vista (reparti, scadenza, scorte, A–Z) e i filtri *In scadenza*, *Scaduti*, *In esaurimento* e *Finiti*, anche insieme. *Ricette con quello che hai* apre Ricette con *Con la dispensa* acceso.

![Solo quello in scadenza](guide/it/44-pantry-filters.png)

### Scontrini

In ⋯ → *Leggi uno scontrino* fotografi lo scontrino dritto e ben illuminato. Viene letto sul tuo GitHub e poi cancellato; quando è pronto compare in Dispensa e lo metti via come il carrello.

## Con Everyday

Everyday è l'app per pianificare le giornate. Le due app condividono la lista della spesa, i negozi e la dispensa, se in Everyday scrivi il repository di Ricette.

- **La lista della spesa è una sola.** Quello che aggiungi in Everyday compare qui, e viceversa.
- **I pasti.** In Everyday scegli una ricetta per un pasto, partendo dalle Preferite. Quando il pasto è fatto, la ricetta conta una volta in più (*cucinata 4 volte*).
- **Mettere via.** Anche in Everyday la spesa messa via entra in dispensa, con i negozi della voce. Il posto in casa lo scegli in Ricette; fino ad allora vale quello indovinato.
- **I giri di spesa.** Everyday decide quando fare la spesa; Ricette lo mostra in lista come [Prossimo giro](#il-prossimo-giro).

Chi decide cosa: Ricette decide le ricette, la lista e la dispensa; Everyday decide quando cucinare e quando fare la spesa.

## Una settimana tipo

**Domenica sera.** Apri *Da provare* e scegli due ricette nuove: la zuppa di lenticchie e il pollo al limone. Su ognuna tocca *alla spesa*: in lista entrano solo le cose che mancano. Su Everyday la zuppa va a martedì.

**Lunedì, al mercato.** Apri Spesa con la vista per negozi: al Mercato di Sant'Ambrogio prendi finocchi e limoni, spunti mentre li metti nella borsa. A casa tocchi *Metti in dispensa* e scrivi la scadenza della feta.

**Martedì sera.** Zuppa di lenticchie. Alla fine tocchi *L'ho cucinata*: la dispensa scala le lenticchie, e a *Com'era?* rispondi *Da rifare: preferita*.

**Giovedì, poco tempo.** Su Ricette accendi *Con la dispensa* e **≤ 30 min**: la pasta e ceci si fa con quello che hai. L'olio sta finendo: tocchi *Poca*, ed è già in lista per sabato.

## Su un computer

Su uno schermo largo Ricette usa tre colonne. A sinistra i filtri, sempre aperti. In mezzo la scheda. A destra un pannello che cambia con la scheda:

- **Ricette:** *Aggiungi una ricetta* e l'anteprima della ricetta che hai cliccato, con cosa manca. *Apri la ricetta* la apre intera.
- **Spesa:** il campo per aggiungere e il carrello, con *Metti in dispensa*. La lista si dispone su più colonne.
- **Dispensa:** il campo per aggiungere e scansionare.

![Ricette su un computer: filtri, ricette, anteprima](guide/it/60-wide-recipes.png)

![Spesa su un computer](guide/it/61-wide-list.png)

![Dispensa su un computer](guide/it/62-wide-pantry.png)

## Consigli e problemi comuni

**La sincronizzazione non parte.** Controlla in Impostazioni → *Collegamento GitHub* che il token possa scrivere i *Contents* del repository e non sia scaduto. *Modifica collegamento* permette di incollarne uno nuovo.

**Un'importazione resta in coda.** Le importazioni girano sul tuo GitHub: servono il collegamento e un minuto o due. Se una pagina non si lascia leggere, l'app lo dice in cima a *Da provare*: prova con una foto della ricetta.

**Un ingrediente finisce nel reparto sbagliato.** Tocca la voce, poi *Correggi*, e scegli il cibo giusto: vale da lì in poi, ovunque.

**Ho eliminato qualcosa per sbaglio.** Tocca *Annulla* nel messaggio in basso, subito dopo.

**Voglio una copia dei miei dati.** Impostazioni → *Backup* → *Scarica una copia dei dati*. Il tuo repository su GitHub contiene comunque gli stessi dati.

**Il telefono non avvisa delle scadenze.** Le notifiche vanno attivate su ogni dispositivo, in *Dispensa e promemoria*. Su iPhone funzionano solo dall'app installata sulla schermata Home.
