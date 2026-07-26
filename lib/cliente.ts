import type { EventoStream, Fonte, MetaFinal } from "./tipos";

export interface Handlers {
  onDelta?: (t: string) => void;
  onStatus?: (m: string) => void;
  onSources?: (items: Fonte[]) => void;
  onDone?: (meta?: MetaFinal) => void;
  onError?: (m: string) => void;
}

// Faz o POST e vai lendo a resposta em streaming (NDJSON), chamando os handlers
// conforme cada evento chega. Devolve true se terminou bem, false se deu erro.
export async function streamFetch(
  url: string,
  body: object,
  senha: string,
  handlers: Handlers,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(senha ? { "x-app-password": senha } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    handlers.onError?.("Sem conexao com o servidor. Tente de novo.");
    return false;
  }

  const tipo = res.headers.get("content-type") || "";
  if (!res.ok && tipo.includes("application/json")) {
    const j = await res.json().catch(() => null);
    handlers.onError?.(j?.error || `Erro ${res.status}.`);
    return false;
  }
  if (!res.body) {
    handlers.onError?.("O servidor nao respondeu.");
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let deuErro = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let quebra: number;
    while ((quebra = buffer.indexOf("\n")) >= 0) {
      const linha = buffer.slice(0, quebra).trim();
      buffer = buffer.slice(quebra + 1);
      if (!linha) continue;

      let ev: EventoStream;
      try {
        ev = JSON.parse(linha);
      } catch {
        continue;
      }

      switch (ev.type) {
        case "delta":
          handlers.onDelta?.(ev.text);
          break;
        case "status":
          handlers.onStatus?.(ev.message);
          break;
        case "sources":
          handlers.onSources?.(ev.items);
          break;
        case "done":
          handlers.onDone?.(ev.meta);
          break;
        case "error":
          deuErro = true;
          handlers.onError?.(ev.message);
          break;
      }
    }
  }

  return !deuErro;
}
