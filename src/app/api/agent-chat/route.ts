export const runtime = "edge";

function getOpenClawConfig() {
  return {
    url: process.env.OPENCLAW_GATEWAY_URL,
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    agentId: process.env.OPENCLAW_AGENT_ID ?? "main",
  };
}

/**
 * Proxie le chat vers OpenClaw (Gateway) et transforme le flux SSE en flux texte
 * pour rester compatible avec le client useCopilot.
 */
export async function POST(req: Request) {
  const { url: OPENCLAW_GATEWAY_URL, token: OPENCLAW_GATEWAY_TOKEN, agentId: OPENCLAW_AGENT_ID } = getOpenClawConfig();
  if (!OPENCLAW_GATEWAY_URL || !OPENCLAW_GATEWAY_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "OpenClaw non configuré",
        detail: "Définir OPENCLAW_GATEWAY_URL et OPENCLAW_GATEWAY_TOKEN dans .env.local",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, userId } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionKey = userId ? `orbit:${userId}` : undefined;
    const url = OPENCLAW_GATEWAY_URL.replace(/\/$/, "") + "/v1/chat/completions";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      "x-openclaw-agent-id": OPENCLAW_AGENT_ID,
    };
    if (sessionKey) {
      headers["x-openclaw-session-key"] = sessionKey;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "openclaw",
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({
          error: "Erreur OpenClaw",
          status: res.status,
          detail: text.slice(0, 500),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "Pas de flux OpenClaw" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoder = new TextDecoder();
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data);
                  const content = json?.choices?.[0]?.delta?.content;
                  if (typeof content === "string" && content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch {
                  // ignorer les lignes non-JSON
                }
              }
            }
          }
          // flush rest of buffer
          if (buffer.startsWith("data: ")) {
            const data = buffer.slice(6).trim();
            if (data !== "[DONE]") {
              try {
                const json = JSON.parse(data);
                const content = json?.choices?.[0]?.delta?.content;
                if (typeof content === "string" && content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch {
                // noop
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: "Erreur agent-chat", detail: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
