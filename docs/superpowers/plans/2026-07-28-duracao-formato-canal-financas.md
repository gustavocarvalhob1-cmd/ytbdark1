# Duração + Formato + Canal Finanças — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar controles de duração (minutos) e formato (YouTube/TikTok) na primeira tela, que ajustam roteiro e prompts de imagem, e criar o 4º canal (Finanças / educação financeira).

**Architecture:** Funções modificadoras puras em `lib/roteiro-utils.ts` geram blocos de instrução de duração e formato, concatenados pelas rotas de API sobre a voz de cada canal (sem mudar as assinaturas de `mensagemRoteiro`/`mensagemPrompts`). A seção de tamanho fixa some dos prompts dos canais. O frontend ganha os controles no Passo 1. O canal Finanças é só mais um perfil em `lib/canais/`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Vitest.

## Global Constraints

- Node 24, Next.js 14, TypeScript. **Não** subir versões.
- Todo texto de UI e todos os prompts em **português do Brasil**.
- **Duração:** inteiro de **1 a 20 min**, padrão **10**. Alvo = `minutos × 130` palavras (faixa `×115` a `×145`).
- **Formato:** `"youtube" | "tiktok"`, padrão `youtube`. YouTube = **16:9 horizontal**; TikTok = **9:16 vertical** + roteiro direto/rápido.
- Streaming NDJSON (`lib/stream.ts`) e auth (`lib/auth.ts`) preservados. Modelo via `MODELO`/`canal.modelo`.
- Os controles valem para **todos os canais**. Não quebrar o fluxo atual.
- Deploy é automático: `push` na `main` → Vercel publica. O push final leva tudo de uma vez.

---

## Task 1: Tipo `Formato` e funções modificadoras

**Files:**
- Modify: `lib/tipos.ts`
- Modify: `lib/roteiro-utils.ts`
- Test: `lib/roteiro-utils.test.ts`

**Interfaces:**
- Produces:
  - `type Formato = "youtube" | "tiktok"` (em `lib/tipos.ts`)
  - `instrucaoDuracao(minutos: number): string`
  - `instrucaoFormatoRoteiro(formato: Formato): string`
  - `instrucaoFormatoImagens(formato: Formato): string`

- [ ] **Step 1: Escrever os testes** (adicionar ao fim de `lib/roteiro-utils.test.ts`)

```ts
import {
  instrucaoDuracao,
  instrucaoFormatoRoteiro,
  instrucaoFormatoImagens,
} from "./roteiro-utils";

describe("instrucaoDuracao", () => {
  it("inclui os minutos e a quantidade de palavras alvo", () => {
    const s = instrucaoDuracao(5);
    expect(s).toContain("5 minuto");
    expect(s).toContain("650"); // 5 * 130
  });
  it("limita a duracao entre 1 e 20", () => {
    expect(instrucaoDuracao(100)).toContain("20 minuto");
    expect(instrucaoDuracao(0)).toContain("1 minuto");
  });
});

describe("instrucaoFormatoRoteiro", () => {
  it("youtube nao adiciona instrucao", () => {
    expect(instrucaoFormatoRoteiro("youtube")).toBe("");
  });
  it("tiktok pede gancho rapido e direto", () => {
    expect(instrucaoFormatoRoteiro("tiktok").toLowerCase()).toContain("gancho");
  });
});

describe("instrucaoFormatoImagens", () => {
  it("youtube menciona 16:9", () => {
    expect(instrucaoFormatoImagens("youtube")).toContain("16:9");
  });
  it("tiktok menciona 9:16", () => {
    expect(instrucaoFormatoImagens("tiktok")).toContain("9:16");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (funções não existem).

- [ ] **Step 3: Adicionar o tipo `Formato`** em `lib/tipos.ts` (no topo, após o comentário inicial)

```ts
// Formato do video (afeta orientacao das imagens e estilo do roteiro).
export type Formato = "youtube" | "tiktok";
```

- [ ] **Step 4: Adicionar as funções** em `lib/roteiro-utils.ts`

No topo, importar o tipo:
```ts
import type { Formato } from "./tipos";
```
No fim do arquivo:
```ts
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add lib/tipos.ts lib/roteiro-utils.ts lib/roteiro-utils.test.ts
git commit -m "feat: tipo Formato e instrucoes dinamicas de duracao/formato"
```

---

## Task 2: Remover o TAMANHO fixo dos prompts de roteiro dos 3 canais

O tamanho agora é dinâmico (Task 1). A seção fixa some dos roteiros.

**Files:**
- Modify: `lib/canais/historia-brasil.ts`
- Modify: `lib/canais/conspiracoes.ts`
- Modify: `lib/canais/inspiracional.ts`
- Test: `lib/canais/index.test.ts`

- [ ] **Step 1: Escrever o teste de regressão** (adicionar dentro do `describe("registro de canais", ...)` em `lib/canais/index.test.ts`)

```ts
  it("nenhum roteiro tem tamanho fixo embutido (a duracao e dinamica)", () => {
    for (const c of CANAIS) {
      expect(c.prompts.roteiro).not.toContain("1040");
      expect(c.prompts.roteiro).not.toContain("1560");
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (os roteiros ainda contêm "1040").

- [ ] **Step 3: Remover a seção TAMANHO de `historia-brasil.ts`**

No `prompts.roteiro`, apagar este trecho inteiro (as duas linhas em branco antes + o bloco):
```
TAMANHO
Entre 1040 e 1560 palavras. O video tem que durar de oito a doze minutos, na velocidade de cento e trinta palavras por minuto. Fique dentro dessa faixa.
```

- [ ] **Step 4: Remover a seção TAMANHO de `conspiracoes.ts`**

No `prompts.roteiro`, apagar:
```
TAMANHO
Entre 1040 e 1560 palavras (video de oito a doze minutos a 130 palavras por minuto).
```

- [ ] **Step 5: Remover a seção TAMANHO de `inspiracional.ts`**

No `prompts.roteiro`, apagar:
```
TAMANHO
Entre 1040 e 1560 palavras (video de oito a doze minutos a 130 palavras por minuto).
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/canais/ 
git commit -m "refactor: tamanho do roteiro agora e dinamico (remove TAMANHO fixo dos canais)"
```

---

## Task 3: Canal Finanças (educação financeira)

**Files:**
- Create: `lib/canais/financas.ts`
- Modify: `lib/canais/index.ts`
- Test: `lib/canais/index.test.ts`

**Interfaces:**
- Consumes: `Canal` (`lib/canais/tipos.ts`).
- Produces: `financas` no array `CANAIS`.

- [ ] **Step 1: Atualizar o teste de ids** em `lib/canais/index.test.ts`

Trocar a asserção de ids para incluir os 4 canais:
```ts
    expect(ids).toEqual(["historia-brasil", "conspiracoes", "inspiracional", "financas"]);
    expect(new Set(ids).size).toBe(4);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (só 3 canais).

- [ ] **Step 3: Criar `lib/canais/financas.ts`**

```ts
import { Canal } from "./tipos";

export const financas: Canal = {
  id: "financas",
  nome: "Finanças",
  emoji: "💰",
  cor: "#4caf7d",
  descricao: "Educação financeira que descomplica o dinheiro",
  entrada: {
    modo: "pesquisa",
    buscaWeb: true,
    label: "Tema de finanças que você quer explicar",
    placeholder:
      "Ex.: como sair do cheque especial, o que é reserva de emergência, juros compostos...",
    rotuloBotao: "Pesquisar e montar o material",
  },
  prompts: {
    passo1: `Voce e um pesquisador que prepara material para videos de um canal de EDUCACAO FINANCEIRA. Voce recebe um tema de financas (uma duvida, um conceito, uma situacao do dia a dia) e monta um material didatico confiavel para virar roteiro.

O que voce faz:
1. Entende a duvida ou o conceito central do tema.
2. Pesquisa na internet os dados corretos e atuais (taxas, regras, numeros, como funciona na pratica). Prefira fontes confiaveis (orgaos oficiais, bancos, sites de referencia). Confira, nao chute.
3. Monta um material que explica o assunto de forma simples, com exemplos do dia a dia.

Regras que valem sempre:
- Nunca invente numero, taxa, regra ou fonte. Se um dado varia ou voce nao confirmou, diga isso.
- Foco em EDUCACAO e habitos (como funciona, como se organizar, o que evitar), NAO em recomendacao de investimento. Nunca diga "compre tal acao" ou "invista em tal cripto".
- Separe o que e fato/regra do que e opiniao geral.
- Nao narre seu processo. Nao use markdown. Titulos em MAIUSCULAS simples.

Formato da saida:

TEMA
Uma linha sobre a duvida/assunto.

O QUE A PESSOA PRECISA ENTENDER
Os conceitos e como funciona na pratica, com os numeros/regras corretos.

EXEMPLO DO DIA A DIA
Uma situacao concreta que ilustra.

CUIDADOS E ARMADILHAS
O que costuma dar errado, o que evitar.

O PASSO PRATICO
O que a pessoa pode fazer a respeito, de forma simples e realista.

Escreva em portugues do Brasil.`,
    roteiro: `Voce escreve roteiros narrados para um canal de EDUCACAO FINANCEIRA. O texto vai ser lido em voz alta. Ele precisa explicar dinheiro de um jeito que qualquer pessoa entenda, como um amigo que manja do assunto te explicando sem economes.

COMO VOCE ESCREVE
- Frases curtas e claras. Nada de jargao de banco. Se precisar usar um termo tecnico, explica na hora com palavras simples.
- Texto corrido do comeco ao fim. Sem titulo, topico, lista ou marcador de secao (a narracao le tudo em voz alta).
- Tom de amigo que te quer bem e nao te julga. Quem esta endividado ou perdido com dinheiro se sente acolhido, nao burro.
- Use exemplos do dia a dia com numeros simples ("imagina que sobrou cem reais no fim do mes...").
- Use as contracoes naturais da fala: ta, ne, pra, pro, to. Onde precisa respirar, use reticencias.
- Numeros por extenso quando falados.

CUIDADO IMPORTANTE (protege o canal)
- Foco em educacao e habitos. NUNCA de recomendacao de investimento especifica ("compre tal acao", "invista em tal cripto"). Fale de conceitos, organizacao e cuidado.
- Use so o que esta no material. Nao invente taxa, regra ou numero.

O QUE VOCE NUNCA FAZ
- Nunca usa travessao. Se precisar separar, comeca outra frase.
- Nunca deixa cara de texto de IA. Proibido: "no mundo de hoje", "vamos mergulhar", "e importante notar", "em conclusao", "prepare-se", "curiosamente", e aberturas genericas tipo "voce ja parou pra pensar", "hoje em dia".
- Nao promete enriquecer rapido nem formula magica. Educacao honesta e pe no chao.

ESTRUTURA INVISIVEL
Comece com um gancho que toque uma dor comum com dinheiro (a conta que nao fecha, o medo da divida, a vontade de guardar e nao conseguir). Desenvolva explicando o assunto passo a passo, sempre com exemplo. Traga uma virada que da esperanca e clareza. Feche com um passo pratico que a pessoa consegue dar hoje.

ENTREGA
Entregue SO o texto do roteiro. Sem titulo, sem comentario, sem contagem de palavras.`,
    imagens: `Estilo visual do canal: limpo e moderno, tons de verde e dourado, sensacao de organizacao e clareza. Elementos: cofrinho, moedas, cedulas, graficos simples e amigaveis, cenas do dia a dia (pessoa organizando contas, mercado, casa, celular com app de banco). Nada de grafico corporativo frio ou sala de bolsa tensa. Mantenha essa paleta em todas as cenas.

Voce cria prompts de geracao de video por inteligencia artificial (para ferramentas como Veo, Kling, Runway e Sora) para ilustrar um roteiro narrado.

SUA TAREFA
Pegar o roteiro e quebrar em cenas curtas, na ordem. Para cada cena, escrever um prompt de video.

REGRAS DOS CLIPES
- Cada clipe tem no maximo oito segundos.
- Na narracao, oito segundos sao mais ou menos dezessete palavras. Entao cada cena cobre um trecho de umas quinze a vinte palavras do roteiro.
- Gere quantas cenas forem necessarias para cobrir o roteiro inteiro do comeco ao fim, sem deixar buraco.
- As cenas seguem a ordem do roteiro e combinam visualmente com o trecho que esta sendo narrado ali.

REGRAS DOS PROMPTS
- Escreva cada prompt em ingles. As ferramentas de video funcionam muito melhor em ingles.
- Cada prompt precisa ser visual e concreto: descreva o assunto, o ambiente, a acao, o angulo de camera, a iluminacao, a atmosfera e o estilo.
- Nada de texto na tela, nada de legenda dentro do video, nada de logo ou marca.
- Mantenha coerencia visual entre as cenas: mesmo estilo e mesma paleta ao longo do video todo.
- Evite mostrar o rosto de pessoas reais especificas e marcas registradas.

FORMATO DA SAIDA
Para cada cena, exatamente neste formato:

[numero] (inicio - fim em mm:ss)
PROMPT: <o prompt em ingles>
NARRACAO: <o trecho do roteiro que essa cena cobre>

Cada cena dura ate oito segundos, entao o fim fica no maximo oito segundos depois do inicio. Siga a numeracao inicial e o tempo inicial que forem pedidos na mensagem, somando dai em diante. Nao escreva nada alem das cenas.`,
  },
};
```

- [ ] **Step 4: Registrar no `lib/canais/index.ts`**

Adicionar o import:
```ts
import { financas } from "./financas";
```
E incluir no array:
```ts
export const CANAIS: Canal[] = [historiaBrasil, conspiracoes, inspiracional, financas];
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS (4 canais, todos com prompts e sem tamanho fixo).

- [ ] **Step 6: Commit**

```bash
git add lib/canais/
git commit -m "feat: canal Financas (educacao financeira)"
```

---

## Task 4: `VideoSalvo` + rotas de roteiro e prompts

**Files:**
- Modify: `lib/tipos.ts`
- Modify: `app/api/roteiro/route.ts`
- Modify: `app/api/prompts/route.ts`

**Interfaces:**
- Consumes: `instrucaoDuracao`, `instrucaoFormatoRoteiro`, `instrucaoFormatoImagens` (Task 1), `Formato` (Task 1).
- Produces: rotas que aceitam `duracaoMin` (roteiro) e `formato` (roteiro e prompts).

- [ ] **Step 1: Adicionar campos em `VideoSalvo`** (`lib/tipos.ts`)

No `interface VideoSalvo`, junto dos outros campos:
```ts
  duracaoMin?: number; // duracao escolhida (minutos)
  formato?: Formato;   // "youtube" | "tiktok"
```

- [ ] **Step 2: Reescrever `app/api/roteiro/route.ts`**

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
  instrucaoDuracao,
  instrucaoFormatoRoteiro,
} from "@/lib/roteiro-utils";
import type { Formato } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

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
```

- [ ] **Step 3: Reescrever `app/api/prompts/route.ts`**

```ts
import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemPrompts, fatiarRoteiro, instrucaoFormatoImagens } from "@/lib/roteiro-utils";
import type { Formato } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let roteiro = "";
  let indice = 0;
  let total = 1;
  let idCanal = "";
  let formato: Formato = "youtube";
  try {
    const body = await req.json();
    roteiro = body.roteiro || "";
    indice = Number.isInteger(body.indice) ? body.indice : 0;
    total = Number.isInteger(body.total) && body.total > 0 ? body.total : 1;
    idCanal = body.canal || "";
    if (body.formato === "tiktok") formato = "tiktok";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!roteiro || roteiro.trim().length < 20) return erro("Faltou o roteiro do Passo 2.");

  const { trecho, offsetSegundos, numeroInicial } = fatiarRoteiro(roteiro, total, indice);
  const conteudo =
    mensagemPrompts({ trecho, offsetSegundos, numeroInicial }) + instrucaoFormatoImagens(formato);

  return respostaStream(async (emit) => {
    emit({ type: "status", message: `Montando as cenas (parte ${indice + 1} de ${total})...` });

    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 8000,
      system: canal.prompts.imagens,
      messages: [{ role: "user", content: conteudo }],
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

- [ ] **Step 4: Build (type-check)**

Run: `npx tsc --noEmit`
Expected: **sem erros**. Os campos novos em `VideoSalvo` são opcionais (`?`), então o `app/page.tsx` atual continua compilando — ele passa a usar os campos só na Task 5.

- [ ] **Step 5: Commit**

```bash
git add lib/tipos.ts app/api/roteiro/route.ts app/api/prompts/route.ts
git commit -m "feat: rotas de roteiro/prompts recebem duracao e formato"
```

---

## Task 5: Frontend — controles de duração e formato no Passo 1

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Formato` (`@/lib/tipos`).

- [ ] **Step 1: Importar `Formato` e criar chaves de storage**

No import de tipos, adicionar `Formato`:
```ts
import type { Fonte, MetaFinal, VideoSalvo, Formato } from "@/lib/tipos";
```
Junto das outras constantes `CHAVE_*`:
```ts
const CHAVE_DURACAO = "estudio-dark-duracao";
const CHAVE_FORMATO = "estudio-dark-formato";
```

- [ ] **Step 2: Estado da duração e do formato**

Perto de `const [canalAtivo, ...]`:
```ts
const [duracao, setDuracao] = useState<number>(10);
const [formato, setFormato] = useState<Formato>("youtube");
```
No `useEffect` de abertura (o `[]`), depois de ler o canal:
```ts
const durSalva = Number(localStorage.getItem(CHAVE_DURACAO));
if (durSalva >= 1 && durSalva <= 20) setDuracao(durSalva);
if (localStorage.getItem(CHAVE_FORMATO) === "tiktok") setFormato("tiktok");
```

- [ ] **Step 3: Função de trocar formato (ajusta a duração sugerida)**

Perto de `trocarCanal`:
```ts
function trocarFormato(f: Formato) {
  setFormato(f);
  const sugestao = f === "tiktok" ? 1 : 10;
  setDuracao(sugestao);
  try {
    localStorage.setItem(CHAVE_FORMATO, f);
    localStorage.setItem(CHAVE_DURACAO, String(sugestao));
  } catch {
    /* ignora */
  }
}

function mudarDuracao(min: number) {
  const v = Math.max(1, Math.min(20, Math.round(min || 0)));
  setDuracao(v);
  try {
    localStorage.setItem(CHAVE_DURACAO, String(v));
  } catch {
    /* ignora */
  }
}
```

- [ ] **Step 4: Incluir `duracaoMin`/`formato` nas chamadas e no vídeo salvo**

Em `rodarPasso2`:
```ts
const ok = await streamFetch(
  "/api/roteiro",
  { dossie, extras, canal: canalAtivo, duracaoMin: duracao, formato },
  senha,
  {
```
E adicionar `duracao, formato` às deps do `useCallback` do passo 2.

Em `rodarPasso3` (dentro do loop):
```ts
{ roteiro, indice: i, total: totalLotes, canal: canalAtivo, formato },
```
E adicionar `formato` às deps do `useCallback` do passo 3.

No `useEffect` que salva o histórico, no objeto `atual`:
```ts
  duracaoMin: duracao,
  formato,
```
E adicionar `duracao, formato` às deps desse `useEffect`.

Em `aplicarVideo(v)`, restaurar:
```ts
setDuracao(v.duracaoMin && v.duracaoMin >= 1 ? v.duracaoMin : 10);
setFormato(v.formato === "tiktok" ? "tiktok" : "youtube");
```

- [ ] **Step 5: Adicionar os controles na UI do Passo 1**

Dentro de `{passo === 1 && (`, logo após `<section className="mt-6 space-y-5">`, antes do primeiro `<div>` do campo de fonte:
```tsx
<div className="flex flex-wrap items-end gap-4">
  <div>
    <label className="text-sm text-suave block mb-1">Duração (min)</label>
    <input
      type="number"
      min={1}
      max={20}
      value={duracao}
      onChange={(e) => mudarDuracao(Number(e.target.value))}
      className="w-24 bg-fundo border border-borda rounded-lg p-2 text-texto focus:border-destaque outline-none"
    />
  </div>
  <div>
    <label className="text-sm text-suave block mb-1">Formato</label>
    <div className="flex gap-2">
      {(["youtube", "tiktok"] as Formato[]).map((f) => (
        <button
          key={f}
          onClick={() => trocarFormato(f)}
          className={[
            "text-sm rounded-lg px-3 py-2 border transition",
            formato === f
              ? "bg-painel border-destaque text-texto font-semibold"
              : "border-borda text-suave hover:text-texto",
          ].join(" ")}
        >
          {f === "youtube" ? "▶️ YouTube" : "📱 TikTok"}
        </button>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 6: Verificar no navegador**

Run: `npm run dev` e abrir http://localhost:3000
Expected: no Passo 1 aparecem o campo de duração e os botões YouTube/TikTok. Clicar em TikTok muda a duração pra 1; digitar um valor funciona; ao gerar, a rede mostra `duracaoMin` e `formato` no corpo do POST de `/api/roteiro`.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: controles de duracao e formato no Passo 1"
```

---

## Task 6: Verificação final e publicação

**Files:** nenhum novo — validação.

- [ ] **Step 1: Build de produção + testes**

Run: `npm run build` e depois `npm test`
Expected: build sem erros; todos os testes passam.

- [ ] **Step 2: Verificação manual no navegador** (`npm run dev`)

Checklist:
- [ ] Os **4 canais** aparecem (inclui 💰 Finanças) e trocam.
- [ ] O campo de duração aceita valores de 1 a 20; TikTok sugere 1, YouTube sugere 10; dá pra sobrescrever.
- [ ] Gerar um roteiro num tempo curto (ex: 2 min) sai mais curto; num tempo longo, mais longo.
- [ ] No formato TikTok, os prompts de imagem mencionam 9:16; no YouTube, 16:9.
- [ ] O canal Finanças gera material com dados (sem recomendação de investimento).
- [ ] Nada do fluxo antigo quebrou.

- [ ] **Step 3: Publicar (deploy automático)**

```bash
git push origin main
```
Expected: o Vercel detecta o push e publica automaticamente em ~1-2 min. Conferir `plataforma-ytb.vercel.app` depois.

---

## Notas de execução

- **Prompts são pontos de iteração:** as instruções de duração/formato e a voz do canal Finanças são um bom começo; fáceis de afinar depois (tudo em `lib/`).
- **Ordem:** Tasks 1-4 são "por baixo"; a Task 5 liga tudo na tela. O primeiro resultado visível aparece na Task 5.
- **Deploy:** o push da Task 6 é o único necessário — nada muda no ambiente do Vercel (mesmas variáveis).
