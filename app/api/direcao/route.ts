import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemDirecao } from "@/lib/roteiro-utils";
import { SYSTEM_DIRECAO } from "@/lib/voz-insight";

export const runtime = "nodejs";
export const maxDuration = 300;

// MODO INSIGHT: confirma o rumo depois que o usuario escolheu/escreveu um angulo.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let ideia = "";
  let angulo = "";
  let idCanal = "";
  try {
    const body = await req.json();
    ideia = body.ideia || "";
    angulo = body.angulo || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!angulo || angulo.trim().length < 2) return erro("Escolha ou escreva um angulo.");

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Confirmando o rumo..." });
    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 700,
      system: SYSTEM_DIRECAO,
      messages: [{ role: "user", content: mensagemDirecao(ideia, angulo) }],
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
