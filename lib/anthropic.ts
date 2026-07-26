import Anthropic from "@anthropic-ai/sdk";
import type { Fonte } from "./tipos";

// Cria o cliente so quando precisa (a chave de ANTHROPIC_API_KEY so existe em
// tempo de execucao, nao no build). Le a chave do ambiente automaticamente.
let _cliente: Anthropic | null = null;
function cliente(): Anthropic {
  if (!_cliente) _cliente = new Anthropic();
  return _cliente;
}

// Modelo padrao: Opus 4.8 (melhor qualidade de texto em portugues).
// Pode ser trocado por claude-sonnet-5 na variavel de ambiente para gastar menos.
export const MODELO = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

type Emit = (evento: object) => void;

// Roda o Claude em streaming, repassando cada pedaco de texto para o navegador
// (via emit) e avisando quando uma busca na web comeca. Devolve a mensagem final.
export async function gerarComStream(
  emit: Emit,
  params: any,
): Promise<Anthropic.Message> {
  const stream = cliente().messages.stream(params);

  stream.on("streamEvent", (event) => {
    if (event.type === "content_block_start") {
      const bloco: any = event.content_block;
      if (bloco?.type === "server_tool_use" && bloco?.name === "web_search") {
        emit({ type: "status", message: "Pesquisando na internet para conferir os fatos..." });
      }
    }
  });

  stream.on("text", (delta) => {
    emit({ type: "delta", text: delta });
  });

  return stream.finalMessage();
}

// Junta todo o texto (blocos do tipo "text") de uma resposta.
export function textoDe(msg: Anthropic.Message): string {
  return msg.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text as string)
    .join("");
}

// Extrai as fontes (resultados de busca na web) de uma resposta, sem repetir URLs.
export function extrairFontes(msg: Anthropic.Message): Fonte[] {
  const fontes: Fonte[] = [];
  for (const bloco of msg.content as any[]) {
    if (bloco?.type === "web_search_tool_result" && Array.isArray(bloco.content)) {
      for (const r of bloco.content) {
        if (r?.type === "web_search_result" && r.url) {
          fontes.push({ titulo: r.title || r.url, url: r.url });
        }
      }
    }
  }
  const vistos = new Set<string>();
  return fontes.filter((f) => (vistos.has(f.url) ? false : (vistos.add(f.url), true)));
}
