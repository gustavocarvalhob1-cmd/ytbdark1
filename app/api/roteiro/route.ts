import { NextRequest } from "next/server";
import { MODELO, gerarComStream, textoDe } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import {
  mensagemRoteiro,
  contarPalavras,
  estimarSegundos,
  formatarDuracao,
  instrucaoDuracao,
  instrucaoFormatoRoteiro,
} from "@/lib/roteiro-utils";
import type { Formato } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 2 - ROTEIRO: escreve o texto narrado na voz do canal, no tamanho e formato pedidos.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let dossie = "";
  let extras = "";
  let idCanal = "";
  let duracaoMin = 10;
  let formato: Formato = "youtube";
  try {
    const body = await req.json();
    dossie = body.dossie || "";
    extras = body.extras || "";
    idCanal = body.canal || "";
    if (Number.isFinite(body.duracaoMin)) duracaoMin = body.duracaoMin;
    if (body.formato === "tiktok") formato = "tiktok";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!dossie || dossie.trim().length < 20) return erro("Faltou o material do Passo 1.");

  const conteudo =
    mensagemRoteiro(dossie, extras) +
    instrucaoDuracao(duracaoMin) +
    instrucaoFormatoRoteiro(formato);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Escrevendo o roteiro na voz do canal..." });

    const msg = await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 6000,
      system: canal.prompts.roteiro,
      messages: [{ role: "user", content: conteudo }],
    });

    const texto = textoDe(msg);
    const palavras = contarPalavras(texto);
    const segundos = estimarSegundos(palavras);
    emit({
      type: "done",
      meta: { palavras, duracaoSegundos: segundos, duracaoTexto: formatarDuracao(segundos) },
    });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
