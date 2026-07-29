# Fila de Roteiros + Modo Insight — Design

- **Data:** 2026-07-29
- **Status:** Aprovado no brainstorming — o usuário autorizou seguir direto para o plano/implementação
- **Sub-projeto:** 3 (duas features do Passo 1, feitas juntas)

---

## 1. Contexto e objetivo

O Estudio Dark gera um vídeo por vez, sempre partindo de uma fonte já "pronta". Duas features aceleram a produção:

- **A. Modo Insight:** partir de uma **ideia solta** — a IA propõe ângulos, o usuário escolhe (ou escreve o seu), a IA confirma o rumo e o usuário autoriza antes de gerar.
- **B. Fila:** adicionar **várias fontes** e processá-las uma após a outra, cada uma virando um vídeo (Fonte → Roteiro) no histórico.

Ambas vivem no começo do fluxo (Passo 1) e valem para qualquer canal. A geração continua **client-side** (roda enquanto a aba está aberta).

## 2. Escopo

**Entra:**
- Modo Insight individual: ângulos (3-5) + campo livre → confirmação de rumo → autorização → segue o fluxo normal.
- Fila client-side: lista de itens, "rodar fila", processa Fonte → Roteiro por item, salva cada um no histórico, com progresso e botão de parar.
- Duas rotas novas: `/api/angulos` e `/api/direcao`.

**Fora (fases futuras):**
- Fila no servidor (roda com a aba fechada) — exige nuvem/Supabase.
- Fila indo até as imagens (por ora vai só até o roteiro).
- Canais editáveis pela UI.

## 3. Feature A — Modo Insight

### Fluxo (sub-etapas dentro do Passo 1)
1. **Ideia:** o usuário digita uma ideia solta e clica no botão **"💡 Explorar ângulos"** (ao lado do botão normal do Passo 1).
2. **Ângulos:** chama `/api/angulos` → a IA devolve **de 3 a 5 ângulos** numerados (curtos e concretos), levando em conta o **nicho do canal ativo**. A UI mostra cada ângulo como um item selecionável **mais um campo livre** ("ou escreva o ângulo que você quer").
3. **Escolha:** o usuário seleciona um ângulo **ou** digita o próprio, e clica **"Enviar ângulo"**.
4. **Confirmação:** chama `/api/direcao` (ideia + ângulo escolhido) → a IA devolve **um parágrafo curto** confirmando o rumo (foco, tom, o que vai explorar), pra mostrar que entendeu.
5. **Autorização:** o usuário lê e clica **"Seguir com esse rumo"** → o modo insight monta a fonte base (`montarFonteInsight`) e segue o **fluxo normal** do Passo 1 (dossiê → roteiro → imagens). Ou pode voltar e ajustar o ângulo.

### Rotas
- `POST /api/angulos` — body `{ ideia, canal }` → stream de texto (lista numerada de 3-5 ângulos). System: propor caminhos, não escrever o vídeo; considerar o nicho do canal.
- `POST /api/direcao` — body `{ ideia, angulo, canal }` → stream de texto (parágrafo curto confirmando o rumo). System: confirmar entendimento, sem escrever o roteiro.

### Base para o fluxo (após autorizar)
`montarFonteInsight(ideia, angulo, direcao)` monta um texto estruturado
(`IDEIA: ... / CAMINHO ESCOLHIDO: ... / <direcao>`) que entra como a "fonte" do Passo 1 —
o `/api/fonte` do canal (modo pesquisa ou livre) segue normal a partir daí.

## 4. Feature B — Fila (client-side)

### UI
- Botão **"🗂️ Modo fila"** perto de "+ Novo vídeo".
- Área da fila: um campo de texto + botão **"Adicionar à fila"** (cada clique vira um item — lida com transcrições multi-linha). Uma **lista dos itens** em espera, cada um removível.
- Botões **"Rodar fila (N)"** e, enquanto roda, **"Parar"** + indicador *"processando 2 de 5..."*.

### Comportamento
- A fila usa o **canal + duração + formato ativos** no momento (config global — escolhidos antes de rodar).
- `rodarFila` percorre os itens em ordem; para cada um: cria um id novo, chama `/api/fonte` (dossiê) e depois `/api/roteiro` (roteiro), monta um `VideoSalvo` (com `canal`, `duracaoMin`, `formato`) e **adiciona ao histórico**.
- Não exibe o streaming de cada item — só o **progresso**. Ao terminar (ou parar), some o indicador; os itens processados ficam no histórico do canal.
- Se um item falhar, registra o erro naquele item e **continua** para o próximo.
- Parar interrompe **após** o item atual terminar (não corta no meio de uma geração).

## 5. Arquitetura e mudanças no código

1. **`lib/roteiro-utils.ts`** ganha funções puras:
   - `mensagemAngulos(ideia: string): string`
   - `mensagemDirecao(ideia: string, angulo: string): string`
   - `montarFonteInsight(ideia: string, angulo: string, direcao: string): string`
2. **`lib/voz-insight.ts`** (novo) — os system prompts `SYSTEM_ANGULOS` e `SYSTEM_DIRECAO` (genéricos, recebem o nicho do canal via mensagem).
3. **Rotas novas:** `app/api/angulos/route.ts` e `app/api/direcao/route.ts` (mesmo padrão das existentes: auth + streaming; sem web_search).
4. **Frontend (`app/page.tsx`):**
   - Estado do modo insight: `faseInsight` (`"off" | "ideia" | "angulos" | "direcao"`), `ideiaInsight`, `angulosTexto`, `anguloEscolhido`, `direcaoTexto`.
   - Estado da fila: `modoFila`, `filaItens: string[]`, `filaRodando`, `filaProgresso` (`{atual, total}`), com uma ref de "parar".
   - Botões e telas dos dois modos no Passo 1 / cabeçalho.
   - `page.tsx` já é grande; a lógica da fila e do insight fica em funções bem nomeadas no componente (ou, se crescer demais, extrair um hook `useFila`/`useInsight` — decisão do plano).

## 6. Tratamento de erros

- `/api/angulos` e `/api/direcao`: ideia/ângulo muito curtos → erro 400 amigável; canal inválido → 400.
- Fila: item que falha não derruba a fila — marca o erro e segue; se a senha/API falhar, mostra o erro e para.
- Insight: se a IA não trouxer ângulos utilizáveis, o campo livre sempre permite seguir com o ângulo próprio.

## 7. Testes (partes puras, Vitest)

- `mensagemAngulos(ideia)` inclui a ideia; `mensagemDirecao(ideia, angulo)` inclui os dois.
- `montarFonteInsight` inclui ideia, ângulo e direção no texto final.
- (A orquestração da fila e as telas são verificadas manualmente no navegador.)

## 8. Critérios de sucesso

- **Insight:** digitar uma ideia → ver 3-5 ângulos + campo livre → escolher/escrever → ler a confirmação → autorizar → o vídeo é gerado no rumo escolhido.
- **Fila:** adicionar 3 fontes → rodar → ver o progresso → ao fim, 3 vídeos novos no histórico do canal, cada um com dossiê + roteiro.
- Os dois modos convivem com o fluxo normal e com todos os canais; nada do que existe quebra.
