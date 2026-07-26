// Helper para responder em streaming no formato NDJSON (uma linha JSON por evento).
// O navegador le linha a linha e vai mostrando o texto conforme chega.

export function respostaStream(
  handler: (emit: (evento: object) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fechado = false;
      const emit = (evento: object) => {
        if (fechado) return;
        controller.enqueue(encoder.encode(JSON.stringify(evento) + "\n"));
      };
      try {
        await handler(emit);
      } catch (e: any) {
        emit({ type: "error", message: mensagemDeErro(e) });
      } finally {
        fechado = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function mensagemDeErro(e: any): string {
  const bruto = e?.error?.error?.message || e?.message || String(e);
  if (/api key|authentication|x-api-key/i.test(bruto)) {
    return "A chave da API da Anthropic esta faltando ou invalida. Confira a variavel ANTHROPIC_API_KEY.";
  }
  if (/rate limit|429/i.test(bruto)) {
    return "Muitas requisicoes seguidas. Espere alguns segundos e tente de novo.";
  }
  if (/credit|billing|quota/i.test(bruto)) {
    return "Parece que a conta da Anthropic esta sem credito. Confira em console.anthropic.com.";
  }
  return "Deu um erro ao falar com o Claude: " + bruto;
}
