import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { SYSTEM_PROMPTS, mensagemPrompts, fatiarRoteiro } from "@/lib/voz";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 3 - IMAGENS: gera os prompts de video de um lote (um trecho do roteiro).
// O navegador chama esta rota uma vez por lote e vai juntando o resultado.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let roteiro = "";
  let indice = 0;
  let total = 1;
  try {
    const body = await req.json();
    roteiro = body.roteiro || "";
    indice = Number.isInteger(body.indice) ? body.indice : 0;
    total = Number.isInteger(body.total) && body.total > 0 ? body.total : 1;
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  if (!roteiro || roteiro.trim().length < 20) {
    return erro("Faltou o roteiro do Passo 2.");
  }

  const { trecho, offsetSegundos, numeroInicial } = fatiarRoteiro(roteiro, total, indice);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: `Montando as cenas (parte ${indice + 1} de ${total})...` });

    await gerarComStream(emit, {
      model: MODELO,
      max_tokens: 8000,
      system: SYSTEM_PROMPTS,
      messages: [
        { role: "user", content: mensagemPrompts({ trecho, offsetSegundos, numeroInicial }) },
      ],
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
