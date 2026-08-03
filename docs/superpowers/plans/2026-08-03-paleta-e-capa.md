# Paleta por Canal + Passo 4 (Capa) — Plano de Implementação

> **For agentic workers:** implementar task-by-task, com TDD nas partes puras. Steps usam checkbox (`- [ ]`).

**Goal:** Dar identidade visual a cada canal (`paleta: string[]`) e adicionar o Passo 4 — Capa: a IA sugere 3 conceitos de thumbnail (com o texto da capa + prompt em inglês), seguindo a paleta e o formato, aceitando imagens de referência (multimodal).

**Architecture:** Campo novo no tipo `Canal` + valores nos 4 canais. Funções puras novas em `lib/roteiro-utils.ts` (testadas) e system prompt em `lib/voz-capa.ts`. Rota nova `/api/capa` no padrão das existentes, agora **multimodal** (blocos de imagem no `messages`). Frontend: novo passo, estado, upload com redimensionamento no canvas, e persistência no histórico.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Vitest, `@anthropic-ai/sdk`.

## Global Constraints

- Node/Next 14, TypeScript. **Não** subir versões.
- Todo texto de UI e todos os prompts em **português do Brasil**.
- Streaming NDJSON (`lib/stream.ts`) e auth (`lib/auth.ts`) preservados. Modelo via `canal.modelo || MODELO`.
- **Client-side**; sem backend/persistência novos além do `localStorage`.
- Payload da Vercel (~4,5 MB): imagens de referência **redimensionadas no navegador** antes de enviar; **máx. 3** referências.
- Deploy automático: o `push` final publica.

---

## Task 1: Paleta no tipo e nos 4 canais

**Files:**
- Modify: `lib/canais/tipos.ts`, `lib/canais/historia-brasil.ts`, `lib/canais/conspiracoes.ts`, `lib/canais/inspiracional.ts`, `lib/canais/financas.ts`

- [ ] **Step 1: Campo `paleta` no `Canal`** (`lib/canais/tipos.ts`), logo após `cor`:
```ts
  cor: string; // hex de destaque, ex: "#c99a5b" (aplicado via style inline)
  paleta: string[]; // identidade visual do canal (cores hex); a 1a costuma ser a `cor`
```

- [ ] **Step 2: Preencher `paleta` em cada canal** (a 1ª cor = a `cor` já existente):
```ts
// historia-brasil.ts  (sépia / terroso / arquivo histórico)
  paleta: ["#c99a5b", "#7a4f2a", "#e9d8b4", "#2e2117", "#9c6b3f"],
// conspiracoes.ts  (noir / sombrio / alto contraste)
  paleta: ["#8a7fd6", "#14121c", "#4a4363", "#c0392b", "#2b2740"],
// inspiracional.ts  (amanhecer / quente / esperança)
  paleta: ["#e0a44a", "#f4a261", "#ffd8a8", "#7bb0c9", "#fff3e0"],
// financas.ts  (verde / dourado / organização)
  paleta: ["#4caf7d", "#d4af37", "#2e7d5b", "#1b4d3e", "#eaf5ee"],
```

- [ ] **Step 3: Compila** — `npx tsc --noEmit` (o campo é obrigatório; os 4 canais preenchidos).

- [ ] **Step 4: Commit** — `feat: paleta de cores por canal (identidade visual)`

---

## Task 2: Funções puras da capa (TDD)

**Files:**
- Modify: `lib/roteiro-utils.ts`
- Test: `lib/roteiro-utils.test.ts`

**Interfaces (produces):**
- `instrucaoFormatoCapa(formato: Formato): string`
- `mensagemCapa(opts: { canalNome: string; canalDescricao: string; paleta: string[]; tema: string; roteiro: string; formato: Formato; temReferencias: boolean }): string`

- [ ] **Step 1: Testes** (adicionar ao import e ao fim de `roteiro-utils.test.ts`):
```ts
// no import: instrucaoFormatoCapa, mensagemCapa
describe("capa", () => {
  it("instrucaoFormatoCapa menciona 16:9 no youtube e 9:16 no tiktok", () => {
    expect(instrucaoFormatoCapa("youtube")).toContain("16:9");
    expect(instrucaoFormatoCapa("tiktok")).toContain("9:16");
  });
  it("mensagemCapa inclui tema, cores da paleta e a orientacao do formato", () => {
    const m = mensagemCapa({
      canalNome: "Finanças", canalDescricao: "educação financeira",
      paleta: ["#4caf7d", "#d4af37"], tema: "reserva de emergencia",
      roteiro: "texto do roteiro", formato: "youtube", temReferencias: false,
    });
    expect(m).toContain("reserva de emergencia");
    expect(m).toContain("#4caf7d");
    expect(m).toContain("16:9");
  });
  it("mensagemCapa so fala de referencias quando temReferencias e true", () => {
    const base = { canalNome: "X", canalDescricao: "y", paleta: ["#000"], tema: "t", roteiro: "r", formato: "youtube" as const };
    expect(mensagemCapa({ ...base, temReferencias: true }).toLowerCase()).toContain("referenc");
    expect(mensagemCapa({ ...base, temReferencias: false }).toLowerCase()).not.toContain("imagens de referenc");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` (funções não existem).

- [ ] **Step 3: Implementar** (fim de `lib/roteiro-utils.ts`):
```ts
// PASSO 4 (capa): orientacao do formato da thumbnail.
export function instrucaoFormatoCapa(formato: Formato): string {
  if (formato === "tiktok") {
    return `Formato da capa: vertical 9:16 (tela de celular em pe). Componha o texto e o elemento principal para a leitura vertical, foco central. Inclua "vertical 9:16 aspect ratio" no prompt em ingles.`;
  }
  return `Formato da capa: horizontal 16:9 (thumbnail de YouTube). Texto grande legivel mesmo pequeno, rosto/elemento forte de um lado. Inclua "horizontal 16:9 aspect ratio" no prompt em ingles.`;
}

// PASSO 4 (capa): monta a mensagem do usuario para gerar os 3 conceitos de capa.
export function mensagemCapa(opts: {
  canalNome: string;
  canalDescricao: string;
  paleta: string[];
  tema: string;
  roteiro: string;
  formato: Formato;
  temReferencias: boolean;
}): string {
  const cores = opts.paleta.join(", ");
  const refs = opts.temReferencias
    ? `\n\nO usuario anexou imagens de referencia (capas que ele gosta). Analise o estilo delas (composicao, cores, tipo de texto) e proponha capas no mesmo tom, adaptado a este canal.`
    : "";
  return `Canal: ${opts.canalNome} — ${opts.canalDescricao}
Paleta de cores do canal (use estas cores): ${cores}
${instrucaoFormatoCapa(opts.formato)}

Tema do video: ${opts.tema.trim()}

Roteiro (para voce entender o conteudo e o gancho):
===== ROTEIRO =====
${opts.roteiro.trim()}
===== FIM =====${refs}

Proponha 3 conceitos de capa (thumbnail) diferentes, no formato pedido.`;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test`.

- [ ] **Step 5: Commit** — `feat: funcoes puras da capa (mensagemCapa, instrucaoFormatoCapa)`

---

## Task 3: System prompt da capa

**Files:**
- Create: `lib/voz-capa.ts`

- [ ] **Step 1: Criar `lib/voz-capa.ts`:**
```ts
// System prompt do Passo 4 (Capa/Thumbnail). Generico: a identidade do canal,
// a paleta, o formato e o conteudo chegam pela mensagem do usuario.
export const SYSTEM_CAPA = `Voce e um diretor de arte especialista em CAPAS (thumbnails) de YouTube que fazem a pessoa querer clicar, sem apelar para mentira. Voce recebe o canal, a paleta de cores, o formato e o conteudo do video (tema + roteiro), e as vezes imagens de referencia.

SUA TAREFA
Propor 3 conceitos de capa DIFERENTES entre si, cada um forte por um motivo (um mais emocional, um mais direto/curioso, um mais visual). Use as cores da paleta do canal. Respeite o formato pedido (16:9 ou 9:16).

REGRAS
- O texto da capa e curto (2 a 5 palavras), grande e legivel, em portugues. Chamativo mas honesto: nada de mentira ou promessa falsa.
- Coerente com o canal e com o conteudo do roteiro. Nada de elemento que nao tem a ver.
- Sem marcas registradas, sem rosto de pessoa real especifica.
- O PROMPT de imagem sai em INGLES (as ferramentas funcionam melhor assim), visual e concreto: cena, composicao, cores da paleta, iluminacao, estilo, e a proporcao (aspect ratio).

FORMATO DA SAIDA (exatamente assim, para cada uma das 3 capas)
CAPA [numero]
CONCEITO: <a ideia em uma linha>
TEXTO DA CAPA: <o texto grande, curto, em portugues>
COMPOSICAO: <enquadramento e disposicao dos elementos>
ELEMENTOS: <o que aparece na cena>
CORES: <quais cores da paleta e onde>
PROMPT: <o prompt em ingles, pronto para gerar a imagem>

Nao escreva nada antes da CAPA 1 nem depois da CAPA 3. Escreva os rotulos em portugues, o PROMPT em ingles.`;
```

- [ ] **Step 2: Compila** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat: system prompt da capa (voz-capa)`

---

## Task 4: Rota `/api/capa` (multimodal)

**Files:**
- Create: `app/api/capa/route.ts`

**Interfaces (consumes):** `getCanal`, `mensagemCapa`, `SYSTEM_CAPA`, `gerarComStream`, `MODELO`, `Formato`.

- [ ] **Step 1: Criar `app/api/capa/route.ts`:**
```ts
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
    content.push({ type: "image", source: { type: "base64", media_type: r.media_type, data: r.data } });
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
```

- [ ] **Step 2: Compila** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `feat: rota /api/capa (multimodal, 3 conceitos de thumbnail)`

---

## Task 5: Frontend — Passo 4 (Capa) + upload

**Files:**
- Modify: `app/page.tsx`, `lib/tipos.ts`

- [ ] **Step 1: `VideoSalvo` ganha `capa?`** (`lib/tipos.ts`, junto dos outros campos):
```ts
  prompts: string;
  capa?: string; // Passo 4: conceitos de capa/thumbnail
  passoMax: number;
```

- [ ] **Step 2: Imports e tipo do passo** (`app/page.tsx`):
  - Import: `mensagemCapa` não é usado no front; importar nada novo de utils. Ajustar `type Passo = 1 | 2 | 3 | 4;`.

- [ ] **Step 3: Estado do Passo 4** (perto do passo 3):
```ts
const [capa, setCapa] = useState("");
const [carregando4, setCarregando4] = useState(false);
const [status4, setStatus4] = useState("");
const [referencias, setReferencias] = useState<{ media_type: string; data: string }[]>([]);
```

- [ ] **Step 4: Persistência** — incluir `capa` em `aplicarVideo` (`setCapa(v.capa || "")`), no objeto salvo do `useEffect` (`capa,`), no `novoVideo` (`setCapa(""); setReferencias([]);`), e adicionar `capa` às deps do `useEffect` de salvar.

- [ ] **Step 5: Redimensionar imagem no navegador** (helper no módulo, fora do componente):
```ts
async function redimensionarImagem(file: File, maxLado = 1024): Promise<{ media_type: string; data: string }> {
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
  const w = Math.round(img.width * escala);
  const h = Math.round(img.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL("image/jpeg", 0.82);
  return { media_type: "image/jpeg", data: jpeg.split(",")[1] };
}
```

- [ ] **Step 6: Handlers de upload** (no componente):
```ts
async function adicionarReferencias(files: FileList | null) {
  if (!files) return;
  const atuais = [...referencias];
  for (const f of Array.from(files)) {
    if (atuais.length >= 3) break;
    if (!f.type.startsWith("image/")) continue;
    try {
      atuais.push(await redimensionarImagem(f));
    } catch {
      /* ignora arquivo problematico */
    }
  }
  setReferencias(atuais.slice(0, 3));
}
function removerReferencia(i: number) {
  setReferencias((prev) => prev.filter((_, idx) => idx !== i));
}
```

- [ ] **Step 7: `rodarPasso4`** (perto do `rodarPasso3`):
```ts
const rodarPasso4 = useCallback(async () => {
  if (carregando4) return;
  if (roteiro.trim().length < 20) {
    setErro("Faltou o roteiro pra pensar na capa.");
    return;
  }
  setErro("");
  setCapa("");
  setCarregando4(true);
  setStatus4("Iniciando...");
  const tema = derivarTitulo({ roteiro, dossie, fonte });
  let texto = "";
  const ok = await streamFetch(
    "/api/capa",
    { tema, roteiro, canal: canalAtivo, formato, referencias },
    senha,
    {
      onStatus: setStatus4,
      onDelta: (t) => {
        texto += t;
        setCapa(texto);
      },
      onError: (m) => setErro(m),
    },
  );
  setCarregando4(false);
  setStatus4("");
}, [carregando4, roteiro, dossie, fonte, canalAtivo, formato, referencias, senha]);
```

- [ ] **Step 8: Destravar o Passo 4** — no fim do `rodarPasso3` bem-sucedido, subir o `passoMax`:
  ```ts
  // depois do loop, se nao falhou:
  if (!falhou) setPassoMax((p) => (p < 4 ? 4 : p));
  ```
  (e o cast do `setPassoMax((v.passoMax||1) as Passo)` já cobre 4).

- [ ] **Step 9: Stepper** — adicionar `[4, "Capa"]` ao array `nomes`.

- [ ] **Step 10: Botão "Continuar para a capa →"** no fim do Passo 3 (quando `passoMax >= 4 && !carregando3`), levando a `irPara(4)`.

- [ ] **Step 11: Render do Passo 4** (depois do bloco do Passo 3):
```tsx
{passo === 4 && (
  <section className="mt-6 space-y-5">
    <div className="bg-painel border border-borda rounded-xl p-4 text-sm text-suave space-y-3">
      <p>
        Vou sugerir <b className="text-texto">3 conceitos de capa</b> ({formato === "tiktok" ? "9:16" : "16:9"}) na
        identidade do canal, com o texto da capa e um prompt em inglês pra você gerar a imagem.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-suave">Paleta do canal:</span>
        {canalObj.paleta.map((c) => (
          <span key={c} title={c} className="w-5 h-5 rounded-full border border-borda" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>

    {/* referencias */}
    <div className="space-y-2">
      <label className="text-sm text-suave block">
        Referências de capa <span className="text-suave/70">(opcional, até 3 imagens)</span>
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => { adicionarReferencias(e.target.files); e.target.value = ""; }}
        disabled={referencias.length >= 3}
        className="block text-sm text-suave file:mr-3 file:rounded-lg file:border-0 file:bg-painel file:px-3 file:py-2 file:text-texto"
      />
      {referencias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {referencias.map((r, i) => (
            <div key={i} className="relative">
              <img src={`data:${r.media_type};base64,${r.data}`} alt="" className="w-20 h-20 object-cover rounded-lg border border-borda" />
              <button
                onClick={() => removerReferencia(i)}
                className="absolute -top-2 -right-2 bg-fundo border border-borda rounded-full w-5 h-5 text-xs text-suave hover:text-red-400"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>

    <button
      onClick={rodarPasso4}
      disabled={carregando4}
      className="bg-destaque text-black font-semibold rounded-lg px-5 py-3 hover:brightness-110 disabled:opacity-40"
    >
      {carregando4 ? "Pensando nas capas..." : capa ? "Sugerir de novo" : "Sugerir capas"}
    </button>

    {(carregando4 || capa) && (
      <Resultado titulo="Conceitos de capa" conteudo={capa} gerando={carregando4} status={status4} nomeArquivo="capa.txt" />
    )}
  </section>
)}
```

- [ ] **Step 12: Verificar no navegador** (`npm run dev`): concluir Fonte→Roteiro→Imagens, ir pra Capa, ver a paleta, gerar 3 conceitos; anexar 1-2 imagens e gerar de novo; recarregar a página e ver a capa salva no vídeo.

- [ ] **Step 13: Commit** — `feat: Passo 4 - sugestao de capa com paleta e upload de referencias`

---

## Task 6: Verificação final e publicação

- [ ] **Step 1: Build + testes** — `npm run build` e `npm test` (verde).
- [ ] **Step 2: Checklist manual:**
  - [ ] Paleta aparece no Passo 4 de cada canal (cores diferentes).
  - [ ] Passo 4 destrava após o Passo 3; 3 conceitos completos, no formato certo.
  - [ ] Upload de 1-3 referências funciona e influencia as sugestões; remover funciona.
  - [ ] Capa persiste no histórico; nada do que existe quebrou (insight, fila, 4 canais).
- [ ] **Step 3: Publicar** — `git push origin main` (deploy automático).
- [ ] **Step 4: Docs** — marcar itens 1 e 2 como feitos no `docs/roadmap.md` e atualizar `docs/CONTEXTO-DO-PROJETO.md` (features no ar + Passo 4).

---

## Notas de execução

- **Paleta editável pela tela** e **gerar a imagem pronta** ficam para fases futuras (nuvem / API de imagem).
- **Referências**: redimensionadas para máx. 1024px e JPEG q=0.82 no navegador, máx. 3 — segura o limite de payload da Vercel.
- **page.tsx** cresce de novo; extrair hooks continua sendo um refactor futuro, fora do escopo.
