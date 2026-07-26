import { NextRequest } from "next/server";
import { MODELO, gerarComStream, extrairFontes } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { SYSTEM_FONTE, mensagemFonte } from "@/lib/voz";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 1 - FONTE: confere os fatos na internet e monta o dossie.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let fonte = "";
  try {
    ({ fonte } = await req.json());
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  if (!fonte || typeof fonte !== "string" || fonte.trim().length < 20) {
    return erro("Cole a transcricao, o link ou a noticia (precisa de um pouco mais de texto).");
  }

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Lendo a fonte e conferindo os fatos..." });

    const msg = await gerarComStream(emit, {
      model: MODELO,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM_FONTE,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: mensagemFonte(fonte) }],
    });

    const fontes = extrairFontes(msg);
    if (fontes.length) emit({ type: "sources", items: fontes });
    emit({ type: "done" });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
