import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutz – Gurken Sekte",
  description:
    "Datenschutzerklärung der Gurken Sekte – Übersicht über genutzte Dienste, Datenverarbeitung und Ihre Rechte.",
};

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-8">
      <h1 className="mb-8 text-4xl font-bold text-[#ede8d6]">Datenschutz</h1>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold text-[#abc189]">
          Verwendete Dienste und Technologien
        </h2>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Hexclave (Authentifizierung & Benutzerverwaltung)
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Benutzerauthentifizierung,
              Kontoverwaltung, Mitgliederbereich, Referrer-System
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>Authentication über Hexclave SDK</li>
              <li>Benutzerkonto-Verwaltung</li>
              <li>Zugang zum Mitglieder-Dashboard</li>
              <li>Referrer-Tracking und -Belohnungen</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Cloudflare Turnstile (Bot-Schutz)
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Schutz vor automatisierten Bots und
              Missbrauch
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>
                CAPTCHA-Verifizierung für Formulare und interaktive Elemente
              </li>
              <li>Schutz des Chat-Systems vor Spam</li>
              <li>Prävention von Missbrauch des Punkte-Systems</li>
              <li>Sicherheit des Casino-Bereichs</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Mangoe Payments (Spenden-Zahlungen)
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Abwicklung von Spenden und
              Zahlungsprozessen
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>Entgegennahme von Spenden für die Gurken-Sekte</li>
              <li>Abwicklung des Checkout-Prozesses</li>
              <li>Zahlungsabwicklung und -bestätigung</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Upstash Redis & Ratelimit
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Leistungsoptimierung und Missbrauchsschutz
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>Rate-Limiting zur Verhinderung von Missbrauch</li>
              <li>Caching von häufig abgefragten Daten</li>
              <li>Schnellere Serverantworten</li>
              <li>Speicherung von Sitzungsdaten</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              OpenRouter API (KI-Chat)
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Bereitstellung des KI-gestützten
              Gürkchen-Chat-Dienstes (Eingaben können von OpenRouter und
              Partnern gespeichert werden!)
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>Bereitstellung des Gürkchen-Chat-Features</li>
              <li>Generierung von KI-Antworten und -Erklärungen</li>
              <li>Verarbeitung von Chat-Anfragen</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Mangoe Impressum (Rechtliche Informationen)
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Bereitstellung von rechtlichen
              Informationen und Kontakt Daten
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>
                Automatische Generierung von Impressum und rechtlichen
                Informationen
              </li>
              <li>Bereitstellung von Kontaktinformationen</li>
              <li>Einhaltung rechtlicher Anforderungen</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-2 text-xl font-medium text-[#ede8d6]">
              Bibliotheken und Frameworks
            </h3>
            <p className="text-sm text-[#6b7565] mb-2">
              <strong>Zweck:</strong> Kern-Websites-Technologien
            </p>
            <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-1">
              <li>Next.js (React-basierte Webframework)</li>
              <li>React (JavaScript-Bibliothek für UI-Komponenten)</li>
              <li>Tailwind CSS (Styling-Framework)</li>
              <li>Phosphor Icons (Icon-Bibliothek)</li>
              <li>QR-Code-Styling (QR-Code-Generierung)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold text-[#abc189]">
          Datenspeicherung und -verarbeitung
        </h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-[#a3ad9a] mb-4">
            <strong>Allgemeine Prinzipien:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-2">
            <li>
              Wir speichern nur die Daten, die für den Betrieb des Dienstes
              erforderlich sind
            </li>
            <li>
              Personenbezogene Daten werden nur mit Ihrer ausdrücklichen
              Zustimmung gespeichert
            </li>
            <li>
              Daten werden nicht an Dritte weitergegeben, es sei denn, dies ist
              für den Dienst erforderlich
            </li>
            <li>Wir verwenden sichere Serverinfrastrukturen</li>
            <li>
              Daten werden gemäß den geltenden Datenschutzgesetzen verarbeitet
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold text-[#abc189]">
          Ihre Rechte
        </h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-[#a3ad9a] mb-4">
            Sie haben folgende Rechte bezüglich Ihrer persönlichen Daten:
          </p>
          <ul className="list-disc list-inside text-sm text-[#a3ad9a] space-y-2">
            <li>Recht auf Zugang zu Ihren gespeicherten Daten</li>
            <li>Recht auf Berichtigung ungenauer Daten</li>
            <li>
              Recht auf Löschung Ihrer Daten („Recht auf Vergessenwerden“)
            </li>
            <li>Recht auf Einschränkung der Verarbeitung</li>
            <li>Recht auf Datenübertragbarkeit</li>
            <li>Widerspruch gegen die Verarbeitung</li>
            <li>
              Widerruf der Einwilligung (falls die Verarbeitung auf Einwilligung
              basiert)
            </li>
          </ul>
          <p className="text-[#a3ad9a] mt-4">
            Um Ihre Rechte auszuüben, kontaktieren Sie uns bitte über das
            Impressum-Popup auf der Website.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold text-[#abc189]">Kontakt</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-[#a3ad9a]">
            Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte können Sie
            unser Impressum-Popup nutzen, das Ihnen Zugang zu unseren
            Kontaktdaten und weiteren rechtlichen Informationen bietet.
          </p>
        </div>
      </section>
    </div>
  );
}
