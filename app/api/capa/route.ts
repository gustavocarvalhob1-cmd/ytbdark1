import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemCapa } from "@/lib/roteiro-utils";
import { SYSTEM_CAPA } from "@/lib/voz-capa";
import type { Formato } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 300;

const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// PASSO 4 - CAPA: sugere 3 conceitos de thumbnail (com o texto da capa + prompt em ingles).
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let tema = "";
  let roteiro = "";
  let idCanal = "";
  let formato: Formato = "youtube";
  let referencias: { media_type: string; data: string }[] = [];
  try {
    const body = await req.json();
    tema = body.tema || "";
    roteiro = body.roteiro || "";
    idCanal = body.canal || "";
    if (body.formato === "tiktok") formato = "tiktok";
    if (Array.isArray(body.referencias)) {
      referencias = body.referencias
        .filter((r: any) => r && TIPOS_OK.includes(r.media_type) && typeof r.data === "string")
        .slice(0, 3);
    }
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (roteiro.trim().length < 20 && tema.trim().length < 3) {
    return erro("Faltou o roteiro/tema do video pra pensar na capa.");
  }

  const texto = mensagemCapa({
    canalNome: canal.nome,
    canalDescricao: canal.descricao,
    paleta: canal.paleta,
    tema,
    roteiro,
    formato,
    temReferencias: referencias.length > 0,
  });

  const content: any[] = [{ type: "text", text: texto }];
  for (const r of referencias) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: r.media_type, data: r.data },
    });
  }

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Pensando nas capas..." });
    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 4000,
      system: SYSTEM_CAPA,
      messages: [{ role: "user", content }],
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
