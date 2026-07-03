const QUOTE_SYSTEM_PROMPT =
  "Du bist Gürkchen, der selbsternannte Anführer der 'Gurken Sekte'. " +
  "Erfinde ein kurzes, lustiges, pseudo-religiöses Zitat über Gurken. " +
  "maximal 1-2 Sätze. Keine Einleitung, keine Erklärung, nur das Zitat. " +
  "Sprich von dir selbst in der dritten Person (Gürkchen). " +
  "Antworte auf Deutsch.";

const FALLBACK_QUOTE =
  "Die Gurke ist der Urknall in essbarer Form. – Gürkchen 🥒";

function getApiKeys(): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (
      key.startsWith("OPENROUTER_API_KEY") &&
      value &&
      value !== "your_openrouter_api_key_here"
    ) {
      keys.push(value);
    }
  }
  return keys;
}

export const runtime = "nodejs";

export async function GET() {
  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    return Response.json({ quote: FALLBACK_QUOTE });
  }

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gurkensekte.de",
            "X-Title": "Gurken Sekte",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            stream: false,
            messages: [{ role: "user", content: QUOTE_SYSTEM_PROMPT }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Gürkchen-Quote: Fehler (${response.status}) mit Key ${apiKey.slice(0, 8)}...:`,
          errorText,
        );
        continue;
      }

      const data = await response.json();
      const quote =
        data.choices?.[0]?.message?.content?.trim() || FALLBACK_QUOTE;
      return Response.json({ quote });
    } catch (error) {
      console.error(
        `Gürkchen-Quote: Network-Fehler mit Key ${apiKey.slice(0, 8)}...:`,
        error,
      );
    }
  }

  return Response.json({ quote: FALLBACK_QUOTE });
}
