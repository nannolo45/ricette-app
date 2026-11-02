# Ricette: Anleitung

Alles, was du brauchst, um Ricette einzurichten und jeden Tag zu nutzen: deine Rezepte, die Einkaufsliste und den Vorrat.

<div class="desk-only" markdown="1">
**Du liest die Anleitung für den Computer.** Die Bilder zeigen die App auf einem breiten Bildschirm: links die Filter, in der Mitte der Reiter, rechts ein Bereich (siehe [Am Computer](#am-computer)). Wo die Anleitung *tippe* sagt, ist es am Computer ein Klick. Oben zeigt **📱 Handy** die Anleitung fürs Handy (die Wahl bleibt). Klick auf ein Bild, um es zu vergrößern.
</div>
<div class="phone-only" markdown="1">
*Das ist die Anleitung fürs Handy. Oben zeigt **💻 Computer** die für den Computer.*
</div>

## Was Ricette ist

Ricette sammelt deine Rezepte und verbindet sie mit dem, was du zu Hause hast. Du holst sie aus einem Link, einem Foto oder einem ganzen Kochbuch, oder schreibst sie selbst, und teilst sie in **Favoriten**, die du immer wieder kochst, und **Ausprobieren**. Daneben liegen die **Einkaufsliste** und der **Vorrat**: Jedes Rezept weiß, was dir fehlt, und ein Tippen setzt es auf die Liste.

Die App läuft im Browser, auf dem Handy oder am Computer, und lässt sich wie eine normale App installieren. Deine Daten bleiben deine: Sie liegen auf deinen Geräten und in einem privaten Bereich auf GitHub, den nur du siehst. Es gibt kein Konto bei uns und nichts zu bezahlen.

Was sie nicht ist: keine Rezept-Website, und sie schlägt dir keine Gerichte vor, die du nicht selbst gewählt hast. Die Mahlzeiten der Woche plant sie auch nicht: Das macht die App Everyday, mit deinen Rezepten aus Ricette (siehe [Mit Everyday](#mit-everyday)).

## Einrichtung

Du brauchst zehn Minuten und ein (kostenloses) GitHub-Konto. Alles passiert in den Einstellungen: Tippe oben rechts auf das Zahnrad. Die Einstellungen sind eine kurze Liste, jeder Eintrag öffnet eine eigene Seite; wo eine Seite mehrere Dinge betrifft (wie *Rezepte*), ist sie selbst eine Liste. Die Karte oben zeigt, ob deine Daten synchron sind, mit *Jetzt synchronisieren*.

![Einstellungen: oben die Synchronisierung, darunter die Seiten](guide/de/03-settings.webp)

### 1. Die App installieren

Öffne die Adresse der App in Chrome auf dem Handy oder in einem beliebigen Browser am Computer. Unter Android wählst du im Browsermenü *App installieren*; am Computer klickst du auf das Installationssymbol in der Adressleiste. Die App funktioniert auch offline. Neue Versionen kommen von selbst; unten in den Einstellungen siehst du, welche du hast.

### 2. Deinen Bereich auf GitHub verbinden

Hier werden deine Daten gespeichert, und so bleiben Handy und Computer auf dem gleichen Stand. Ohne geht Ricette auch, aber nur auf diesem Gerät und ohne Importe.

1. Lege auf GitHub ein leeres, privates Repository an, zum Beispiel `ricette-data`. Ein Repository ist einfach ein Ordner auf GitHub.
2. Erstelle ein Zugriffstoken (GitHub → Settings → Developer settings → Fine-grained tokens), das die *Contents* dieses Repositorys lesen und schreiben darf. Ein Token ist wie ein Passwort für Apps.
3. Gib unter Einstellungen → *GitHub-Verbindung* deinen *GitHub-Benutzer*, das *Repository* und das *Zugriffstoken* ein und tippe auf *Speichern und prüfen*.

![Benutzer, Repository und Token](guide/de/01-sync-form.webp)

Wenn es klappt, steht auf der Seite **Verbunden mit**, und die Anzeige oben wird grün. Das Token bleibt nur auf diesem Gerät: Wiederhole den Schritt auf jedem Handy und Computer, den du nutzt.

![Verbunden: das Repository und die letzte Synchronisierung](guide/de/02-sync-connected.webp)

### 3. Optional: Erinnerungen ans Ablaufdatum

Tippe unter Einstellungen → *Vorrat und Erinnerungen* → *Erinnerungen ans Ablaufdatum* auf *Mitteilungen aktivieren*. Jeden Morgen bekommst du einen Hinweis, wenn im Vorrat etwas bald abläuft, auch bei geschlossener App. Hier stellst du auch ein, wie viele Tage vorher.

![Vorrat und Erinnerungen](guide/de/04-settings-pantry.webp)

### 4. Optional: Personen, Sprache und Aussehen

Unter Einstellungen → *Rezepte* → *Personen* wählst du, für wie viele Personen du meistens kochst: Mengen, Einkaufsliste und *Mit dem Vorrat* richten sich danach. Unter *Sprache und Aussehen* wählst du Deutsch, Englisch oder Italienisch, das Farbschema (*Automatisch* wie das Handy, *Hell* oder *Dunkel*) und die Farbe der App: Aubergine, Petrol, Terrakotta oder Kornblume. Sprache, Farbschema und Farbe gelten nur auf dem Gerät, auf dem du sie wählst.

### 5. Eine zweite Person

Jede Person hat ihr eigenes Repository und Token. Öffne auf ihrem Handy dieselbe Adresse und verbinde ihr Repository. Waren auf dem Gerät die Daten von jemand anderem, fragt die App, ob sie leer starten soll: Wähle das. *Dieses Gerät leeren* unter *GitHub-Verbindung* macht das jederzeit.

## Die drei Reiter

| Reiter | Wofür |
|---|---|
| Rezepte | Deine Sammlung, aufgeteilt in Favoriten, Ausprobieren und Alle. Hier suchst, filterst und ergänzt du Rezepte. |
| Einkauf | Die Einkaufsliste, nach Abteilung, Rezept oder Laden, mit dem Wagen. |
| Vorrat | Was du zu Hause hast, in Schrank, Kühlschrank und Gefrierfach: Mengen, Ablaufdaten und Grundvorrat, der zur Neige geht. |

Alle drei funktionieren gleich: oben die Suche mit **Filter** daneben, unten rechts das farbige **+** zum Hinzufügen. Das Zahnrad oben öffnet die Einstellungen. Der Punkt daneben zeigt, ob deine Daten synchron sind: grün heißt alles in Ordnung; tippe darauf, um sofort zu synchronisieren.

## Rezepte

![Rezepte: oben die Ordner, dann alle Rezepte](guide/de/10-recipes.webp)

### Favoriten, Ausprobieren, Alle

Jedes Rezept hat einen Status. **Favoriten** sind die, die du immer wieder kochst. **Ausprobieren** sind importierte Rezepte, die du noch nicht bewertet hast: Jeder Import landet hier. **Alle** zeigt auch deine Ordner, etwa *Schnelle Abendessen* oder *Kuchen*.

![Favoriten: die Rezepte, die du wieder kochst](guide/de/11-favourites.webp)

Um den Status zu ändern, tippe auf der Rezeptseite auf den ☆. Archivierte Rezepte bleiben, aber versteckt.

### Finden und filtern

Gib in die Suche einen Namen oder eine Zutat ein: Sie sucht in deiner ganzen Sammlung. **Filter** öffnet direkt darunter ein Feld:

- oben die Reihenfolge (*Zuletzt hinzugefügt*, *Schnellste*, *Am häufigsten gekocht*… auch *Umgekehrt*) und *Liste* oder *Raster*;
- die Schnellschalter: *Mit dem Vorrat*, **≤ 15 / 30 / 60 min** und deine angehefteten Tags;
- die Abschnitte *Gang*, *Ernährung*, *Herkunft*, *Weitere Tags* und *Arbeit, Kalorien, Quelle*, die sich einzeln öffnen.

![Das Filter-Feld, mit offenem Gang](guide/de/12-filters.webp)

Ist das Feld zu, bleiben die aktiven Filter unter der Suche: Tippe auf ✕, um einen zu entfernen.

### Mit dem Vorrat

Der Schalter **Mit dem Vorrat** stellt die Rezepte nach oben, für die fast alles da ist, und zeigt, was fehlt. *Fehlendes auf die Einkaufsliste* setzt es auf die Liste. Salz, Pfeffer und Öl kann man als vorhanden annehmen.

![Mit dem Vorrat: zuerst, was du kochen kannst](guide/de/13-with-pantry.webp)

### Die Rezeptseite

Neben den Zutaten ändern − und + die Personenzahl. Jede Zutat zeigt, ob sie *da* ist oder *fehlt*. Unten:

- **auf die Liste** setzt nur das Fehlende auf die Einkaufsliste;
- **Gekocht** nimmt das Verbrauchte aus dem Vorrat;
- **⋯** zum Bearbeiten, Verschieben in einen Ordner, Teilen oder Löschen.

![Eine Rezeptseite: was da ist und was fehlt](guide/de/14-recipe.webp)

Nach *Gekocht* bei einem Rezept zum Ausprobieren fragt die App **Wie war es?**: *Wieder kochen: Favorit*, *Gut, ausprobiert* oder *Nichts für uns: archivieren*.

![Wie war es? nach dem ersten Mal](guide/de/15-how-was-it.webp)

## Rezepte hinzufügen

Tippe bei Rezepte auf **+**. Das Blatt hat einen Reiter für jeden Weg und unten *Speichern in* für den Ordner. Alles, was du importierst, landet nach ein, zwei Minuten unter *Ausprobieren*.

### Aus einem Link

Füge die Adresse des Rezepts ein und tippe auf *Importieren*. Du kannst einen Link auch aus einer anderen App direkt mit Ricette teilen.

![Link: die Adresse einfügen](guide/de/20-add-link.webp)

### Aus einem Foto

Für ein Rezept aus einem Buch oder einer Notiz. Tippe auf *Fotos aufnehmen oder wählen*: Die App führt dich in drei Schritten.

1. **Zutaten:** Fotografiere die Zutatenliste; geht sie über mehrere Seiten, ein Foto pro Seite.
2. **Zubereitung:** die Schritte, in der Reihenfolge, in der du sie liest. Stehen sie auf derselben Seite wie die Zutaten, hake *Zutaten und Zubereitung stehen auf derselben Seite* an, und dieser Schritt entfällt.
3. **Das Gericht:** optional. Es wird das Titelbild und nicht gelesen; mit *Überspringen* suche ich eins.

![Aus einem Foto: zuerst die Zutaten](guide/de/21-add-photo.webp)

Am Ende fasst *Alles in Ordnung?* die Fotos zusammen: *Neu* ändert eine Gruppe, *Rezept importieren* schickt es ab. Hast du den Text schon (Live Text, Google Lens), füge ihn im ersten Schritt unter *Oder Text einfügen* ein. Der Text wird auf deinem GitHub gelesen, nicht von einem fremden Dienst.

### Ein ganzes Kochbuch

*Buch* importiert ein ganzes Kochbuch, als PDF oder EPUB. Jedes Rezept darin wird ein eigenes Rezept, mit der Seitenzahl und, wenn vorhanden, seinem Bild. Ein Buch mit einigen hundert Seiten kann eine Stunde dauern.

![Buch: ein ganzes PDF oder EPUB](guide/de/22-add-book.webp)

### Neu

*Neu* öffnet das leere Formular. Unter *Kommt zu* wählst du, ob das Rezept zu den *Favoriten* oder zu *Ausprobieren* kommt.

![Neu: das Formular, mit Kommt zu](guide/de/23-new-recipe.webp)

### Ein Rezept bearbeiten

Tippe auf der Rezeptseite auf ⋯ → *Bearbeiten*. *Speichern* bleibt oben; verlässt du die Seite mit ungespeicherten Änderungen, fragt die App vorher.

| Teil | Was du einstellst |
|---|---|
| Fotos | Das Titelbild und weitere Fotos; *Online suchen* findet ein Bild des Gerichts |
| Titel, Personen | Der Name und für wie viele Personen die Mengen sind |
| Zeit, Ordner, Quelle | Gesamt- und Arbeitszeit, der Ordner, der Link oder das Buch mit Seite |
| Zutaten | Eine Zeile pro Zutat: Menge, Name, Detail. *+ Gruppe* für „Für die Soße“ |
| Zubereitung | Ein Schritt pro Karte; zum Umsortieren ⠿ ziehen |
| Tags | Die grünen sind automatisch; eigene fügst du mit *+ Tag* hinzu |

![Die Zutaten als Zeilen](guide/de/24-edit.webp)

Tippe auf eine Zutat, um sie zu ändern. Unter dem Namen steht das erkannte Lebensmittel; ist es falsch oder fehlt es, tippe auf **Korrigieren**. *Als Text schreiben* zeigt die ganze Liste als Text, praktisch zum Einfügen.

![Eine Zutat: Menge, Gruppe und Korrigieren](guide/de/25-ingredient.webp)

### Zutaten und Lebensmittel

Ricette kennt Lebensmittel auf Deutsch, Englisch und Italienisch: So sind die Eier im Rezept die Eier im Vorrat, und alles landet in der richtigen Abteilung. Unter Einstellungen → *Zutaten und Lebensmittel* stehen die Namen, die sie nicht erkannt hat: Verknüpfe sie mit einem Lebensmittel oder lege ein eigenes an. Das gilt für alle Rezepte, die Einkaufsliste und den Vorrat.

![Zutaten und Lebensmittel: die Namen zum Klären](guide/de/26-foods.webp)

## Der Einkauf

![Die Einkaufsliste, nach Abteilungen](guide/de/30-list.webp)

### Hinzufügen

Tippe auf **+** und schreib zum Beispiel `2 l Milch, Eier, 1,5 kg Mehl`, dann Enter. Menge und Abteilung werden erkannt, und das Feld bleibt für das Nächste offen. Darunter steht, was du gerade hinzugefügt hast: Tippe auf einen Namen, um ihn zu ändern.

![Das + bei Einkauf: mehreres auf einmal](guide/de/31-list-add.webp)

Aus einem Rezept setzt *zur Einkaufsliste* die fehlenden Zutaten mit Menge auf die Liste. Was im Vorrat zur Neige geht, kommt von selbst auf die Liste.

### Ansichten und Filter

**Filter** öffnet die Wahl der Ansicht: *Gruppieren nach* Abteilung, Rezept oder Laden, oder *Als Liste*: *Meine Reihenfolge*, *A–Z*, neueste. Darunter die Schnellfilter nach Laden. Abteilungen, Rezepte und deine Reihenfolge gelten auf allen Geräten, auch in Everyday.

![Die Ansicht wählen](guide/de/32-list-views.webp)

### Das Blatt eines Produkts

Tippe auf den Namen eines Eintrags: Das Blatt des Produkts öffnet sich, dasselbe wie im Wagen und im Vorrat. Oben zeigen drei Reiter, wo es ist: *Auf der Liste*, *Im Wagen* und *Zu Hause*, mit Menge und Ort.

- Darunter der Teil für diesen Ort: wie viel kaufen, wie viel genommen, oder wie viel zu Hause da ist.
- Unten *Das Produkt, überall*: Abteilung, Läden unter *Gibt es bei* und Notiz, überall gleich. Kein Laden heißt „überall“.
- Steht das Produkt nicht auf der Liste, setzt *Auf die Liste* es drauf; ist es nicht zu Hause, *In den Vorrat*.
- Der rote Knopf sagt, was er entfernt: *Von der Liste nehmen*, *Aus dem Wagen nehmen* oder *Aus dem Vorrat nehmen* (mit *Rückgängig* direkt danach).

![Das Blatt eines Produkts: wo es ist, wie viel, Läden](guide/de/33-list-item.webp)

### Der Wagen und In den Vorrat

Hake ab, was in den Wagen kommt: Es rutscht nach unten in **Im Wagen**. Zu Hause tippst du auf **In den Vorrat**: Mengen, Ablaufdaten und den Ort prüfen (Schrank, Kühlschrank oder Gefrierfach), dann kommt alles in den Vorrat und von der Liste. Ein neues Produkt nimmt die Läden des Eintrags mit.

![Der Wagen](guide/de/34-cart.webp)

![In den Vorrat: Mengen und Ablaufdaten](guide/de/35-put-away.webp)

### Der nächste Einkauf

Nutzt du Everyday und planst dort einen Einkauf, zeigt die Liste **Nächster Einkauf**: wann und in welchen Läden. Jeder Eintrag zeigt, bei welchem Einkauf er dran ist; *Nur diesen zeigen* lässt nur diese stehen.

![Der nächste Einkauf, geplant in Everyday](guide/de/36-trips.webp)

## Der Vorrat

![Der Vorrat: oben was bald abläuft, dann nach Abteilung](guide/de/40-pantry.webp)

### Schrank, Kühlschrank und Gefrierfach

Oben wählst du, wo du schaust: *Alles*, *Schrank*, *Kühlschrank*, *Gefrierfach* oder *Haushalt*, jeweils mit der Zahl der Produkte. Jedes Produkt hat seinen Ort. Bis du ihn wählst, schätzt die App ihn nach der Abteilung: Milchprodukte, Fleisch und Fisch in den Kühlschrank, Tiefkühlware ins Gefrierfach, Putzmittel, Papier und Pflegeprodukte in den *Haushalt*, der Rest in den Schrank. Zum Umräumen öffnest du das Blatt und tippst den Ort unter *Wo* an.

![Nur der Kühlschrank](guide/de/45-pantry-fridge.webp)

### Hinzufügen und scannen

Tippe auf **+** und schreib zum Beispiel `6 Eier bis 20.11., 1 kg Mehl`: „bis 20.11.“ setzt das Ablaufdatum. *Kommt in* wählt den Ort: den, den du gerade ansiehst, oder *Automatisch*, dann kommt alles an seinen Platz. Mit *Scannen* hältst du den Barcode vor die Kamera, und das Produkt wird erkannt.

![Das + beim Vorrat](guide/de/41-pantry-add.webp)

### Ablaufdaten und Schwellen

Tippe auf ein Produkt für sein Blatt, dasselbe wie beim Einkauf (siehe [Das Blatt eines Produkts](#das-blatt-eines-produkts)). *Erinnern, wenn es sinkt auf* ist die Schwelle: darunter kommt das Produkt von selbst auf die Einkaufsliste. *Auffüllen bis* sagt, wie viel du kaufen sollst. *Haltbar bis* und *Tage vorher erinnern* bestimmen die Erinnerung am Morgen. Die Läden unter *Gibt es bei* kommen mit dem Produkt zurück auf die Liste, wenn es ausgeht.

![Ein Produkt: Menge, Schwelle, Ablaufdatum](guide/de/42-pantry-product.webp)

### Grundvorrat: Da, Wenig, Leer

Bei Salz, Öl, Gewürzen und Ähnlichem musst du keine Gramm zählen. Unter *Wie du es zählst* wählst du **Da / Wenig / Leer**: *Wenig* und *Leer* setzen es auf die Liste, und beim Einräumen wird es wieder *Da*. Kochen zieht davon nichts ab.

![Grundvorrat: Da, Wenig, Leer](guide/de/43-staple.webp)

### Filter

**Filter** wählt die Ansicht (Abteilungen, Haltbarkeit, Bestand, A–Z) und die Filter *Läuft bald ab*, *Abgelaufen*, *Wird knapp* und *Leer*, auch zusammen. *Rezepte mit dem, was da ist* öffnet Rezepte mit eingeschaltetem *Mit dem Vorrat*.

![Nur was bald abläuft](guide/de/44-pantry-filters.webp)

### Kassenbons

Unter ⋯ → *Kassenbon lesen* fotografierst du den Bon gerade und gut beleuchtet. Er wird auf deinem GitHub gelesen und danach gelöscht; ist er fertig, erscheint er im Vorrat, und du räumst ihn ein wie den Wagen.

## Mit Everyday

Everyday ist die App, mit der du deine Tage planst. Die beiden teilen Einkaufsliste, Läden und Vorrat, sobald du in Everyday das Repository von Ricette einträgst.

- **Es gibt eine einzige Einkaufsliste.** Was du in Everyday hinzufügst, steht auch hier, und umgekehrt.
- **Mahlzeiten.** In Everyday wählst du ein Rezept für eine Mahlzeit, zuerst aus den Favoriten. Ist die Mahlzeit erledigt, zählt das Rezept einmal mehr (*4× gekocht*).
- **Einräumen.** Auch in Everyday kommt der eingeräumte Einkauf in den Vorrat, mit den Läden des Eintrags, auch Putzmittel und Pflegeprodukte: sie landen im *Haushalt*. Den Ort zu Hause wählst du in Ricette; bis dahin gilt die Schätzung.
- **Einkäufe.** Everyday entscheidet, wann eingekauft wird; Ricette zeigt es auf der Liste als [nächsten Einkauf](#der-nachste-einkauf).

Wer was entscheidet: Ricette entscheidet über Rezepte, Liste und Vorrat; Everyday entscheidet, wann gekocht und wann eingekauft wird.

## Eine typische Woche

**Sonntagabend.** Du öffnest *Ausprobieren* und wählst zwei neue Rezepte: die rote Linsensuppe und das Zitronenhähnchen. Bei jedem tippst du auf *zur Einkaufsliste*: Nur was fehlt, kommt drauf. In Everyday kommt die Suppe auf Dienstag.

**Montag, auf dem Wochenmarkt.** Du öffnest den Einkauf nach Läden: Auf dem Wochenmarkt holst du Fenchel und Zitronen und hakst sie ab, während sie in die Tasche wandern. Zu Hause tippst du auf *In den Vorrat* und trägst das Ablaufdatum des Feta ein.

**Dienstagabend.** Rote Linsensuppe. Danach tippst du auf *Gekocht*: Der Vorrat zieht die Linsen ab, und auf *Wie war es?* antwortest du *Wieder kochen: Favorit*.

**Donnerstag, wenig Zeit.** Bei Rezepte schaltest du *Mit dem Vorrat* und **≤ 30 min** ein: Pasta e ceci geht mit dem, was da ist. Das Olivenöl wird knapp: Du tippst auf *Wenig*, und es steht schon auf der Liste für Samstag.

## Am Computer

Auf einem breiten Bildschirm nutzt Ricette drei Spalten. Links die Filter, immer offen. In der Mitte der Reiter. Rechts ein Bereich, der sich mit dem Reiter ändert:

- **Rezepte:** *Rezept hinzufügen* und eine Vorschau des angeklickten Rezepts, mit dem, was fehlt. *Rezept öffnen* zeigt es ganz.
- **Einkauf:** das Feld zum Hinzufügen und der Wagen, mit *In den Vorrat*. Die Liste verteilt sich auf mehrere Spalten.
- **Vorrat:** das Feld zum Hinzufügen und Scannen.

![Rezepte am Computer: Filter, Rezepte, Vorschau](guide/de/60-wide-recipes.webp)

![Einkauf am Computer](guide/de/61-wide-list.webp)

![Vorrat am Computer](guide/de/62-wide-pantry.webp)

## Tipps und häufige Probleme

**Die Synchronisierung startet nicht.** Prüfe unter Einstellungen → *GitHub-Verbindung*, ob das Token die *Contents* des Repositorys schreiben darf und nicht abgelaufen ist. Mit *Verbindung ändern* fügst du ein neues ein.

**Ein Import bleibt in der Warteschlange.** Importe laufen auf deinem GitHub: Sie brauchen die Verbindung und ein, zwei Minuten. Lässt sich eine Seite nicht lesen, steht das oben unter *Ausprobieren*: Versuch es mit einem Foto des Rezepts.

**Eine Zutat landet in der falschen Abteilung.** Tippe auf den Eintrag, dann auf *Korrigieren*, und wähle das richtige Lebensmittel: Das gilt ab dann überall.

**Ich habe aus Versehen etwas gelöscht.** Tippe gleich danach unten in der Meldung auf *Rückgängig*.

**Ich möchte eine Kopie meiner Daten.** Einstellungen → *Sicherung* → *Kopie der Daten herunterladen*. Dein Repository auf GitHub enthält ohnehin dieselben Daten.

**Das Handy erinnert nicht an Ablaufdaten.** Mitteilungen musst du auf jedem Gerät einschalten, unter *Vorrat und Erinnerungen*. Auf dem iPhone funktionieren sie nur in der App auf dem Home-Bildschirm.
