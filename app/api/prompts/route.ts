import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemPrompts, fatiarRoteiro, instrucaoFormatoImagens } from "@/lib/roteiro-utils";
import type { Formato } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 3 - IMAGENS: gera os prompts de video de um lote, na orientacao do formato escolhido.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let roteiro = "";
  let indice = 0;
  let total = 1;
  let idCanal = "";
  let formato: Formato = "youtube";
  try {
    const body = await req.json();
    roteiro = body.roteiro || "";
    indice = Number.isInteger(body.indice) ? body.indice : 0;
    total = Number.isInteger(body.total) && body.total > 0 ? body.total : 1;
    idCanal = body.canal || "";
    if (body.formato === "tiktok") formato = "tiktok";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!roteiro || roteiro.trim().length < 20) return erro("Faltou o roteiro do Passo 2.");

  const { trecho, offsetSegundos, numeroInicial } = fatiarRoteiro(roteiro, total, indice);
  const conteudo =
    mensagemPrompts({ trecho, offsetSegundos, numeroInicial }) + instrucaoFormatoImagens(formato);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: `Montando as cenas (parte ${indice + 1} de ${total})...` });

    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 8000,
      system: canal.prompts.imagens,
      messages: [{ role: "user", content: conteudo }],
    });

    emit({ type: "done" });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
