# Datenschutzerklärung: Vorlage für den Messendpunkt

> **Keine Rechtsberatung.** Diese Vorlage ist ein Formulierungsvorschlag für
> den technischen Sachverhalt, den dieses Relay erzeugt. Sie ersetzt keine
> Prüfung durch eine Anwältin, einen Anwalt oder Ihre Datenschutzbeauftragten.
> Ob sie auf Ihre Website passt, hängt von Ihren Verträgen, Ihren übrigen
> Werkzeugen und Ihrer Konfiguration ab. Kube Studio übernimmt keine Haftung
> für ihre Verwendung.

*English summary: a German template paragraph for your privacy policy that
covers Pirsch Analytics and the relay subdomain on Vercel. Not legal advice.*

## Platzhalter

| Platzhalter | Ersetzen durch |
|---|---|
| `{{SUBDOMAIN}}` | Ihre Relay-Subdomain, z. B. `a.example.com` |
| `{{EREIGNISSE}}` | den Satz unten, oder ganz streichen, wenn Sie keine Ereignisse erfassen |
| `{{LOG_AUFBEWAHRUNG}}` | die Aufbewahrungsdauer der Runtime Logs in Ihrem Vercel-Tarif (in Vercel nachsehen, nicht schätzen) |

Prüfen Sie vor dem Einsatz alle Angaben zu Anbietern, Anschriften und
Verträgen gegen den aktuellen Stand bei Pirsch und Vercel.

## Der Text

> ### Webanalyse mit Pirsch Analytics
>
> Diese Website nutzt Pirsch Analytics, einen Webanalysedienst der Emvi
> Software GmbH, Nickelstraße 1b, 33378 Rheda-Wiedenbrück. Pirsch Analytics
> arbeitet ohne Cookies und speichert keine Kennungen auf Ihrem Endgerät. Um
> wiederkehrende Aufrufe innerhalb eines Tages zu erkennen, wird aus
> IP-Adresse, User-Agent, Datum und einem täglich wechselnden Zufallswert ein
> nicht umkehrbarer Hash gebildet. Die IP-Adresse wird dabei weder vollständig
> noch gekürzt gespeichert; der Hash verliert seine Zuordnungsfähigkeit
> spätestens nach 24 Stunden.
>
> Erhoben werden die aufgerufene Seite, die Verweisquelle, der Zeitpunkt,
> Gerätetyp, Browser, Betriebssystem sowie eine grobe geografische Herkunft
> auf Länder- und Regionsebene. {{EREIGNISSE}} Ein Personenbezug wird nicht
> hergestellt; eine Zusammenführung mit anderen Datenquellen findet nicht
> statt.
>
> Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse
> liegt in der statistischen Auswertung der Websitenutzung, um unser Angebot
> bedarfsgerecht zu gestalten und zu verbessern. Da weder Cookies gesetzt noch
> Informationen aus Ihrem Endgerät gespeichert oder ausgelesen werden, ist eine
> Einwilligung nach § 25 Abs. 1 TDDDG nicht erforderlich.
>
> Die Verarbeitung erfolgt nach Angaben des Anbieters auf Servern in
> Deutschland. Mit der Emvi Software GmbH besteht ein Vertrag zur
> Auftragsverarbeitung nach Art. 28 DSGVO. Weitere Informationen:
> https://pirsch.io/privacy
>
> **Betrieb des Messendpunkts.** Die Messdaten werden nicht unmittelbar an
> Pirsch Analytics gesendet, sondern zunächst an unsere Subdomain
> `{{SUBDOMAIN}}`. Diese wird bei der Vercel Inc., 440 N Barranca Avenue
> #4133, Covina, CA 91723, USA, betrieben und leitet die Daten serverseitig an
> Pirsch Analytics weiter. Dabei verarbeitet Vercel die technisch notwendigen
> Verbindungsdaten einschließlich Ihrer IP-Adresse. Die Ausführung ist auf den
> Standort Frankfurt am Main festgelegt. Vercel protokolliert die Anfragen an
> den Messendpunkt, darunter die aufgerufene Seite, die Verweisquelle und den
> User-Agent, und löscht diese Protokolle nach {{LOG_AUFBEWAHRUNG}}. Da der
> Anbieter seinen Sitz in den USA hat, lässt sich ein Zugriff aus einem
> Drittland nicht vollständig ausschließen; die Übermittlung ist über einen
> Auftragsverarbeitungsvertrag mit Standardvertragsklauseln nach Art. 46
> Abs. 2 lit. c DSGVO abgesichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
> DSGVO. Weitere Informationen: https://vercel.com/legal/privacy-policy

Satz für `{{EREIGNISSE}}`, wenn Sie Ereignisse erfassen:

> Zusätzlich erfassen wir bestimmte Interaktionen als Ereignis, etwa
> {{AUFZÄHLUNG}}, jeweils nur die Tatsache der Interaktion, ohne Inhalte.

## Was Sie vorher prüfen sollten

1. **Die beiden Vertragssätze.** „Mit der Emvi Software GmbH besteht ein
   Vertrag zur Auftragsverarbeitung" und „über einen
   Auftragsverarbeitungsvertrag mit Standardvertragsklauseln abgesichert"
   stimmen nur, wenn Sie diese Verträge tatsächlich abgeschlossen haben (bei
   Pirsch und bei Vercel jeweils im Konto). Betreibt eine Agentur Vercel-Projekt
   oder Pirsch-Konto für Sie, ist sie Auftragsverarbeiterin und Vercel bzw.
   Emvi sind Unterauftragsverarbeiter. Dann gehört das so in den Text.
2. **Die Region.** Der Satz „Ausführung in Frankfurt am Main" stimmt, solange
   `api/proxy.js` `regions: ["fra1"]` setzt. Nachprüfbar am Antwortkopf
   `x-vercel-id` eines Tracking-Pfads (nicht der Startseite): `fra1::fra1`.
3. **Die Bildschirmgröße.** Das mitgelieferte Snippet setzt
   `data-disable-resolution`, deshalb fehlt die Bildschirmgröße in der
   Aufzählung. Entfernen Sie das Attribut, nehmen Sie sie in den Text auf.
4. **Ereignisse.** Nennen Sie die Ereignisse, die Ihr ausgeliefertes Snippet
   tatsächlich sendet, nicht die geplanten.
5. **Bestehende Absätze.** Steht schon ein Absatz zu Pirsch oder einem anderen
   Analysewerkzeug in Ihrer Erklärung, ersetzen Sie ihn, statt einen zweiten
   hinzuzufügen.

## Warum der Messendpunkt überhaupt erwähnt werden muss

Pirsch selbst speichert keine IP-Adressen. Das Relay liest die IP-Adresse des
Besuchers aber aus der Anfrage und gibt sie an Pirsch weiter, damit dort der
tägliche Hash entstehen kann. Bis dahin liegt eine IP-Adresse vor, und die ist
personenbezogen. Vercel verarbeitet sie, und Vercels Runtime Logs enthalten
Pfad und Query-String der Anfrage, also die aufgerufene Seite, Seitentitel und
Verweisquelle. Das Relay fügt damit einen weiteren Auftragsverarbeiter hinzu.
Das ist gut begrenzt, aber es ist nicht „nur ein anderer Transportweg".

## Was die Vorlage nicht abdeckt

Andere Werkzeuge auf derselben Seite (Google Tag Manager, Werbepixel,
eingebettete Kalender, Formulardienste) brauchen eigene Absätze und, wo
einwilligungspflichtig, eine Einwilligungsverwaltung. Das Relay ändert daran
nichts.
