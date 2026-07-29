# Controles de Geração (Duração + Formato) e Canal Finanças — Design

- **Data:** 2026-07-28
- **Status:** Aprovado no brainstorming — aguardando revisão final do spec
- **Sub-projeto:** 2 (o 1 foi a Fundação Multi-canal)

---

## 1. Contexto e objetivo

O Estudio Dark hoje gera vídeos com **duração fixa** (8-12 min / 1040-1560 palavras, embutida no prompt de cada canal) e **um único formato** de imagem (horizontal implícito). Três mudanças, feitas juntas:

- **A. Duração:** o usuário escolhe quantos minutos o vídeo deve ter.
- **B. Formato:** YouTube (16:9) ou TikTok (9:16), afetando **imagens e estilo do roteiro**.
- **C. Canal Finanças:** um 4º canal (educação financeira), no mesmo esquema dos atuais.

Duração e Formato são controles que valem para **todos os canais**. O canal Finanças é só mais um perfil — a arquitetura multi-canal já o suporta.

## 2. Escopo

**Entra:**
- Controle de **duração** (campo numérico) na primeira tela.
- Controle de **formato** (2 botões YouTube/TikTok) na primeira tela.
- Roteiro que respeita a duração escolhida e o estilo do formato.
- Prompts de imagem na orientação do formato (16:9 / 9:16).
- Novo canal **Finanças** (educação financeira).
- Histórico guarda a duração e o formato usados.

**Fora (fases futuras):**
- Canais editáveis pela UI (feature #4 do usuário — exige persistência/nuvem).
- Modo "insight" com diálogo de direções (feature #1 — sub-projeto próprio).
- Geração real de imagem/vídeo, narração, etc.

## 3. Feature A — Duração

- **UI:** um campo numérico "Duração (min)" no topo da primeira tela. Padrão **10**. Aceita inteiros de **1 a 20**. Sempre editável.
- **Comportamento:** a duração é injetada como instrução no **Passo 2 (roteiro)**:
  `alvo = minutos × 130 palavras` (ritmo de narração de 130 wpm), com faixa `minutos × 115` a `minutos × 145`.
- O **Passo 3 (cenas)** continua usando `meta.duracaoSegundos` (estimado a partir do roteiro real), então se ajusta sozinho ao tamanho.
- A seção fixa **"TAMANHO ... 1040 a 1560 palavras"** é **removida** dos prompts de roteiro dos canais (o tamanho passa a ser dinâmico).

## 4. Feature B — Formato

- **UI:** dois botões, **YouTube** e **TikTok**, no topo da primeira tela. Padrão **YouTube**.
- **Interação com a duração:** ao clicar **TikTok**, a duração sugere **1 min**; ao clicar **YouTube**, sugere **10 min**. Ambos apenas *sugerem* — o campo continua editável (o usuário pode fazer um TikTok de 5 min, por exemplo).
- **Efeito no roteiro (Passo 2):**
  - **YouTube:** jornada desenvolvida (comportamento atual).
  - **TikTok:** instrução extra — direto ao ponto, gancho nos **primeiros segundos**, ritmo rápido, sem rodeios.
- **Efeito nas imagens (Passo 3):**
  - **YouTube:** prompts com composição **horizontal (16:9)**.
  - **TikTok:** prompts com composição **vertical (9:16)**.

## 5. Feature C — Canal Finanças (educação financeira)

Perfil no mesmo formato de `lib/canais/<id>.ts`:

- **id:** `financas` · **nome:** "Finanças" · **emoji:** 💰 · **cor:** verde (ex: `#4caf7d`)
- **descrição:** "Educação financeira que descomplica o dinheiro"
- **entrada:** `modo: "pesquisa"`, `buscaWeb: true`, label "Tema de finanças que você quer explicar", placeholder com exemplos (ex: "como sair do cheque especial, o que é reserva de emergência..."), rotuloBotao "Pesquisar e montar o material".
- **prompts:**
  - **passo1:** pesquisa dados corretos (taxas, regras reais) e monta material **didático** e estruturado; nunca inventa número; separa o que é fato do que é opinião.
  - **roteiro:** voz de "amigo que manja de dinheiro e explica sem economês" — didático, leve, exemplos do dia a dia, encorajador (não julga quem está endividado). **Cuidado editorial:** foca em educação/hábitos, **nunca** recomendação de investimento específica ("compre X"). Mesmas regras anti-IA e de narração falada dos outros canais. **Sem** a seção de TAMANHO fixa (duração é dinâmica).
  - **imagens:** estilo visual limpo e moderno, tons de verde/dourado, cofrinho, moedas, gráficos simples, cenas do dia a dia (contas, mercado, casa).

## 6. Arquitetura e mudanças no código

1. **`lib/roteiro-utils.ts`** ganha funções modificadoras (puras, testáveis):
   - `instrucaoDuracao(minutos: number): string` — bloco de tamanho para o roteiro.
   - `instrucaoFormatoRoteiro(formato: "youtube" | "tiktok"): string` — bloco de estilo ("" para youtube; instrução direta/rápida para tiktok).
   - `instrucaoFormatoImagens(formato): string` — orientação 16:9 / 9:16 para os prompts de imagem.
   - `mensagemRoteiro` e `mensagemPrompts` passam a receber esses modificadores e anexá-los.
2. **Tipos** (`lib/tipos.ts`): `type Formato = "youtube" | "tiktok"`. `VideoSalvo` ganha `duracaoMin?: number` e `formato?: Formato` (opcionais, retrocompatíveis).
3. **Rotas:**
   - `/api/roteiro`: recebe `duracaoMin` e `formato`; injeta `instrucaoDuracao` + `instrucaoFormatoRoteiro`.
   - `/api/prompts`: recebe `formato`; injeta `instrucaoFormatoImagens`.
   - `/api/fonte`: **inalterada** (o dossiê não depende de duração/formato).
   - Validação: duração fora de 1-20 é ajustada para o limite; formato inválido cai em "youtube".
4. **Canais:** os 3 prompts de roteiro atuais têm a seção "TAMANHO" removida. Novo `lib/canais/financas.ts` criado e adicionado ao `CANAIS` em `lib/canais/index.ts`.
5. **Frontend (`app/page.tsx`):** estado `duracao` (number) e `formato` (Formato), guardados no localStorage (última escolha) e no `VideoSalvo`. Controles no topo do Passo 1. `duracao`/`formato` incluídos no corpo das chamadas de roteiro e prompts. Ao trocar formato, ajusta a duração sugerida.

## 7. Tratamento de erros / casos de borda

- Duração vazia ou inválida → usa o padrão (10) na UI; a rota trava em 1-20.
- Vídeo muito curto (1-2 min): a instrução de tamanho força concisão; o estilo TikTok ajuda. Sem tratamento especial extra.
- Vídeos antigos no histórico sem `duracaoMin`/`formato` → assumem padrão (10 / youtube) ao reabrir.

## 8. Testes (partes puras, Vitest)

- `instrucaoDuracao(min)` — contém o número de minutos e a faixa de palavras calculada; 1 min e 20 min dão faixas coerentes.
- `instrucaoFormatoRoteiro("youtube")` vazio; `("tiktok")` menciona gancho rápido/direto.
- `instrucaoFormatoImagens` — youtube menciona 16:9/horizontal; tiktok menciona 9:16/vertical.
- Registro de canais — agora **4 canais** com ids únicos, incluindo `financas`; todos com os 3 prompts preenchidos.

## 9. Critérios de sucesso

- Dá pra digitar a duração e o roteiro gerado fica **perto** dos minutos pedidos.
- Trocar YouTube↔TikTok muda a orientação dos prompts de imagem e o estilo do roteiro; a duração sugerida acompanha mas continua editável.
- O canal **Finanças** aparece na barra, gera com voz didática e material com dados pesquisados (sem recomendação de investimento).
- Nada do que já funciona quebra; os controles valem para todos os 4 canais.

## 10. Próximas features (contexto, fora deste spec)

- **Modo insight** (feature #1): Passo 1 aceita ideia solta e a IA propõe ângulos.
- **Canais editáveis pela UI** (feature #4): exige persistência/nuvem (Supabase).
