import { NextRequest } from "next/server";
import { MODELO, gerarComStream, extrairFontes } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemPesquisa, mensagemTema } from "@/lib/roteiro-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 1: monta o material base (dossie de pesquisa OU desenvolvimento de tema), por canal.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let fonte = "";
  let idCanal = "";
  try {
    const body = await req.json();
    fonte = body.fonte || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");

  if (!fonte || typeof fonte !== "string" || fonte.trim().length < 20) {
    return erro("Escreva um pouco mais de texto para comecar.");
  }

  const usaWeb = canal.entrada.buscaWeb;
  const mensagem =
    canal.entrada.modo === "livre" ? mensagemTema(fonte) : mensagemPesquisa(fonte);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Lendo e preparando o material..." });

    const msg = await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: canal.prompts.passo1,
      ...(usaWeb
        ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] }
        : {}),
      messages: [{ role: "user", content: mensagem }],
    });

    if (usaWeb) {
      const fontes = extrairFontes(msg);
      if (fontes.length) emit({ type: "sources", items: fontes });
    }
    emit({ type: "done" });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
