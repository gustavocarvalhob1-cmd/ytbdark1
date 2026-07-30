import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemAngulos } from "@/lib/roteiro-utils";
import { SYSTEM_ANGULOS } from "@/lib/voz-insight";

export const runtime = "nodejs";
export const maxDuration = 300;

// MODO INSIGHT: a partir de uma ideia solta, propoe de 3 a 5 angulos para o video.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let ideia = "";
  let idCanal = "";
  try {
    const body = await req.json();
    ideia = body.ideia || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!ideia || ideia.trim().length < 4) return erro("Escreva uma ideia um pouco maior.");

  const contexto = `${canal.nome} — ${canal.descricao}`;

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Pensando em caminhos..." });
    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 1200,
      system: SYSTEM_ANGULOS,
      messages: [{ role: "user", content: mensagemAngulos(ideia, contexto) }],
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
