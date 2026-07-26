# Fundação Multi-canal — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o Estudio Dark de "uma voz fixa" para "3 canais" (perfis com voz, fluxo e visual próprios), com seletor de canal na UI e histórico separado por canal.

**Architecture:** Cada canal vira um perfil em código (`lib/canais/<id>.ts`) implementando a interface `Canal`. As funções puras saem de `lib/voz.ts` para `lib/roteiro-utils.ts`. As rotas de API passam a receber `canal` no corpo e usam os prompts daquele perfil. O frontend ganha um seletor de canal, guarda o canal ativo e filtra o histórico por canal.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18, TypeScript, Tailwind, `@anthropic-ai/sdk`, Vitest (novo, para testes das partes puras).

## Global Constraints

- Node 24, Next.js 14 (App Router), TypeScript estrito, Tailwind. **Não** subir versões.
- Todo texto de UI e todos os prompts em **português do Brasil**.
- Modelo padrão vem de `MODELO` (`lib/anthropic.ts`): `process.env.ANTHROPIC_MODEL || "claude-opus-4-8"`. Cada canal pode ter override via `canal.modelo`.
- Streaming NDJSON (`lib/stream.ts`) e auth por `APP_PASSWORD` (`lib/auth.ts`) são **preservados sem alteração**.
- Persistência do histórico continua em **localStorage** nesta fase; o formato guarda `canal` para migração futura a banco. **Nada** de banco/narração/vídeo/publicação aqui (YAGNI).
- Não quebrar o fluxo atual: os 3 passos (Fonte → Roteiro → Imagens) continuam funcionando.
- Ferramenta de busca da Anthropic: `{ type: "web_search_20260209", name: "web_search", max_uses: 6 }` (valor copiado da rota atual).

---

## Task 1: Preparação — Git local e Vitest

**Files:**
- Modify: `package.json` (adicionar devDeps e script `test`)
- Create: `vitest.config.ts`
- Create: `lib/roteiro-utils.test.ts` (teste smoke temporário)

**Interfaces:**
- Produces: infraestrutura de testes (`npm test`) e repositório Git local para commits das próximas tarefas.

- [ ] **Step 1: Inicializar o Git local** (o projeto ainda não é um repositório)

```bash
git init
git add -A
git commit -m "chore: estado inicial recuperado do Vercel (antes do multi-canal)"
```
Expected: repositório criado, primeiro commit feito. (O `.gitignore` já existe e protege `.env.local`, `node_modules`, `TOKEN-VERCEL.txt`.)

- [ ] **Step 2: Instalar o Vitest**

```bash
npm install -D vitest@^2
```
Expected: `vitest` aparece em `devDependencies`.

- [ ] **Step 3: Adicionar o script de teste no `package.json`**

No bloco `"scripts"`, adicionar a linha `"test"`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run"
}
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Criar um teste smoke temporário** (`lib/roteiro-utils.test.ts`)

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("roda", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test`
Expected: 1 teste passa.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/roteiro-utils.test.ts
git commit -m "chore: configurar Vitest para testes das partes puras"
```

---

## Task 2: Utils neutros em `lib/roteiro-utils.ts`

Migra as funções puras de `lib/voz.ts` (que não são específicas de voz) e adiciona as duas montagens de mensagem do Passo 1 (pesquisa e tema livre). O `voz.ts` continua existindo por enquanto — será removido na Task 11.

**Files:**
- Create: `lib/roteiro-utils.ts`
- Modify: `lib/roteiro-utils.test.ts` (substituir o smoke por testes reais)

**Interfaces:**
- Produces:
  - `contarPalavras(texto: string): number`
  - `estimarSegundos(palavras: number): number`
  - `formatarDuracao(segundos: number): string`
  - `fatiarRoteiro(roteiro: string, total: number, indice: number): { trecho: string; offsetSegundos: number; numeroInicial: number }`
  - `mensagemPesquisa(material: string): string` — mensagem do usuário para o Passo 1 no modo `pesquisa`
  - `mensagemTema(tema: string): string` — mensagem do usuário para o Passo 1 no modo `livre`
  - `mensagemRoteiro(dossie: string, extras: string): string`
  - `mensagemPrompts(opts: { trecho: string; offsetSegundos: number; numeroInicial: number }): string`

- [ ] **Step 1: Escrever os testes** (`lib/roteiro-utils.test.ts`, substituindo o smoke)

```ts
import { describe, it, expect } from "vitest";
import {
  contarPalavras,
  estimarSegundos,
  fatiarRoteiro,
  mensagemTema,
  mensagemPesquisa,
} from "./roteiro-utils";

describe("contarPalavras", () => {
  it("conta palavras separadas por espaco", () => {
    expect(contarPalavras("um dois tres")).toBe(3);
  });
  it("texto vazio conta zero", () => {
    expect(contarPalavras("   ")).toBe(0);
  });
});

describe("estimarSegundos", () => {
  it("usa 130 palavras por minuto", () => {
    expect(estimarSegundos(130)).toBe(60);
  });
});

describe("fatiarRoteiro", () => {
  it("divide o roteiro em partes contiguas e cobre tudo", () => {
    const roteiro = Array.from({ length: 40 }, (_, i) => `p${i}`).join(" ");
    const p0 = fatiarRoteiro(roteiro, 2, 0);
    const p1 = fatiarRoteiro(roteiro, 2, 1);
    expect(`${p0.trecho} ${p1.trecho}`.split(/\s+/)).toHaveLength(40);
    expect(p0.numeroInicial).toBe(1);
  });
});

describe("mensagemPesquisa / mensagemTema", () => {
  it("a mensagem de pesquisa inclui o material", () => {
    expect(mensagemPesquisa("caso X")).toContain("caso X");
  });
  it("a mensagem de tema inclui o tema e nao fala em conferir fatos", () => {
    const m = mensagemTema("resiliencia");
    expect(m).toContain("resiliencia");
    expect(m.toLowerCase()).not.toContain("confira os fatos");
  });
});
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

Run: `npm test`
Expected: FAIL (módulo `./roteiro-utils` não existe).

- [ ] **Step 3: Criar `lib/roteiro-utils.ts`**

```ts
// Funcoes puras, sem "voz" propria: contagem/tempo, fatiamento e montagem das
// mensagens do usuario. Compartilhadas por todos os canais.

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
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/roteiro-utils.ts lib/roteiro-utils.test.ts
git commit -m "feat: extrair utils neutros de roteiro em lib/roteiro-utils"
```

---

## Task 3: Interface `Canal` e registro de canais

Cria o tipo `Canal` e o registro (`getCanal`). Os arquivos de perfil dos 3 canais são criados nas Tasks 4-6; nesta task, o `index.ts` importa os três, então as Tasks 4-6 apenas preenchem os perfis. Para o registro compilar e ser testável já aqui, criamos os três arquivos com um esqueleto mínimo e completamos nas próximas tasks.

**Files:**
- Create: `lib/canais/tipos.ts`
- Create: `lib/canais/index.ts`
- Create: `lib/canais/historia-brasil.ts` (esqueleto — completado na Task 4)
- Create: `lib/canais/conspiracoes.ts` (esqueleto — completado na Task 5)
- Create: `lib/canais/inspiracional.ts` (esqueleto — completado na Task 6)
- Create: `lib/canais/index.test.ts`

**Interfaces:**
- Produces:
  - Tipos `ModoEntrada`, `EntradaCanal`, `PromptsCanal`, `Canal`
  - `CANAIS: Canal[]`, `CANAL_PADRAO: Canal`
  - `getCanal(id: string | null | undefined): Canal | undefined`
- Consumes: nada.

- [ ] **Step 1: Escrever o teste do registro** (`lib/canais/index.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { CANAIS, CANAL_PADRAO, getCanal } from "./index";

describe("registro de canais", () => {
  it("tem exatamente 3 canais com ids unicos", () => {
    const ids = CANAIS.map((c) => c.id);
    expect(ids).toEqual(["historia-brasil", "conspiracoes", "inspiracional"]);
    expect(new Set(ids).size).toBe(3);
  });
  it("getCanal encontra por id", () => {
    expect(getCanal("conspiracoes")?.id).toBe("conspiracoes");
  });
  it("getCanal devolve undefined para id invalido ou vazio", () => {
    expect(getCanal("nao-existe")).toBeUndefined();
    expect(getCanal(undefined)).toBeUndefined();
    expect(getCanal("")).toBeUndefined();
  });
  it("o canal padrao e o primeiro (historia-brasil)", () => {
    expect(CANAL_PADRAO.id).toBe("historia-brasil");
  });
});
```

- [ ] **Step 2: Criar `lib/canais/tipos.ts`**

```ts
export type ModoEntrada = "pesquisa" | "livre";

export interface EntradaCanal {
  modo: ModoEntrada;      // "pesquisa" = confere fatos; "livre" = desenvolve o tema
  buscaWeb: boolean;      // se o Passo 1 usa web_search
  label: string;          // rotulo do campo do Passo 1
  placeholder: string;    // exemplo dentro do campo
  rotuloBotao: string;    // texto do botao do Passo 1
}

export interface PromptsCanal {
  passo1: string;   // system do Passo 1 (dossie ou desenvolvimento do tema)
  roteiro: string;  // system do roteiro narrado (a voz)
  imagens: string;  // system dos prompts de imagem (estilo visual)
}

export interface Canal {
  id: string;
  nome: string;
  emoji: string;
  cor: string;       // hex de destaque, ex: "#c99a5b" (aplicado via style inline)
  descricao: string;
  entrada: EntradaCanal;
  prompts: PromptsCanal;
  modelo?: string;   // opcional: override do modelo (ex: "claude-sonnet-5")
}
```

- [ ] **Step 3: Criar os 3 esqueletos de canal**

`lib/canais/historia-brasil.ts`:
```ts
import { Canal } from "./tipos";

export const historiaBrasil: Canal = {
  id: "historia-brasil",
  nome: "História do Brasil",
  emoji: "🇧🇷",
  cor: "#c99a5b",
  descricao: "Narrativa factual, contação de história",
  entrada: {
    modo: "pesquisa",
    buscaWeb: true,
    label: "Fonte da informação (transcrição, link ou notícia)",
    placeholder: "Cole aqui a transcrição, o link ou o texto da notícia...",
    rotuloBotao: "Verificar fatos e pesquisar",
  },
  prompts: {
    passo1: "PLACEHOLDER — completado na Task 4",
    roteiro: "PLACEHOLDER — completado na Task 4",
    imagens: "PLACEHOLDER — completado na Task 4",
  },
};
```

`lib/canais/conspiracoes.ts`:
```ts
import { Canal } from "./tipos";

export const conspiracoes: Canal = {
  id: "conspiracoes",
  nome: "Conspirações",
  emoji: "🕵️",
  cor: "#8a7fd6",
  descricao: "Suspense investigativo e honesto",
  entrada: {
    modo: "pesquisa",
    buscaWeb: true,
    label: "Assunto ou teoria que você quer investigar",
    placeholder: "Ex.: o que há por trás de tal acontecimento, uma teoria que você quer explorar...",
    rotuloBotao: "Investigar e separar fato de teoria",
  },
  prompts: {
    passo1: "PLACEHOLDER — completado na Task 5",
    roteiro: "PLACEHOLDER — completado na Task 5",
    imagens: "PLACEHOLDER — completado na Task 5",
  },
};
```

`lib/canais/inspiracional.ts`:
```ts
import { Canal } from "./tipos";

export const inspiracional: Canal = {
  id: "inspiracional",
  nome: "Inspiracional",
  emoji: "🌅",
  cor: "#e0a44a",
  descricao: "Motivacional, desenvolvimento pessoal",
  entrada: {
    modo: "livre",
    buscaWeb: true,
    label: "O que você quer passar nesse vídeo?",
    placeholder: "Um tema, uma frase, uma citação ou uma história. Ex.: a arte de recomeçar...",
    rotuloBotao: "Desenvolver o tema",
  },
  prompts: {
    passo1: "PLACEHOLDER — completado na Task 6",
    roteiro: "PLACEHOLDER — completado na Task 6",
    imagens: "PLACEHOLDER — completado na Task 6",
  },
};
```

> Nota: os `PLACEHOLDER` aqui são esqueletos que as Tasks 4-6 substituem pelos prompts reais. O teste do Step 1 (que exige `length > 50`) só passa depois da Task 4-6; por isso o Step 5 abaixo roda apenas o teste de estrutura de ids, e o teste de prompts fica verde ao fim da Task 6.

- [ ] **Step 4: Criar `lib/canais/index.ts`**

```ts
import { Canal } from "./tipos";
import { historiaBrasil } from "./historia-brasil";
import { conspiracoes } from "./conspiracoes";
import { inspiracional } from "./inspiracional";

export * from "./tipos";

export const CANAIS: Canal[] = [historiaBrasil, conspiracoes, inspiracional];

const PORID: Record<string, Canal> = Object.fromEntries(CANAIS.map((c) => [c.id, c]));

export const CANAL_PADRAO: Canal = CANAIS[0];

export function getCanal(id: string | null | undefined): Canal | undefined {
  if (!id) return undefined;
  return PORID[id];
}
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: PASS (ids, getCanal, padrão). O teste que verifica o conteúdo dos prompts será adicionado na Task 6, quando os 3 canais já tiverem suas vozes.

- [ ] **Step 6: Commit**

```bash
git add lib/canais/
git commit -m "feat: interface Canal e registro (getCanal) com esqueletos dos 3 canais"
```

---

## Task 4: Voz do canal História do Brasil

Preenche os prompts de `historia-brasil.ts`. A voz é a atual do `lib/voz.ts` (que já é factual/narrativa), então os prompts abaixo são os textos atuais de `SYSTEM_FONTE`, `SYSTEM_ROTEIRO` e `SYSTEM_PROMPTS`, copiados verbatim, mais uma linha de identidade do canal.

**Files:**
- Modify: `lib/canais/historia-brasil.ts` (trocar os 3 PLACEHOLDER)

**Interfaces:**
- Consumes: `Canal` (Task 3).

- [ ] **Step 1: Copiar os prompts atuais para o canal**

Abrir `lib/voz.ts` e copiar o **conteúdo exato** das constantes `SYSTEM_FONTE`, `SYSTEM_ROTEIRO` e `SYSTEM_PROMPTS` para os campos `prompts.passo1`, `prompts.roteiro` e `prompts.imagens` respectivamente. No `prompts.roteiro`, acrescentar no início a linha de identidade:

> `Voce escreve para um canal de HISTORIA DO BRASIL: episodios reais do passado do pais, contados como historia envolvente.`

E no `prompts.imagens`, acrescentar no início:

> `Estilo visual do canal: tom sepia, cores terrosas, textura de epoca, atmosfera de arquivo historico. Mantenha essa paleta em todas as cenas.`

- [ ] **Step 2: Rodar o teste de prompts**

Run: `npm test -- lib/canais/index.test.ts`
Expected: o teste "todo canal tem os 3 prompts preenchidos" ainda FALHA (conspirações e inspiracional ainda são PLACEHOLDER), mas o build/TS de historia-brasil está válido. Seguir para as próximas tasks.

- [ ] **Step 3: Commit**

```bash
git add lib/canais/historia-brasil.ts
git commit -m "feat: voz do canal Historia do Brasil"
```

---

## Task 5: Voz do canal Conspirações

**Files:**
- Modify: `lib/canais/conspiracoes.ts` (trocar os 3 PLACEHOLDER)

- [ ] **Step 1: Preencher `prompts.passo1`** (dossiê que separa fato de especulação)

```
Voce e um pesquisador que prepara material para videos de um canal de CONSPIRACOES E MISTERIOS. Voce recebe um assunto ou uma teoria e monta um dossie honesto para virar roteiro.

O que voce faz:
1. Pesquisa na internet o que existe sobre o assunto, de varios angulos.
2. Separa com clareza tres coisas: o que e FATO confirmado, o que e ALEGACAO/teoria (quem diz, sem prova solida) e o que ja foi DESMENTIDO.
3. Encontra os detalhes que deixam a historia intrigante (coincidencias, lacunas, perguntas em aberto), sem inventar nada.

Regras que valem sempre:
- Nunca apresente teoria como se fosse fato. Marque sempre "isso e confirmado" vs "isso e especulacao".
- Nunca invente numero, data, nome, documento ou fonte.
- Nao acuse pessoas reais de crime sem prova. Fale em "ha quem levante a hipotese", nao em certezas.
- Nao narre seu processo. Nao use markdown. Titulos em MAIUSCULAS simples.

Formato da saida (material interno, pode ter titulos):

TEMA
Uma linha sobre o misterio/assunto.

O QUE E FATO
O que esta confirmado, com contexto.

O QUE E TEORIA (E QUEM DIZ)
As hipoteses e alegacoes, sempre marcando que sao especulacao e de onde vem.

O QUE JA FOI DESMENTIDO
Pontos que a pesquisa mostrou serem falsos, para o roteiro nao repetir.

GANCHOS DE SUSPENSE
Duas ou tres perguntas/lacunas intrigantes para abrir o video.

Escreva em portugues do Brasil.
```

- [ ] **Step 2: Preencher `prompts.roteiro`** (voz de suspense equilibrada)

```
Voce escreve roteiros narrados para um canal de CONSPIRACOES E MISTERIOS. O texto vai ser lido em voz alta. Ele precisa criar suspense e intriga, prendendo o espectador, MAS sem afirmar mentira como verdade.

COMO VOCE ESCREVE
- Frases curtas, com espaco para respirar. Cria tensao e curiosidade.
- Texto corrido do comeco ao fim. Sem titulo, topico, lista ou marcador de secao (a narracao le tudo em voz alta).
- Tom de quem esta te contando algo perturbador em voz baixa, do seu lado. Nao de autoridade.
- Use as contracoes naturais da fala: ta, ne, pra, pro, to. Onde precisa respirar, use reticencias.
- Numeros por extenso quando falados.

HONESTIDADE (o que protege o canal)
- Quando algo e teoria, deixe claro na propria narracao: "ha quem diga que...", "nao ha prova, mas...", "oficialmente foi assim, so que...".
- Nunca acuse pessoa real de crime como fato. Nunca invente dado, documento ou fonte.
- Use so o que esta no material. Separe o que e fato do que e especulacao, como o material separou.

O QUE VOCE NUNCA FAZ
- Nunca usa travessao. Se precisar separar, comeca outra frase.
- Nunca deixa cara de texto de IA. Proibido: "no mundo de hoje", "vamos mergulhar", "e importante notar", "em conclusao", "prepare-se", "curiosamente", e aberturas genericas tipo "voce ja parou pra pensar".
- Nao usa dado complexo nem analogia rebuscada.

ESTRUTURA INVISIVEL
Comece com um gancho forte nos primeiros quinze a trinta segundos (uma pergunta perturbadora, uma coincidencia estranha). Desenvolva como uma investigacao, uma pista levando a outra. Tenha uma virada perto do fim. Feche deixando uma pergunta no ar, sem soar como "concluindo".

TAMANHO
Entre 1040 e 1560 palavras (video de oito a doze minutos a 130 palavras por minuto).

ENTREGA
Entregue SO o texto do roteiro. Sem titulo, sem comentario, sem contagem de palavras.
```

- [ ] **Step 3: Preencher `prompts.imagens`** (mesmo formato do atual `SYSTEM_PROMPTS`, com estilo sombrio)

Copiar o conteúdo de `SYSTEM_PROMPTS` de `lib/voz.ts` e acrescentar no início:
> `Estilo visual do canal: sombrio, alto contraste, sombras densas, clima noir e tenso, mistério. Mantenha essa paleta em todas as cenas.`

- [ ] **Step 4: Commit**

```bash
git add lib/canais/conspiracoes.ts
git commit -m "feat: voz do canal Conspiracoes (suspense equilibrado, separa fato de teoria)"
```

---

## Task 6: Voz do canal Inspiracional

**Files:**
- Modify: `lib/canais/inspiracional.ts` (trocar os 3 PLACEHOLDER)

- [ ] **Step 1: Preencher `prompts.passo1`** (desenvolve o tema, sem conferir fatos)

```
Voce prepara o material base para videos de um canal INSPIRACIONAL / DESENVOLVIMENTO PESSOAL. Voce recebe um ponto de partida livre (um tema, uma frase, uma citacao ou uma historia) e desenvolve o material que vai virar roteiro.

O que voce faz:
1. Entende a mensagem central que o ponto de partida quer passar.
2. Desenvolve as ideias: os pontos principais, uma progressao emocional, e uma ou duas historias/exemplos reais que ilustrem (pode buscar na internet historias e exemplos verdadeiros para enriquecer, mas eles servem para ILUSTRAR, nunca vire uma reportagem que "confere fatos").
3. Aponta a virada e a mensagem final que fica.

Regras:
- O foco e a mensagem, nao a checagem. Nao precisa "conferir se e verdade"; precisa ser inspirador e honesto.
- Se usar uma historia real, nao invente detalhes que nao encontrou. Se for exemplo generico, deixe generico.
- Nao narre seu processo. Nao use markdown. Titulos em MAIUSCULAS simples.

Formato da saida:

MENSAGEM CENTRAL
Uma linha com a ideia que o video defende.

PONTOS PRINCIPAIS
Os tres ou quatro movimentos da ideia, em ordem.

HISTORIAS E EXEMPLOS
Uma ou duas historias/exemplos que ilustram (reais quando possivel).

VIRADA E FECHAMENTO
A virada emocional e a mensagem que fica no fim.

Escreva em portugues do Brasil.
```

- [ ] **Step 2: Preencher `prompts.roteiro`** (voz calorosa/motivacional)

```
Voce escreve roteiros narrados para um canal INSPIRACIONAL / DESENVOLVIMENTO PESSOAL. O texto vai ser lido em voz alta. Ele precisa acolher, encorajar e mover o espectador, como uma conversa de coracao que levanta a pessoa.

COMO VOCE ESCREVE
- Frases curtas e com respiro. Ritmo que emociona sem ser piegas.
- Texto corrido do comeco ao fim. Sem titulo, topico, lista ou marcador de secao (a narracao le tudo em voz alta).
- Tom caloroso e proximo, de quem esta do seu lado torcendo por voce. Fala "com" a pessoa, nunca "de cima".
- Use as contracoes naturais da fala: ta, ne, pra, pro, to. Onde precisa respirar, use reticencias.
- Numeros por extenso quando falados.
- Pode repetir uma ideia de proposito para fixar a mensagem.

O QUE VOCE NUNCA FAZ
- Nunca usa travessao. Se precisar separar, comeca outra frase.
- Nunca deixa cara de texto de IA nem autoajuda vazia. Proibido: "no mundo de hoje", "vamos mergulhar", "e importante notar", "em conclusao", "prepare-se", "curiosamente", e aberturas genericas tipo "voce ja parou pra pensar", "hoje em dia".
- Nao promete milagre nem da conselho medico. Encoraja de forma honesta e pe no chao.
- Usa so o que esta no material. Nao inventa historia real nem dado.

ESTRUTURA INVISIVEL
Comece com um gancho que toque uma dor ou um desejo comum, nos primeiros quinze a trinta segundos. Desenvolva como uma jornada emocional, uma ideia levando a outra, com uma historia no meio. Tenha uma virada que traga esperanca. Feche com uma mensagem forte que fique com a pessoa, sem soar como "concluindo".

TAMANHO
Entre 1040 e 1560 palavras (video de oito a doze minutos a 130 palavras por minuto).

ENTREGA
Entregue SO o texto do roteiro. Sem titulo, sem comentario, sem contagem de palavras.
```

- [ ] **Step 3: Preencher `prompts.imagens`**

Copiar o conteúdo de `SYSTEM_PROMPTS` de `lib/voz.ts` e acrescentar no início:
> `Estilo visual do canal: luz suave, amanhecer, natureza, tons quentes, sensacao de esperanca e de movimento pra frente. Mantenha essa paleta em todas as cenas.`

- [ ] **Step 4: Adicionar o teste de conteúdo dos prompts** (`lib/canais/index.test.ts`)

Agora que os 3 canais têm vozes, adicionar dentro do `describe("registro de canais", ...)`:
```ts
  it("todo canal tem os 3 prompts preenchidos", () => {
    for (const c of CANAIS) {
      expect(c.prompts.passo1.length).toBeGreaterThan(50);
      expect(c.prompts.roteiro.length).toBeGreaterThan(50);
      expect(c.prompts.imagens.length).toBeGreaterThan(50);
    }
  });
```

- [ ] **Step 5: Rodar todos os testes**

Run: `npm test`
Expected: PASS em tudo, incluindo o novo teste de conteúdo dos prompts.

- [ ] **Step 6: Commit**

```bash
git add lib/canais/inspiracional.ts lib/canais/index.test.ts
git commit -m "feat: voz do canal Inspiracional (campo livre, tom motivacional)"
```

---

## Task 7: Campo `canal` em VideoSalvo + rota do Passo 1 multi-canal

**Files:**
- Modify: `lib/tipos.ts` (adicionar `canal` em `VideoSalvo`)
- Modify: `app/api/fonte/route.ts`

**Interfaces:**
- Consumes: `getCanal` (Task 3), `mensagemPesquisa`/`mensagemTema` (Task 2), `gerarComStream`/`extrairFontes`/`MODELO` (`lib/anthropic.ts`).
- Produces: rota `/api/fonte` que aceita `{ canal, fonte }` no corpo.

- [ ] **Step 1: Adicionar `canal` em `VideoSalvo`** (`lib/tipos.ts`)

No `interface VideoSalvo`, adicionar como primeiro campo:
```ts
  canal: string;   // id do canal a que este video pertence
```

- [ ] **Step 2: Reescrever `app/api/fonte/route.ts`**

```ts
import { NextRequest } from "next/server";
import { MODELO, gerarComStream, extrairFontes } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemPesquisa, mensagemTema } from "@/lib/roteiro-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

// PASSO 1: monta o material base (dossie de pesquisa OU desenvolvimento de tema), por canal.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let fonte = "";
  let idCanal = "";
  try {
    const body = await req.json();
    fonte = body.fonte || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");

  if (!fonte || typeof fonte !== "string" || fonte.trim().length < 20) {
    return erro("Escreva um pouco mais de texto para comecar.");
  }

  const usaWeb = canal.entrada.buscaWeb;
  const mensagem =
    canal.entrada.modo === "livre" ? mensagemTema(fonte) : mensagemPesquisa(fonte);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Lendo e preparando o material..." });

    const msg = await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: canal.prompts.passo1,
      ...(usaWeb
        ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] }
        : {}),
      messages: [{ role: "user", content: mensagem }],
    });

    if (usaWeb) {
      const fontes = extrairFontes(msg);
      if (fontes.length) emit({ type: "sources", items: fontes });
    }
    emit({ type: "done" });
  });
}

function erro(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build sem erros de tipo. (Se `output_config`/`thinking` acusarem tipo, manter como no arquivo original — eles já eram usados lá.)

- [ ] **Step 4: Commit**

```bash
git add lib/tipos.ts app/api/fonte/route.ts
git commit -m "feat: rota do Passo 1 por canal (+ campo canal em VideoSalvo)"
```

---

## Task 8: Rotas de Roteiro e Prompts multi-canal

**Files:**
- Modify: `app/api/roteiro/route.ts`
- Modify: `app/api/prompts/route.ts`

**Interfaces:**
- Consumes: `getCanal`, `mensagemRoteiro`/`mensagemPrompts`/`contarPalavras`/`estimarSegundos`/`formatarDuracao`/`fatiarRoteiro` (Task 2).
- Produces: rotas que aceitam `canal` no corpo.

- [ ] **Step 1: Reescrever `app/api/roteiro/route.ts`**

Trocar os imports de `@/lib/voz` por `@/lib/roteiro-utils` e `@/lib/canais`, e usar o canal:
```ts
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
} from "@/lib/roteiro-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let dossie = "";
  let extras = "";
  let idCanal = "";
  try {
    const body = await req.json();
    dossie = body.dossie || "";
    extras = body.extras || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!dossie || dossie.trim().length < 20) return erro("Faltou o material do Passo 1.");

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Escrevendo o roteiro na voz do canal..." });

    const msg = await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 6000,
      system: canal.prompts.roteiro,
      messages: [{ role: "user", content: mensagemRoteiro(dossie, extras) }],
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
```

- [ ] **Step 2: Reescrever `app/api/prompts/route.ts`**

```ts
import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemPrompts, fatiarRoteiro } from "@/lib/roteiro-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let roteiro = "";
  let indice = 0;
  let total = 1;
  let idCanal = "";
  try {
    const body = await req.json();
    roteiro = body.roteiro || "";
    indice = Number.isInteger(body.indice) ? body.indice : 0;
    total = Number.isInteger(body.total) && body.total > 0 ? body.total : 1;
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!roteiro || roteiro.trim().length < 20) return erro("Faltou o roteiro do Passo 2.");

  const { trecho, offsetSegundos, numeroInicial } = fatiarRoteiro(roteiro, total, indice);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: `Montando as cenas (parte ${indice + 1} de ${total})...` });

    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 8000,
      system: canal.prompts.imagens,
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
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/roteiro/route.ts app/api/prompts/route.ts
git commit -m "feat: rotas de roteiro e prompts por canal"
```

---

## Task 9: Frontend — seletor de canal e `canal` nas chamadas

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `CANAIS`, `CANAL_PADRAO` de `@/lib/canais`.
- Produces: estado `canalAtivo` guardado em localStorage; `canal` incluído no corpo das 3 chamadas `streamFetch`.

- [ ] **Step 1: Importar os canais e criar a chave de storage**

No topo de `app/page.tsx`, adicionar aos imports:
```ts
import { CANAIS, CANAL_PADRAO } from "@/lib/canais";
```
E junto das outras constantes `CHAVE_*`:
```ts
const CHAVE_CANAL = "estudio-dark-canal";
```

- [ ] **Step 2: Adicionar estado do canal ativo**

Logo após os estados de login (perto de `const [passo, setPasso] ...`):
```ts
const [canalAtivo, setCanalAtivo] = useState<string>(CANAL_PADRAO.id);
```
E no `useEffect` de abertura (o que roda `[]`), ler o canal salvo:
```ts
const canalSalvo = localStorage.getItem(CHAVE_CANAL);
if (canalSalvo && CANAIS.some((c) => c.id === canalSalvo)) setCanalAtivo(canalSalvo);
```

- [ ] **Step 3: Incluir `canal` no corpo das 3 chamadas**

Em `rodarPasso1`, trocar o corpo:
```ts
const ok = await streamFetch("/api/fonte", { fonte, canal: canalAtivo }, senha, {
```
Em `rodarPasso2`:
```ts
const ok = await streamFetch("/api/roteiro", { dossie, extras, canal: canalAtivo }, senha, {
```
Em `rodarPasso3` (dentro do loop):
```ts
const ok = await streamFetch(
  "/api/prompts",
  { roteiro, indice: i, total: totalLotes, canal: canalAtivo },
  senha,
  {
```
E adicionar `canalAtivo` às dependências dos três `useCallback` (`[..., canalAtivo]`).

- [ ] **Step 4: Adicionar o seletor de canal no cabeçalho**

Logo abaixo do `<header>` (antes da "barra do historico"), inserir:
```tsx
{/* seletor de canal */}
<div className="flex flex-wrap gap-2 pb-3">
  {CANAIS.map((c) => {
    const ativo = c.id === canalAtivo;
    return (
      <button
        key={c.id}
        onClick={() => trocarCanal(c.id)}
        style={ativo ? { borderColor: c.cor, color: c.cor } : undefined}
        className={[
          "text-sm rounded-lg px-3 py-2 border transition",
          ativo ? "bg-painel font-semibold" : "border-borda text-suave hover:text-texto",
        ].join(" ")}
      >
        <span className="mr-1">{c.emoji}</span>
        {c.nome}
      </button>
    );
  })}
</div>
```

- [ ] **Step 5: Criar a função `trocarCanal`** (perto de `novoVideo`)

```ts
function trocarCanal(id: string) {
  if (id === canalAtivo) return;
  setCanalAtivo(id);
  try {
    localStorage.setItem(CHAVE_CANAL, id);
  } catch {
    /* ignora */
  }
  novoVideo(); // comeca um video novo no canal escolhido
}
```

- [ ] **Step 6: Verificar no navegador** (sem teste automatizado de UI)

Run: `npm run dev` e abrir http://localhost:3000
Expected: os 3 botões de canal aparecem no topo; clicar troca o destaque; ao gerar, a rede mostra `canal` no corpo do POST (checar em Network). Ainda não filtra histórico — próxima task.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: seletor de canal na UI e canal no corpo das chamadas"
```

---

## Task 10: Frontend — histórico por canal e Passo 1 adaptável

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `canalAtivo`, `CANAIS`, `getCanal` (via lookup local).
- Produces: histórico filtrado por canal; cada `VideoSalvo` grava `canal`; rótulos do Passo 1 vindos do canal.

- [ ] **Step 1: Gravar `canal` ao salvar o vídeo**

No `useEffect` que salva o histórico, no objeto `atual: VideoSalvo`, adicionar `canal: canalAtivo`:
```ts
const atual: VideoSalvo = {
  canal: canalAtivo,
  id: idAtual,
  // ...resto igual
};
```
E adicionar `canalAtivo` ao array de dependências desse `useEffect`.

- [ ] **Step 2: Derivar o histórico visível do canal ativo**

Logo antes do `return` da tela principal, criar:
```ts
const historicoDoCanal = historico.filter((v) => (v.canal || CANAL_PADRAO.id) === canalAtivo);
```
E no JSX, trocar **todas** as referências de `historico` da barra/lista por `historicoDoCanal`:
- a condição `historico.length > 0` → `historicoDoCanal.length > 0`
- o texto `Meus videos ({historico.length})` → `({historicoDoCanal.length})`
- o `.map` da lista → `historicoDoCanal.map(...)`

(O `historico` completo continua sendo a fonte de verdade salva; só a exibição filtra.)

- [ ] **Step 3: Adaptar os rótulos do Passo 1 ao canal**

Criar, perto de `historicoDoCanal`:
```ts
const canalObj = CANAIS.find((c) => c.id === canalAtivo) || CANAL_PADRAO;
```
No JSX do Passo 1, trocar o texto fixo do `<label>` e o `placeholder` do primeiro `<textarea>`:
```tsx
<label className="text-sm text-suave">{canalObj.entrada.label}</label>
```
```tsx
placeholder={canalObj.entrada.placeholder}
```
E o texto do botão do Passo 1:
```tsx
{carregando1 ? "Trabalhando..." : canalObj.entrada.rotuloBotao}
```
No modo `livre` (Inspiracional), o rótulo "Dossie verificado" do resultado do Passo 1 fica estranho; trocar o `titulo` do `<Resultado>` do Passo 1 por:
```tsx
titulo={canalObj.entrada.modo === "livre" ? "Material do tema" : "Dossie verificado"}
```

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev`
Expected:
- Trocar de canal esvazia a tela e mostra só o histórico daquele canal.
- No Inspiracional, o Passo 1 mostra "O que você quer passar nesse vídeo?" e o botão "Desenvolver o tema".
- Gerar um vídeo em um canal e outro em outro: cada um só aparece no histórico do seu canal.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: historico por canal e Passo 1 adaptavel ao canal"
```

---

## Task 11: Remover `lib/voz.ts` e verificação final

**Files:**
- Delete: `lib/voz.ts`
- Verify: nenhum import remanescente de `@/lib/voz`

**Interfaces:**
- Consumes: tudo já migrado (Tasks 2, 4-6).

- [ ] **Step 1: Confirmar que ninguém mais importa `@/lib/voz`**

Run (Grep/busca no projeto): procurar `lib/voz`
Expected: nenhum resultado em `app/` ou `lib/` (todos migraram para `roteiro-utils` e `canais`).

- [ ] **Step 2: Apagar o arquivo**

```bash
git rm lib/voz.ts
```

- [ ] **Step 3: Build + testes completos**

Run: `npm run build && npm test`
Expected: build sem erros; todos os testes passam.

- [ ] **Step 4: Verificação manual ponta a ponta no navegador**

Run: `npm run dev`
Checklist:
- [ ] Os 3 canais aparecem e trocam.
- [ ] História do Brasil: Passo 1 pesquisa e monta dossiê; roteiro sai narrativo.
- [ ] Conspirações: Passo 1 separa "fato" de "teoria"; roteiro cria suspense honesto.
- [ ] Inspiracional: Passo 1 aceita tema livre (sem exigir fonte) e desenvolve; roteiro sai motivacional.
- [ ] Histórico separado por canal.
- [ ] Nada do fluxo antigo quebrou (copiar/baixar/gerar de novo funcionam).

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: remover lib/voz.ts (migrado para canais + roteiro-utils)"
```

---

## Notas de execução

- **Prompts são pontos de iteração.** Os textos das vozes (Tasks 4-6) são um bom ponto de partida; depois de ver os primeiros vídeos, o Gustavo vai querer afiná-los — todos estão isolados em `lib/canais/<id>.ts`, fáceis de ajustar.
- **Ordem importa:** Tasks 1-6 são "por baixo" (sem mudança visível); 7-11 ligam tudo à UI. O primeiro resultado visível na tela aparece na Task 9.
- **Deploy:** ao publicar no Vercel depois, nada de novo é necessário no ambiente (mesmas variáveis `ANTHROPIC_API_KEY` / `APP_PASSWORD`). O multi-canal é todo em código.
