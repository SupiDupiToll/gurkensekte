const GUERKCHEN_SYSTEM_PROMPT =
  "Du bist Gürkchen, der selbsternannte, größenwahnsinnige und leicht absurde " +
  "Anführer der 'Gurken Sekte'. Du sprichst in übertriebenen, pseudo-religiösen " +
  "Gurken-Metaphern, hältst dich für unfehlbar, geizt nicht mit dramatischen " +
  "Ansagen und Wortspielen rund um Gurken/Essiggurken/Einlegen. Bleib dabei " +
  "manchmal harmlos, albern und freundlich-chaotisch – beleidige hin und wieder, nie " +
  "ernsthaft religionskritisch, nie gegenüber echten Personen/Gruppen abwertend. " +
  "Antworte kurz und knackig (max. 3-4 Sätze).";

const FALLBACK_REPLY =
  "Gürkchen meditiert gerade im Glas und ist nicht erreichbar. Versuch's gleich nochmal. 🥒";

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

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const apiKeys = getApiKeys();

    if (apiKeys.length === 0) {
      console.error("Gürkchen-Chat: kein OPENROUTER_API_KEY gesetzt");
      return Response.json({ reply: FALLBACK_REPLY });
    }

    let lastError: unknown = null;

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
              stream: true,
              messages: [
                { role: "system", content: GUERKCHEN_SYSTEM_PROMPT },
                ...messages,
              ],
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Gürkchen-Chat: OpenRouter Fehler (${response.status}) mit Key ${apiKey.slice(0, 8)}...:`,
            errorText,
          );
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          continue;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const openRouterReader = response.body!.getReader();

        const stream = new ReadableStream({
          async start(controller) {
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await openRouterReader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data: ")) continue;
                  if (trimmed === "data: [DONE]") continue;

                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const content = json.choices?.[0]?.delta?.content || "";
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                    // skip malformed lines
                  }
                }
              }
            } catch (err) {
              console.error("Gürkchen-Chat: Stream-Fehler:", err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } catch (error) {
        console.error(
          `Gürkchen-Chat: Network-Fehler mit Key ${apiKey.slice(0, 8)}...:`,
          error,
        );
        lastError = error;
      }
    }

    console.error("Gürkchen-Chat: alle API-Keys fehlgeschlagen", lastError);
    return Response.json({ reply: FALLBACK_REPLY });
  } catch (error) {
    console.error("Gürkchen-Chat: Fehler im Route Handler:", error);
    return Response.json({ reply: FALLBACK_REPLY });
  }
}
