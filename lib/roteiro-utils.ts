// Funcoes puras, sem "voz" propria: contagem/tempo, fatiamento e montagem das
// mensagens do usuario. Compartilhadas por todos os canais.

import type { Formato } from "./tipos";

export function contarPalavras(texto: string): number {
  const limpo = texto.trim();
  if (!limpo) return 0;
  return limpo.split(/\s+/).length;
}

// 130 palavras por minuto (mesmo ritmo da narracao).
export function estimarSegundos(palavras: number): number {
  return Math.round((palavras / 130) * 60);
}

export function formatarDuracao(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min <= 0) return `${seg} s`;
  return `${min} min ${seg.toString().padStart(2, "0")} s`;
}

function formatarMMSS(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
}

// Divide o roteiro em partes contiguas (por palavras) para gerar os prompts em lotes.
export function fatiarRoteiro(roteiro: string, total: number, indice: number) {
  const palavras = roteiro.trim().split(/\s+/);
  const porParte = Math.ceil(palavras.length / total);
  const inicio = indice * porParte;
  const fim = Math.min(inicio + porParte, palavras.length);
  const trecho = palavras.slice(inicio, fim).join(" ");
  const offsetSegundos = estimarSegundos(inicio);
  const numeroInicial = Math.floor(inicio / 17) + 1; // ~17 palavras por clipe de 8s
  return { trecho, offsetSegundos, numeroInicial };
}

// PASSO 1, modo "pesquisa": o usuario colou uma fonte/assunto para conferir e montar dossie.
export function mensagemPesquisa(material: string): string {
  return `Aqui esta o material. Pesquise na internet, confira e monte o dossie.

===== MATERIAL =====
${material.trim()}
===== FIM DO MATERIAL =====`;
}

// PASSO 1, modo "livre": o usuario deu um tema/frase/historia para desenvolver (sem conferir fatos).
export function mensagemTema(tema: string): string {
  return `Aqui esta o ponto de partida (um tema, uma frase ou uma historia). Desenvolva um material base para virar roteiro: as ideias centrais, exemplos e a mensagem. Nao precisa conferir fatos.

===== PONTO DE PARTIDA =====
${tema.trim()}
===== FIM =====`;
}

export function mensagemRoteiro(dossie: string, extras: string): string {
  const bloco = extras.trim()
    ? `\n\nCITACOES E ARGUMENTOS QUE O USUARIO QUER NO TEXTO (encaixe com naturalidade):\n${extras.trim()}`
    : `\n\nO usuario nao pediu nenhuma citacao ou argumento especifico.`;
  return `Escreva o roteiro narrado a partir deste material. Use so o que esta aqui. Nao invente nada alem disso.

===== MATERIAL =====
${dossie.trim()}
===== FIM DO MATERIAL =====${bloco}`;
}

export function mensagemPrompts(opts: {
  trecho: string;
  offsetSegundos: number;
  numeroInicial: number;
}): string {
  const tempoInicial = formatarMMSS(opts.offsetSegundos);
  return `Gere as cenas SO para este trecho do roteiro. Comece a numeracao em [${opts.numeroInicial}] e os tempos a partir de ${tempoInicial}, somando ate oito segundos por cena a partir dai. Cubra o trecho inteiro, sem deixar buraco.

===== TRECHO DO ROTEIRO =====
${opts.trecho.trim()}
===== FIM DO TRECHO =====`;
}

// Instrucao dinamica de tamanho, a partir da duracao escolhida (clampada 1-20 min).
export function instrucaoDuracao(minutos: number): string {
  const min = Math.max(1, Math.min(20, Math.round(minutos || 0)));
  const alvo = min * 130;
  return `\n\nTAMANHO: este video deve ter cerca de ${min} minuto(s) de narracao, o que da aproximadamente ${alvo} palavras (fique entre ${min * 115} e ${min * 145}). Ajuste a profundidade ao tempo: se for curto, va direto ao essencial, sem enrolar.`;
}

// Ajuste de estilo do roteiro por formato. YouTube = comportamento padrao (vazio).
export function instrucaoFormatoRoteiro(formato: Formato): string {
  if (formato === "tiktok") {
    return `\n\nFORMATO TIKTOK (video curto e vertical): seja direto ao ponto. O gancho tem que prender nos primeiros segundos, sem introducao. Ritmo rapido, frases curtas, cada momento puxando o proximo.`;
  }
  return "";
}

// Orientacao dos prompts de imagem por formato.
export function instrucaoFormatoImagens(formato: Formato): string {
  if (formato === "tiktok") {
    return `\n\nFORMATO DO VIDEO: vertical 9:16 (tela de celular em pe). Componha cada cena para enquadramento vertical, com o foco central. Inclua a expressao "vertical 9:16 aspect ratio" em cada prompt.`;
  }
  return `\n\nFORMATO DO VIDEO: horizontal 16:9 (widescreen). Inclua a expressao "horizontal 16:9 aspect ratio" em cada prompt.`;
}

// PASSO 1 (modo insight): a partir de uma ideia solta, pedir 3 a 5 angulos possiveis.
export function mensagemAngulos(ideia: string, contextoCanal: string): string {
  return `Canal: ${contextoCanal}

Ideia solta do usuario: "${ideia.trim()}"

Proponha de 3 a 5 angulos/caminhos diferentes para virar um video desse canal.`;
}

// Modo insight: confirmar o rumo depois que o usuario escolheu/escreveu um angulo.
export function mensagemDirecao(ideia: string, angulo: string): string {
  return `Ideia: "${ideia.trim()}"
Caminho escolhido: "${angulo.trim()}"

Confirme que entendeu o rumo, num paragrafo curto.`;
}

// Monta a "fonte" que alimenta o Passo 1 depois de o usuario autorizar o rumo.
export function montarFonteInsight(ideia: string, angulo: string, direcao: string): string {
  return `IDEIA: ${ideia.trim()}
CAMINHO ESCOLHIDO: ${angulo.trim()}

RUMO DEFINIDO:
${direcao.trim()}`;
}

// Extrai os angulos (linhas que comecam com numero) do texto que a IA devolveu.
export function parsearAngulos(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\s*[.)\-–:]/.test(l)) // so linhas que comecam com "1." "2)" "3 -" etc.
    .map((l) => l.replace(/^\d+\s*[.)\-–:]\s*/, "").trim()) // tira o prefixo numerico
    .filter((l) => l.length > 0)
    .slice(0, 5);
}
