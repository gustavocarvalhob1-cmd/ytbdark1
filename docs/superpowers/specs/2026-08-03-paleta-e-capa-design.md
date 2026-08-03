# Paleta de Cores por Canal + Passo 4 (Capa/Thumbnail) — Design

- **Data:** 2026-08-03
- **Status:** Aprovado no brainstorming — o usuário autorizou seguir direto para o plano/implementação
- **Sub-projeto:** 4 (duas features do roadmap, feitas juntas: identidade visual + sugestão de capa)

---

## 1. Contexto e objetivo

Hoje o fluxo vai até o Passo 3 (prompts de imagem). Faltam duas coisas do roadmap, que
andam juntas:

- **A. Paleta de cores por canal** — cada canal ganha uma identidade visual (um conjunto de
  cores) que alimenta as sugestões de capa, mantendo a "cara" do canal consistente.
- **B. Passo 4 — Capa (thumbnail)** — depois de finalizar o vídeo, a IA sugere **3 conceitos
  de capa** (composição, o texto grande da capa, elementos visuais, enquadramento) + um
  **prompt em inglês** pronto pra gerar a imagem. O usuário pode **anexar imagens de
  referência** (capas de outros vídeos) e a IA analisa o estilo (a API da Anthropic é
  multimodal).

Continua tudo **client-side** (roda com a aba aberta), histórico no `localStorage`.

## 2. Escopo

**Entra:**
- Campo `paleta: string[]` (cores hex) no tipo `Canal`, preenchido nos 4 canais.
- Passo 4 novo na tela, com botão de gerar, upload de referências e resultado copiável/baixável.
- Rota nova `POST /api/capa` (streaming, `maxDuration = 300`, multimodal).
- Capa = **conceito + prompt de imagem** (o usuário gera a imagem final na ferramenta dele).
- Capa respeita o **formato** ativo: 16:9 (YouTube) ou 9:16 (TikTok).
- Persistência do texto da capa no histórico (`capa?: string` no `VideoSalvo`).

**Fora (fases futuras):**
- Paleta **editável pela tela** (precisa de nuvem/Supabase — mesmo item de persistência).
- **Gerar a imagem pronta** da capa (exigiria integrar uma API de geração de imagem).
- Capa na fila (a fila continua indo só até o roteiro).

## 3. Feature A — Paleta por canal

- `Canal` ganha `paleta: string[]` — a primeira cor é a `cor` de destaque já existente, seguida
  de 3 a 4 cores que compõem a identidade. Definidas em código, por canal (rápido, sem nuvem):
  - 🇧🇷 História: sépia/terroso (âmbar, terracota, creme, marrom escuro).
  - 🕵️ Conspirações: noir (violeta, quase-preto, cinza-violeta, vermelho de alerta).
  - 🌅 Inspiracional: amanhecer (dourado, laranja, pêssego, azul-céu, creme).
  - 💰 Finanças: verde/dourado (verde, dourado, verde escuro, creme).
- A paleta aparece como **amostras de cor** (bolinhas) no Passo 4, mostrando a identidade que
  está sendo aplicada, e alimenta a mensagem enviada à IA.

## 4. Feature B — Passo 4 (Capa)

### Fluxo
1. O Passo 4 **destrava quando o Passo 3 é concluído** (segue o padrão "terminar um passo
   libera o próximo"; o roadmap prevê a capa "depois de finalizar o vídeo").
2. O usuário pode **anexar até 3 imagens de referência** (opcional). Cada imagem é
   **redimensionada no navegador** (máx. ~1024px, re-codificada em JPEG) antes de enviar, pra
   caber no limite de tamanho de requisição da Vercel (~4,5 MB) e economizar.
3. Clica em **"Sugerir capas"** → chama `/api/capa` com o tema/roteiro, a paleta, o formato e as
   referências → a IA devolve, em streaming, **3 conceitos** numerados.
4. O resultado sai no componente `Resultado` (copiar / baixar `capa.txt`).

### Formato de cada conceito (o que a IA entrega)
Para cada uma das 3 capas:
- **CONCEITO** — a ideia em uma linha.
- **TEXTO DA CAPA** — o texto grande, curto e impactante, em português (o que vai escrito na
  thumb). Honesto, sem clickbait mentiroso.
- **COMPOSIÇÃO** — enquadramento e disposição dos elementos (respeitando 16:9 ou 9:16).
- **ELEMENTOS** — o que aparece (objetos, cena, expressão), coerente com o canal.
- **CORES** — quais cores da paleta usar e onde.
- **PROMPT (inglês)** — prompt pronto pra gerar a imagem em outra ferramenta.

### Rota
- `POST /api/capa` — body `{ canal, formato, tema, roteiro, referencias?: {media_type,data}[] }`
  → stream de texto (os 3 conceitos).
- System genérico (`lib/voz-capa.ts` → `SYSTEM_CAPA`), recebendo a identidade do canal
  (nome, descrição, paleta), o formato e o conteúdo via a mensagem do usuário.
- Se vierem referências, entram como **blocos de imagem** no `messages` (multimodal); o system
  manda analisar o estilo e propor no mesmo tom.

## 5. Arquitetura e mudanças no código

1. **`lib/canais/tipos.ts`** — novo campo `paleta: string[]` em `Canal`.
2. **`lib/canais/<id>.ts`** (4 arquivos) — cada um ganha sua `paleta`.
3. **`lib/tipos.ts`** — `VideoSalvo` ganha `capa?: string`.
4. **`lib/voz-capa.ts`** (novo) — `SYSTEM_CAPA` (genérico, honesto, formato de saída dos 3
   conceitos).
5. **`lib/roteiro-utils.ts`** — funções puras novas:
   - `instrucaoFormatoCapa(formato)` — orientação 16:9 / 9:16 da capa.
   - `mensagemCapa({ canalNome, canalDescricao, paleta, tema, roteiro, formato, temReferencias })`
     — monta a mensagem do usuário (inclui a paleta, o formato, o tema/roteiro e avisa se há
     referências anexadas).
6. **`app/api/capa/route.ts`** (novo) — auth + streaming (mesmo padrão), monta `content` com
   texto + imagens, valida `media_type`, limita a 3 referências.
7. **`app/page.tsx`:**
   - `type Passo = 1 | 2 | 3 | 4`; `Stepper` ganha `[4, "Capa"]`.
   - Estado: `capa`, `carregando4`, `status4`, `referencias: {media_type,data}[]`.
   - `redimensionarImagem(file)` (canvas → JPEG base64) e handlers de upload/remoção.
   - `rodarPasso4` (chama `/api/capa`).
   - `rodarPasso3` bem-sucedido passa `passoMax` para 4; botão "Continuar para a capa →".
   - Persistência: `capa` entra no `VideoSalvo` (salvar, `aplicarVideo`, `novoVideo`).

## 6. Tratamento de erros

- `/api/capa`: canal inválido → 400; sem roteiro/tema → 400; `media_type` de imagem não
  suportado → ignora aquela imagem (aceita jpeg/png/webp/gif).
- Upload: arquivo que não for imagem ou acima do limite → aviso amigável, não quebra a tela.
- Se a IA não seguir o formato exatamente, o texto ainda é útil (é copiável como está).

## 7. Testes (partes puras, Vitest)

- `instrucaoFormatoCapa("youtube")` menciona 16:9; `("tiktok")` menciona 9:16.
- `mensagemCapa(...)` inclui o tema, as cores da paleta e a orientação do formato; menciona as
  referências só quando `temReferencias` é `true`.
- (A rota multimodal, o upload/redimensionamento e a tela são verificados no navegador.)

## 8. Critérios de sucesso

- Cada canal mostra sua paleta (amostras de cor) no Passo 4.
- Concluir o Passo 3 libera o Passo 4; clicar em "Sugerir capas" traz 3 conceitos completos,
  no formato/paleta do canal, copiáveis e baixáveis.
- Anexar 1–3 referências faz a IA propor capas no estilo delas.
- O texto da capa fica salvo no histórico do vídeo; nada do que já existe quebra.
