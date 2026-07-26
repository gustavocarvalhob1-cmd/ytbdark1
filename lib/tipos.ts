// Tipos compartilhados entre o backend (rotas) e o frontend (telas).

// Cada linha do streaming (NDJSON) é um destes eventos.
export type EventoStream =
  | { type: "status"; message: string } // "Pesquisando na internet..."
  | { type: "delta"; text: string } // pedaco de texto sendo gerado
  | { type: "sources"; items: Fonte[] } // fontes encontradas na web (passo 1)
  | { type: "done"; meta?: MetaFinal } // fim, com metadados
  | { type: "error"; message: string };

export interface Fonte {
  titulo: string;
  url: string;
}

export interface MetaFinal {
  palavras?: number;
  duracaoSegundos?: number;
  duracaoTexto?: string; // ex: "9 min 30 s"
  clipes?: number;
}

// Um video salvo no historico (fica guardado no navegador).
export interface VideoSalvo {
  canal: string; // id do canal a que este video pertence
  id: string;
  titulo: string;
  data: number; // timestamp
  fonte: string;
  extras: string;
  dossie: string;
  fontes: Fonte[];
  roteiro: string;
  meta: MetaFinal | null;
  prompts: string;
  passoMax: number;
}
