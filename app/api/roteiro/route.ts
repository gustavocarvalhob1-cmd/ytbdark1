import { NextRequest } from "next/server";
import { MODELO, gerarComStream, textoDe } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import {
  SYSTEM_ROTEIRO,
  mensagemRoteiro,
  contarPalavras,
  estimarSegundos,
  formatarDuracao,
} from "@/lib/voz";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 2 - ROTEIRO: escreve o texto narrado seguindo as regras da voz.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let dossie = "";
  let extras = "";
  try {
    const body = await req.json();
    dossie = body.dossie || "";
    extras = body.extras || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  if (!dossie || dossie.trim().length < 20) {
    return erro("Faltou o dossie do Passo 1.");
  }

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Escrevendo o roteiro na sua voz..." });

    const msg = await gerarComStream(emit, {
      model: MODELO,
      max_tokens: 6000,
      system: SYSTEM_ROTEIRO,
      messages: [{ role: "user", content: mensagemRoteiro(dossie, extras) }],
    });

    const texto = textoDe(msg);
    const palavras = contarPalavras(texto);
    const segundos = estimarSegundos(palavras);
    emit({
      type: "done",
      meta: {
        palavras,
        duracaoSegundos: segundos,
        duracaoTexto: formatarDuracao(segundos),
      },
    });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
