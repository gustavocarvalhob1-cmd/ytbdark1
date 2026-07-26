export type ModoEntrada = "pesquisa" | "livre";

export interface EntradaCanal {
  modo: ModoEntrada; // "pesquisa" = confere fatos; "livre" = desenvolve o tema
  buscaWeb: boolean; // se o Passo 1 usa web_search
  label: string; // rotulo do campo do Passo 1
  placeholder: string; // exemplo dentro do campo
  rotuloBotao: string; // texto do botao do Passo 1
}

export interface PromptsCanal {
  passo1: string; // system do Passo 1 (dossie ou desenvolvimento do tema)
  roteiro: string; // system do roteiro narrado (a voz)
  imagens: string; // system dos prompts de imagem (estilo visual)
}

export interface Canal {
  id: string;
  nome: string;
  emoji: string;
  cor: string; // hex de destaque, ex: "#c99a5b" (aplicado via style inline)
  descricao: string;
  entrada: EntradaCanal;
  prompts: PromptsCanal;
  modelo?: string; // opcional: override do modelo (ex: "claude-sonnet-5")
}
