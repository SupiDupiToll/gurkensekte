import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AGB – Gurken Sekte",
  description:
    "Allgemeine Geschäftsbedingungen der Gurken Sekte – Regeln für Mitgliedschaft, Punkte, GurkenMail und die echte Gurke.",
};

function Abschnitt({
  nr,
  titel,
  children,
}: {
  nr: string;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-2xl font-semibold text-[#abc189]">
        § {nr} {titel}
      </h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-[#a3ad9a]">
        {children}
      </div>
    </section>
  );
}

export default function AgbPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-8">
      <h1 className="mb-2 text-4xl font-bold text-[#ede8d6]">
        Allgemeine Geschäftsbedingungen
      </h1>
      <p className="mb-8 text-sm text-[#6b7565]">
        Stand: Oktober 2026 · Die heilige Gurke hat diese Regeln eingelegt.
      </p>

      <Abschnitt nr="1" titel="Geltungsbereich und Anbieter">
        <p className="mb-3">
          (1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die
          Nutzung der Website gurkensekte.de sowie aller damit verbundenen
          Dienste (Mitgliederbereich, GurkenMail, Punkte-System, Spenden).
        </p>
        <p className="mb-3">(2) Anbieter dieser Dienste ist:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>Siehe Impressum im Footer</li>
        </ul>
        <p>
          (3) Mit der Registrierung als Mitglied erkennst du die jeweils
          aktuelle Version dieser AGB an. Änderungen werden vorab angekündigt
          (siehe § 19).
        </p>
      </Abschnitt>

      <Abschnitt nr="2" titel="Satire-Hinweis: Was die Gurken Sekte ist">
        <p className="mb-3">
          (1) Die Gurken Sekte ist eine satirische Parodie und keine echte
          Religions- oder Glaubensgemeinschaft. Gürkchen ist eine erfundene
          Figur.
        </p>
        <p>
          (2) Es gibt keine Heilsversprechen, keine spirituellen Garantien und
          keine Wunder – nur Gurken, Punkte und gute Laune. Wer Erleuchtung
          sucht, findet hier bestenfalls eine gut eingelegte Gurke.
        </p>
      </Abschnitt>

      <Abschnitt nr="3" titel="Leistungen">
        <p className="mb-3">
          (1) Der Mitgliederbereich ist kostenlos und umfasst derzeit: den
          Gürkchen-Chat, täglich generierbare Zitate, das Gurken-Casino (Slots &
          Roulette), das Duell, GurkenMail (eigene @gurkensekte.de-Adresse)
          sowie das Punkte- und Rang-System.
        </p>
        <p className="mb-3">
          (2) Casino, Roulette und Duell werden ausschließlich mit Spielpunkten
          gespielt. Es handelt sich um kein Echtgeld-Glücksspiel: Es gibt keine
          Einsätze in Geld, keine Gewinne in Geld und keine Auszahlung. Eine
          Glücksspiel-Lizenz ist weder vorhanden noch erforderlich.
        </p>
        <p>
          (3) Die Antworten des Gürkchen-Chats werden von einer KI erzeugt und
          dienen der Unterhaltung und Satire. Sie sind keine Rechts-,
          Gesundheits-, Finanz- oder sonstige Fachberatung. Verlass dich bei
          echten Problemen auf echte Fachleute – nicht auf eine Gurke.
        </p>
      </Abschnitt>

      <Abschnitt nr="4" titel="Registrierung – ein Account pro Person">
        <p className="mb-3">
          (1) Für den Mitgliederbereich ist genau ein Account pro Person
          erlaubt. Mehrfachaccounts (z. B. über weitere E-Mail-Adressen) sind
          verboten.
        </p>
        <p className="mb-3">
          (2) Bei der Registrierung sind wahrheitsgemäße Angaben zu machen.
          Deine Zugangsdaten (Passwort, Passkeys, MFA) sind geheim zu halten;
          wir empfehlen die Nutzung von Passkey oder MFA, wo angeboten.
        </p>
        <p className="mb-3">
          (3) Du bist für alle Aktivitäten unter deinem Account verantwortlich.
          Bei Verdacht auf unbefugten Zugriff ändere sofort deine Zugangsdaten
          und melde dich über das Impressum.
        </p>
        <p>
          (4) Werden Mehrfachaccounts festgestellt, können sie nach unserem
          Ermessen zusammengelegt oder gesperrt werden; unrechtmäßig erlangte
          Punkte (z. B. doppelte Boni, Referral-Punkte an sich selbst)
          verfallen.
        </p>
      </Abschnitt>

      <Abschnitt nr="5" titel="Benutzernamen-Regeln">
        <p>
          Benutzernamen dürfen nicht irreführend, obszön oder rechtsverletzend
          sein. Insbesondere ist es verboten, sich als „Gürkchen“, als
          Administrator oder als eine andere Person auszugeben. Unzulässige
          Namen können umbenannt oder der Account gesperrt werden.
        </p>
      </Abschnitt>

      <Abschnitt nr="6" titel="Kein Account-Handel, keine Weitergabe">
        <p>
          Accounts dürfen weder verkauft, verschenkt, verliehen noch sonst
          weitergegeben oder geteilt werden. Jeder Account ist an die
          registrierte Person gebunden.
        </p>
      </Abschnitt>

      <Abschnitt nr="7" titel="Fair Play – kein Cheating">
        <p className="mb-3">(1) Verboten sind insbesondere:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>
            Bots, Scripte oder sonstige Automatisierung zur Nutzung der Dienste
            (z. B. automatisches Punkte-Farmen im Chat, bei Zitaten oder im
            Casino)
          </li>
          <li>
            die Umgehung oder Manipulation des Bot-Schutzes (Cloudflare
            Turnstile / Captcha)
          </li>
          <li>
            das Ausnutzen von Bugs oder Schwachstellen (z. B. doppelte
            Punktegutschriften)
          </li>
        </ul>
        <p className="mb-3">
          (2) Wer einen Bug findet, meldet ihn statt ihn auszunutzen – Gürkchen
          belohnt Ehrlichkeit eher als Schummelei.
        </p>
        <p>
          (3) Wer nach einer Sperrung einen neuen Account erstellt, um die
          Sperre zu umgehen, wird sofort und dauerhaft gesperrt.
        </p>
      </Abschnitt>

      <Abschnitt nr="8" titel="Verhalten und Inhalte">
        <p className="mb-3">
          (1) Im Chat, im Duell, in Zitaten und überall sonst sind verboten:
          Beleidigungen, Belästigung, Hassrede, extremistische, pornografische
          oder sonst rechtswidrige Inhalte.
        </p>
        <p>
          (2) Dein Benutzername und dein Rang sind im Leaderboard für alle
          Mitglieder öffentlich sichtbar. Poste nichts, was du nicht mit der
          Sekte teilen willst.
        </p>
      </Abschnitt>

      <Abschnitt nr="9" titel="GurkenMail-Regeln">
        <p className="mb-3">
          (1) Jedes Mitglied erhält eine persönliche @gurkensekte.de-Adresse.
          Der externe Versand ist auf 3 Mails pro Tag und Konto begrenzt; der
          Empfang ist unbegrenzt.
        </p>
        <p className="mb-3">(2) Verboten sind insbesondere:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>
            Spam, Massenmails, Werbung, Kettenbriefe und MLM-/Schneeballsysteme
          </li>
          <li>Phishing, Betrug und sonstige Täuschungsversuche</li>
          <li>strafbare oder rechtswidrige Inhalte aller Art</li>
          <li>
            die kommerzielle Nutzung von GurkenMail (kein Business, kein
            Verkauf, keine Kundengewinnung über Mitglieder-Adressen)
          </li>
        </ul>
        <p className="mb-3">
          (3) Die E-Mail-Adressen anderer Mitglieder dürfen nicht gesammelt,
          weitergegeben oder anderweitig verwendet werden.
        </p>
        <p>
          (4) Es besteht keine Garantie für die Zustellung: Mails können in
          Spam-Filtern der Empfänger-Provider landen (ggf. Spam-Ordner prüfen).
          Ein Ersatzversand findet nicht statt. Missbrauch führt zur
          Einschränkung oder Sperrung des Versands bis hin zur Kontosperrung.
        </p>
      </Abschnitt>

      <Abschnitt nr="10" titel="Freunde werben (Referrals)">
        <p className="mb-3">
          (1) Für jedes geworbene echte Mitglied gibt es +100 Punkte, sobald die
          Bedingungen des Referral-Programms erfüllt sind.
        </p>
        <p className="mb-3">(2) Verboten sind:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>
            Selbstwerbung über Fake- oder Zweitaccounts zur Erschleichung der
            +100 Punkte
          </li>
          <li>
            öffentliches Spammen des Referral-Links oder das Schalten als
            Werbung
          </li>
        </ul>
        <p>
          (3) Referral-Links bitte nur persönlich teilen – an echte Menschen,
          die wirklich zur Sekte wollen. Bestätigter Missbrauch führt zu
          Punkteabzug und ggf. Sperrung.
        </p>
      </Abschnitt>

      <Abschnitt nr="11" titel="Punkte, XP und Ränge">
        <p className="mb-3">
          (1) Punkte und XP haben keinen Geldwert. Sie können weder in Geld
          umgetauscht noch ausgezahlt noch auf andere Mitglieder übertragen
          werden.
        </p>
        <p className="mb-3">
          (2) Punktewerte, Boni und Limits (z. B. +5 pro Chat-Nachricht und
          Zitat, +20 Tagesbonus, 3 Zitate pro Tag) können jederzeit angepasst
          werden. Es besteht kein Anspruch auf bisherige Werte.
        </p>
        <p>
          (3) Rang-Titel sind reine Ehrentitel ohne Rechte oder Ansprüche. Der
          Punktestand wird nach bestem Wissen geführt, jedoch ohne Gewähr.
        </p>
      </Abschnitt>

      <Abschnitt nr="12" titel="Die echte Gurke (Prämie ab 1.000 Punkten)">
        <p className="mb-3">
          (1) Ab 1.000 Punkten kannst du dir eine echte Gurke per Post bestellen
          – solange der Vorrat reicht. Statt der Gurke gibt es kein Geld und
          keine andere Prämie: Gurke oder nichts.
        </p>
        <p className="mb-3">
          (2) Der Versand erfolgt nur innerhalb Deutschlands und nur bei Angabe
          einer korrekten Lieferadresse (Name, Straße, PLZ, Ort). Die Lieferzeit
          ist unverbindlich.
        </p>
        <p className="mb-3">
          (3) Bei falsch angegebener Adresse gibt es keinen Ersatzversand; die
          eingelösten Punkte sind trotzdem weg. Für Verderb auf dem Postweg wird
          kein Ersatz geleistet – es handelt sich um frisches Gemüse, nicht um
          Goldbarren.
        </p>
        <p className="mb-3">
          (4) Verzehr auf eigene Gefahr. Bei Allergien (z. B.
          Birkenpollen-Kreuzallergie) bitte vorsichtig sein oder lieber nur
          anschauen.
        </p>
        <p>
          (5) Wer seine Gurken-Lieferung öffentlich postet, erlaubt uns den
          Repost auf der Sekten-Seite (mit Nennung, versteht sich).
        </p>
      </Abschnitt>

      <Abschnitt nr="13" titel="Spenden">
        <p className="mb-3">
          (1) Spenden an die Gurken Sekte sind freiwillig und stellen keinen
          Kaufvertrag dar. Die Abwicklung erfolgt über Mangoe Payments.
        </p>
        <p className="mb-3">
          (2) Für eine Spende gibt es keine Gegenleistung – außer ewiger
          Dankbarkeit und Gürkchens Segen. Da wir nicht gemeinnützig sind,
          können keine Spendenquittungen (Zuwendungsbestätigungen) ausgestellt
          werden.
        </p>
        <p>
          (3) Wer eine Spende ohne berechtigten Grund per Chargeback
          zurückbucht, muss mit Prüfung und bei Missbrauch mit der Sperrung des
          Accounts rechnen.
        </p>
      </Abschnitt>

      <Abschnitt nr="14" titel="Laufzeit, Kündigung und Sperrung">
        <p className="mb-3">
          (1) Die Mitgliedschaft ist unbefristet und kann jederzeit ohne Angabe
          von Gründen gekündigt werden (Kontolöschung). Bei Löschung verfallen
          Punkte, Ränge und GurkenMail-Adresse unwiderruflich.
        </p>
        <p>
          (2) Bei Verstößen gegen diese AGB behalten wir uns – je nach Schwere –
          vor: Verwarnung, zeitweise Einschränkung (z. B. Mail- oder
          Casino-Sperre) oder dauerhafte Kontosperrung. Das Hausrecht des
          Einlegeglases bleibt unberührt.
        </p>
      </Abschnitt>

      <Abschnitt nr="15" titel="Verfügbarkeit, Wartung und Support">
        <p>
          Es besteht kein Anspruch auf ununterbrochene Verfügbarkeit oder
          bestimmte Support-Antwortzeiten. Wartungen werden nach Möglichkeit
          angekündigt; für Ausfälle oder verlorene Spielzeit während Wartungen
          gibt es keine Entschädigung. Neue Features können zunächst als Beta
          laufen und sich noch ändern.
        </p>
      </Abschnitt>

      <Abschnitt nr="16" titel="Haftung">
        <p className="mb-3">
          (1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit
          sowie bei Verletzung von Leben, Körper oder Gesundheit.
        </p>
        <p>
          (2) Bei leichter Fahrlässigkeit haften wir nur bei Verletzung
          wesentlicher Vertragspflichten und nur für den typischerweise
          vorhersehbaren Schaden. Für kostenlose Dienste ist die Haftung darüber
          hinaus ausgeschlossen, soweit gesetzlich zulässig.
        </p>
      </Abschnitt>

      <Abschnitt nr="17" titel="Scraping-Verbot">
        <p>
          Das automatisierte Auslesen (Scraping, Crawling) der Website und der
          APIs ist ohne unsere ausdrückliche Erlaubnis verboten.
        </p>
      </Abschnitt>

      <Abschnitt nr="18" titel="Aktionen und Gewinnspiele">
        <p>
          Zukünftige Verlosungen oder Sonderaktionen erhalten jeweils eigene
          Teilnahmebedingungen, die dann zusätzlich zu diesen AGB gelten.
        </p>
      </Abschnitt>

      <Abschnitt nr="19" titel="Änderungen dieser AGB">
        <p>
          Änderungen dieser AGB werden vorab (z. B. per Banner oder E-Mail)
          angekündigt. Wer nach Inkrafttreten weiter mitmacht, akzeptiert die
          neue Version. Bei wesentlichen Nachteilen steht dir das
          Kündigungsrecht nach § 14 zu.
        </p>
      </Abschnitt>

      <Abschnitt nr="20" titel="Schlussbestimmungen">
        <p className="mb-3">
          (1) Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
        </p>
        <p className="mb-3">
          (2) Informationen zur Online-Streitbeilegung der EU und zur
          Verbraucherschlichtung: Die EU-Kommission stellt eine Plattform zur
          Online-Streitbeilegung bereit ([Link bitte ergänzen]). Wir sind weder
          verpflichtet noch bereit, an einem Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen, sofern sich dies nicht
          ändert ([ggf. anpassen]).
        </p>
        <p>
          (3) Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt der Rest
          wirksam (salvatorische Klausel). An die Stelle der unwirksamen
          Bestimmung tritt die gesetzliche Regelung.
        </p>
      </Abschnitt>
    </div>
  );
}
