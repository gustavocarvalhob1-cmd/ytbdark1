# Fila de Roteiros + Modo Insight — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o modo insight (ideia → ângulos → confirmação → autorizar → gera) e a fila client-side (várias fontes → Fonte+Roteiro em lote no histórico) ao Passo 1.

**Architecture:** Funções puras novas em `lib/roteiro-utils.ts` e system prompts em `lib/voz-insight.ts`. Duas rotas de API novas (`/api/angulos`, `/api/direcao`) no padrão das existentes. Todo o resto é estado + orquestração client-side em `app/page.tsx` reusando `streamFetch`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Vitest.

## Global Constraints

- Node 24, Next.js 14, TypeScript. **Não** subir versões.
- Todo texto de UI e todos os prompts em **português do Brasil**.
- Streaming NDJSON (`lib/stream.ts`) e auth (`lib/auth.ts`) preservados. Modelo via `canal.modelo || MODELO`.
- **Client-side:** a fila roda enquanto a aba está aberta; **sem** backend/persistência novos.
- Multi-canal + duração/formato já existentes valem para a fila (config global).
- Deploy é automático: o `push` final publica.

---

## Task 1: Funções puras do insight

**Files:**
- Modify: `lib/roteiro-utils.ts`
- Test: `lib/roteiro-utils.test.ts`

**Interfaces:**
- Produces:
  - `mensagemAngulos(ideia: string, contextoCanal: string): string`
  - `mensagemDirecao(ideia: string, angulo: string): string`
  - `montarFonteInsight(ideia: string, angulo: string, direcao: string): string`
  - `parsearAngulos(texto: string): string[]`

- [ ] **Step 1: Escrever os testes** (adicionar ao fim de `lib/roteiro-utils.test.ts`, e completar o import)

Adicionar ao import existente de `./roteiro-utils`: `mensagemAngulos, mensagemDirecao, montarFonteInsight, parsearAngulos`. Depois:
```ts
describe("insight", () => {
  it("mensagemAngulos inclui a ideia e o contexto do canal", () => {
    const m = mensagemAngulos("solidao nas cidades", "Inspiracional — motivacional");
    expect(m).toContain("solidao nas cidades");
    expect(m).toContain("Inspiracional");
  });
  it("mensagemDirecao inclui a ideia e o angulo", () => {
    const m = mensagemDirecao("solidao nas cidades", "o lado psicologico");
    expect(m).toContain("solidao nas cidades");
    expect(m).toContain("o lado psicologico");
  });
  it("montarFonteInsight junta ideia, angulo e direcao", () => {
    const f = montarFonteInsight("a ideia", "o angulo", "a direcao confirmada");
    expect(f).toContain("a ideia");
    expect(f).toContain("o angulo");
    expect(f).toContain("a direcao confirmada");
  });
  it("parsearAngulos extrai as linhas numeradas", () => {
    const texto = "1. primeiro caminho\n2) segundo caminho\n3 - terceiro";
    expect(parsearAngulos(texto)).toEqual([
      "primeiro caminho",
      "segundo caminho",
      "terceiro",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (funções não existem).

- [ ] **Step 3: Adicionar as funções** ao fim de `lib/roteiro-utils.ts`

```ts
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
```
> Nota: `parsearAngulos` só mantém linhas que começam com número. Se a IA variar o formato, o campo livre da UI garante que o usuário ainda consegue seguir com o ângulo próprio.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/roteiro-utils.ts lib/roteiro-utils.test.ts
git commit -m "feat: funcoes puras do modo insight (angulos, direcao, fonte)"
```

---

## Task 2: System prompts do insight

**Files:**
- Create: `lib/voz-insight.ts`

- [ ] **Step 1: Criar `lib/voz-insight.ts`**

```ts
// System prompts do modo insight (partir de uma ideia solta).

export const SYSTEM_ANGULOS = `Voce ajuda a transformar uma ideia solta em video. Voce recebe o canal (nicho) e uma ideia, e propoe de 3 a 5 angulos/caminhos DIFERENTES para essa ideia virar um video desse canal.

Regras:
- Cada angulo em UMA linha, numerado (1. 2. 3. ...), curto e concreto: uma frase que deixa claro o foco e o rumo.
- Os angulos devem ser bem diferentes entre si e fazer sentido para o nicho do canal.
- NAO escreva o video, o roteiro nem o dossie. So a lista de caminhos.
- Nao escreva nada antes nem depois da lista. Sem titulo, sem introducao.
- Escreva em portugues do Brasil.`;

export const SYSTEM_DIRECAO = `Voce recebe uma ideia e o caminho/angulo que a pessoa escolheu para um video. Sua tarefa e confirmar que entendeu o rumo, em UM paragrafo curto (2 a 4 frases): diga qual vai ser o foco do video, o tom, e o que ele vai explorar, para a pessoa ver que voce pegou a direcao certa.

Regras:
- Nao escreva o roteiro nem o dossie ainda. So a confirmacao do rumo.
- Tom de quem entendeu e vai executar. Direto e claro.
- Escreva em portugues do Brasil.`;
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/voz-insight.ts
git commit -m "feat: system prompts do modo insight"
```

---

## Task 3: Rotas `/api/angulos` e `/api/direcao`

**Files:**
- Create: `app/api/angulos/route.ts`
- Create: `app/api/direcao/route.ts`

**Interfaces:**
- Consumes: `getCanal`, `mensagemAngulos`, `mensagemDirecao`, `SYSTEM_ANGULOS`, `SYSTEM_DIRECAO`, `gerarComStream`, `MODELO`.

- [ ] **Step 1: Criar `app/api/angulos/route.ts`**

```ts
import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemAngulos } from "@/lib/roteiro-utils";
import { SYSTEM_ANGULOS } from "@/lib/voz-insight";

export const runtime = "nodejs";
export const maxDuration = 60;

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
```

- [ ] **Step 2: Criar `app/api/direcao/route.ts`**

```ts
import { NextRequest } from "next/server";
import { MODELO, gerarComStream } from "@/lib/anthropic";
import { autorizado, respostaNaoAutorizado } from "@/lib/auth";
import { respostaStream } from "@/lib/stream";
import { getCanal } from "@/lib/canais";
import { mensagemDirecao } from "@/lib/roteiro-utils";
import { SYSTEM_DIRECAO } from "@/lib/voz-insight";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return respostaNaoAutorizado();

  let ideia = "";
  let angulo = "";
  let idCanal = "";
  try {
    const body = await req.json();
    ideia = body.ideia || "";
    angulo = body.angulo || "";
    idCanal = body.canal || "";
  } catch {
    return erro("Nao entendi o que voce enviou.");
  }

  const canal = getCanal(idCanal);
  if (!canal) return erro("Canal nao reconhecido.");
  if (!angulo || angulo.trim().length < 2) return erro("Escolha ou escreva um angulo.");

  return respostaStream(async (emit) => {
    emit({ type: "status", message: "Confirmando o rumo..." });
    await gerarComStream(emit, {
      model: canal.modelo || MODELO,
      max_tokens: 700,
      system: SYSTEM_DIRECAO,
      messages: [{ role: "user", content: mensagemDirecao(ideia, angulo) }],
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

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/angulos/route.ts app/api/direcao/route.ts
git commit -m "feat: rotas /api/angulos e /api/direcao (modo insight)"
```

---

## Task 4: Frontend — Modo Insight

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `montarFonteInsight`, `parsearAngulos` (`@/lib/roteiro-utils`), `streamFetch`.

- [ ] **Step 1: Importar as funções puras**

No import de `@/lib/roteiro-utils` (criar se não existir — hoje o page.tsx não importa dele; adicionar o import):
```ts
import { montarFonteInsight, parsearAngulos } from "@/lib/roteiro-utils";
```

- [ ] **Step 2: Estado do insight** (perto dos estados do passo 1)

```ts
const [faseInsight, setFaseInsight] = useState<"off" | "angulos" | "direcao">("off");
const [ideiaInsight, setIdeiaInsight] = useState("");
const [angulosTexto, setAngulosTexto] = useState("");
const [anguloEscolhido, setAnguloEscolhido] = useState("");
const [direcaoTexto, setDirecaoTexto] = useState("");
const [carregandoInsight, setCarregandoInsight] = useState(false);
```

- [ ] **Step 3: Tornar `rodarPasso1` aceitar uma fonte explícita** (evita race no "seguir")

Mudar a assinatura e a primeira linha úteis de `rodarPasso1`:
```ts
const rodarPasso1 = useCallback(async (fonteOverride?: string) => {
    const textoFonte = (fonteOverride ?? fonte).trim();
    if (carregando1) return;
    if (textoFonte.length < 20) {
      setErro("Escreva um pouco mais de texto pra comecar.");
      return;
    }
    setErro("");
    setDossie("");
    setFontes([]);
    setCarregando1(true);
    setStatus1("Iniciando...");
    let texto = "";
    const ok = await streamFetch("/api/fonte", { fonte: textoFonte, canal: canalAtivo }, senha, {
```
(o resto do corpo permanece; e nas deps trocar `fonte` continua presente).

- [ ] **Step 4: Funções do insight** (perto de `rodarPasso1`)

```ts
const explorarAngulos = useCallback(async () => {
  if (carregandoInsight) return;
  if (fonte.trim().length < 6) {
    setErro("Escreva a sua ideia primeiro.");
    return;
  }
  setErro("");
  setIdeiaInsight(fonte.trim());
  setAngulosTexto("");
  setAnguloEscolhido("");
  setFaseInsight("angulos");
  setCarregandoInsight(true);
  let texto = "";
  await streamFetch("/api/angulos", { ideia: fonte.trim(), canal: canalAtivo }, senha, {
    onDelta: (t) => {
      texto += t;
      setAngulosTexto(texto);
    },
    onError: (m) => setErro(m),
  });
  setCarregandoInsight(false);
}, [carregandoInsight, fonte, canalAtivo, senha]);

const enviarAngulo = useCallback(async () => {
  if (carregandoInsight) return;
  if (anguloEscolhido.trim().length < 2) {
    setErro("Escolha um angulo ou escreva o seu.");
    return;
  }
  setErro("");
  setDirecaoTexto("");
  setFaseInsight("direcao");
  setCarregandoInsight(true);
  let texto = "";
  await streamFetch(
    "/api/direcao",
    { ideia: ideiaInsight, angulo: anguloEscolhido.trim(), canal: canalAtivo },
    senha,
    {
      onDelta: (t) => {
        texto += t;
        setDirecaoTexto(texto);
      },
      onError: (m) => setErro(m),
    },
  );
  setCarregandoInsight(false);
}, [carregandoInsight, anguloEscolhido, ideiaInsight, canalAtivo, senha]);

function seguirInsight() {
  const f = montarFonteInsight(ideiaInsight, anguloEscolhido, direcaoTexto);
  setFonte(f);
  setFaseInsight("off");
  rodarPasso1(f);
}

function cancelarInsight() {
  setFaseInsight("off");
  setErro("");
}
```

- [ ] **Step 5: UI do insight no Passo 1**

Abaixo do botão principal do Passo 1 (o que usa `canalObj.entrada.rotuloBotao`), adicionar o botão de explorar e as telas condicionais:
```tsx
<button
  onClick={explorarAngulos}
  disabled={carregando1 || carregandoInsight}
  className="ml-2 border border-borda text-suave rounded-lg px-4 py-3 hover:text-texto hover:border-destaque/60 disabled:opacity-40"
>
  💡 Explorar ângulos
</button>

{faseInsight === "angulos" && (
  <div className="bg-painel border border-borda rounded-xl p-4 space-y-3">
    <p className="text-sm text-suave">Escolha um caminho (ou escreva o seu):</p>
    <div className="flex flex-col gap-2">
      {parsearAngulos(angulosTexto).map((a, i) => (
        <button
          key={i}
          onClick={() => setAnguloEscolhido(a)}
          className={[
            "text-left text-sm rounded-lg px-3 py-2 border transition",
            anguloEscolhido === a
              ? "border-destaque bg-fundo text-texto"
              : "border-borda text-suave hover:text-texto",
          ].join(" ")}
        >
          {a}
        </button>
      ))}
    </div>
    {carregandoInsight && <p className="text-xs text-destaque">Pensando em caminhos...</p>}
    <input
      value={anguloEscolhido}
      onChange={(e) => setAnguloEscolhido(e.target.value)}
      placeholder="Ou escreva aqui o ângulo que você quer..."
      className="w-full bg-fundo border border-borda rounded-lg p-2 text-texto placeholder-suave focus:border-destaque outline-none"
    />
    <div className="flex gap-2">
      <button
        onClick={enviarAngulo}
        disabled={carregandoInsight}
        className="bg-destaque text-black font-semibold rounded-lg px-4 py-2 hover:brightness-110 disabled:opacity-40"
      >
        Enviar ângulo
      </button>
      <button onClick={cancelarInsight} className="text-sm text-suave px-3 py-2 hover:text-texto">
        Cancelar
      </button>
    </div>
  </div>
)}

{faseInsight === "direcao" && (
  <div className="bg-painel border border-borda rounded-xl p-4 space-y-3">
    <p className="text-sm text-suave">O rumo que entendi:</p>
    <p className="text-[15px] text-texto whitespace-pre-wrap">{direcaoTexto}</p>
    <div className="flex gap-2">
      <button
        onClick={seguirInsight}
        disabled={carregandoInsight}
        className="bg-destaque text-black font-semibold rounded-lg px-4 py-2 hover:brightness-110 disabled:opacity-40"
      >
        Seguir com esse rumo →
      </button>
      <button
        onClick={() => setFaseInsight("angulos")}
        className="text-sm text-suave px-3 py-2 hover:text-texto"
      >
        Voltar aos ângulos
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Verificar no navegador**

Run: `npm run dev`
Expected: escrever uma ideia curta, clicar "💡 Explorar ângulos", ver a lista de ângulos + campo livre; escolher/escrever e "Enviar ângulo"; ver a confirmação; "Seguir com esse rumo" preenche a fonte e roda o Passo 1.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: modo insight no Passo 1 (angulos, confirmacao, autorizar)"
```

---

## Task 5: Frontend — Fila client-side

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Aumentar o limite do histórico** (a fila gera vários)

Trocar:
```ts
const MAX_HISTORICO = 10; // guarda os ultimos 10 videos
```
por:
```ts
const MAX_HISTORICO = 30; // guarda os ultimos 30 videos (a fila gera varios)
```

- [ ] **Step 2: Estado da fila** (perto dos estados de fluxo)

```ts
const [modoFila, setModoFila] = useState(false);
const [filaEntrada, setFilaEntrada] = useState("");
const [filaItens, setFilaItens] = useState<string[]>([]);
const [filaRodando, setFilaRodando] = useState(false);
const [filaProgresso, setFilaProgresso] = useState<{ atual: number; total: number }>({ atual: 0, total: 0 });
const pararFilaRef = useRef(false);
```

- [ ] **Step 3: Funções da fila** (perto de `novoVideo`)

```ts
function adicionarNaFila() {
  if (filaEntrada.trim().length < 20) {
    setErro("Escreva um pouco mais pra adicionar à fila.");
    return;
  }
  setErro("");
  setFilaItens((prev) => [...prev, filaEntrada.trim()]);
  setFilaEntrada("");
}

function removerDaFila(i: number) {
  setFilaItens((prev) => prev.filter((_, idx) => idx !== i));
}

function pararFila() {
  pararFilaRef.current = true;
}

const rodarFila = useCallback(async () => {
  if (filaRodando || filaItens.length === 0) return;
  setErro("");
  setFilaRodando(true);
  pararFilaRef.current = false;
  const itens = [...filaItens];

  for (let i = 0; i < itens.length; i++) {
    if (pararFilaRef.current) break;
    setFilaProgresso({ atual: i + 1, total: itens.length });
    const item = itens[i];

    let dossieTexto = "";
    let fontesItem: Fonte[] = [];
    const okFonte = await streamFetch("/api/fonte", { fonte: item, canal: canalAtivo }, senha, {
      onDelta: (t) => (dossieTexto += t),
      onSources: (its) => (fontesItem = its),
      onError: (m) => setErro(m),
    });
    if (!okFonte || dossieTexto.trim().length < 20) continue;

    let roteiroTexto = "";
    let metaItem: MetaFinal | null = null;
    const okRot = await streamFetch(
      "/api/roteiro",
      { dossie: dossieTexto, extras: "", canal: canalAtivo, duracaoMin: duracao, formato },
      senha,
      {
        onDelta: (t) => (roteiroTexto += t),
        onDone: (m) => {
          if (m) metaItem = m;
        },
        onError: (m) => setErro(m),
      },
    );
    if (!okRot || !roteiroTexto.trim()) continue;

    const video: VideoSalvo = {
      canal: canalAtivo,
      duracaoMin: duracao,
      formato,
      id: novoId(),
      titulo: derivarTitulo({ roteiro: roteiroTexto, dossie: dossieTexto, fonte: item }),
      data: Date.now(),
      fonte: item,
      extras: "",
      dossie: dossieTexto,
      fontes: fontesItem,
      roteiro: roteiroTexto,
      meta: metaItem,
      prompts: "",
      passoMax: 3,
    };
    setHistorico((prev) => {
      const nova = [video, ...prev].slice(0, MAX_HISTORICO);
      try {
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(nova));
      } catch {
        /* ignora */
      }
      return nova;
    });
    setFilaItens((prev) => prev.filter((x) => x !== item));
  }

  setFilaRodando(false);
  setFilaProgresso({ atual: 0, total: 0 });
}, [filaRodando, filaItens, canalAtivo, senha, duracao, formato]);
```

- [ ] **Step 4: Botão "Modo fila" no cabeçalho**

Na barra do histórico (perto de "+ Novo video"), adicionar:
```tsx
<button
  onClick={() => setModoFila((v) => !v)}
  className="text-sm border border-borda rounded-lg px-3 py-2 text-suave hover:text-texto hover:border-destaque/60"
>
  🗂️ Modo fila {modoFila ? "▲" : "▼"}
</button>
```

- [ ] **Step 5: Painel da fila**

Logo abaixo dessa barra (antes do `<Stepper>`), adicionar:
```tsx
{modoFila && (
  <div className="bg-painel border border-borda rounded-xl p-4 mb-4 space-y-3">
    <p className="text-sm text-suave">
      A fila usa o canal <b className="text-texto">{canalObj.nome}</b>, duração{" "}
      <b className="text-texto">{duracao} min</b> e formato{" "}
      <b className="text-texto">{formato === "tiktok" ? "TikTok" : "YouTube"}</b>. Cada item vira um
      roteiro no histórico.
    </p>
    <textarea
      value={filaEntrada}
      onChange={(e) => setFilaEntrada(e.target.value)}
      placeholder="Cole uma ideia, link ou transcrição e clique em Adicionar. Repita pra encher a fila."
      rows={3}
      className="w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none resize-y"
    />
    <div className="flex gap-2">
      <button
        onClick={adicionarNaFila}
        disabled={filaRodando}
        className="text-sm border border-borda rounded-lg px-3 py-2 text-suave hover:text-texto hover:border-destaque/60 disabled:opacity-40"
      >
        + Adicionar à fila
      </button>
      {filaItens.length > 0 && !filaRodando && (
        <button
          onClick={rodarFila}
          className="text-sm bg-destaque text-black font-semibold rounded-lg px-4 py-2 hover:brightness-110"
        >
          Rodar fila ({filaItens.length})
        </button>
      )}
      {filaRodando && (
        <button
          onClick={pararFila}
          className="text-sm border border-red-800/60 text-red-300 rounded-lg px-4 py-2 hover:bg-red-950/40"
        >
          Parar
        </button>
      )}
    </div>
    {filaRodando && (
      <p className="text-sm text-destaque">
        Processando {filaProgresso.atual} de {filaProgresso.total}...
      </p>
    )}
    {filaItens.length > 0 && (
      <ul className="divide-y divide-borda border border-borda rounded-lg">
        {filaItens.map((item, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs text-suave shrink-0">{i + 1}.</span>
            <span className="text-sm text-texto truncate flex-1">{item.slice(0, 80)}</span>
            {!filaRodando && (
              <button
                onClick={() => removerDaFila(i)}
                className="text-suave hover:text-red-400 text-xs px-2 shrink-0"
              >
                remover
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 6: Verificar no navegador**

Run: `npm run dev`
Expected: abrir "Modo fila", adicionar 2-3 itens curtos, "Rodar fila", ver "Processando X de Y", e ao fim os vídeos aparecem no histórico do canal. O botão "Parar" interrompe após o item atual.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: fila client-side de criacao de roteiros"
```

---

## Task 6: Verificação final e publicação

- [ ] **Step 1: Build + testes**

Run: `npm run build` e depois `npm test`
Expected: build sem erros; todos os testes passam.

- [ ] **Step 2: Verificação manual** (`npm run dev`)

Checklist:
- [ ] Modo insight: ideia → 3-5 ângulos + campo livre → escolher/escrever → confirmação → seguir gera o dossiê no rumo.
- [ ] Fila: adicionar itens → rodar → progresso → vídeos no histórico. Parar funciona.
- [ ] Os dois modos convivem com o fluxo normal e todos os 4 canais; nada quebrou.

- [ ] **Step 3: Publicar**

```bash
git push origin main
```
Expected: deploy automático no Vercel em ~1-2 min.

---

## Notas de execução

- **Insight × fila:** são modos separados de propósito (insight é interativo, fila é automática). A fila não usa o insight.
- **Limite do histórico:** subiu para 30 pra caber lotes; ainda é localStorage (por navegador). A sincronização em nuvem continua no roadmap.
- **page.tsx:** cresceu bastante com estas features; se virar um problema, um próximo passo é extrair `useInsight`/`useFila` — fora do escopo deste plano.
