# Fundação Multi-canal — Design (Estudio Dark)

- **Data:** 2026-07-25
- **Status:** Aprovado no brainstorming — aguardando revisão final do spec
- **Sub-projeto:** 1 de N (Caminho A: fundação multi-canal primeiro, esteira depois)

---

## 1. Contexto e problema

O Estudio Dark (`plataforma-ytb`) gera, em três passos, o material de um vídeo:
**Fonte** (dossiê com checagem de fatos) → **Roteiro** (narrado) → **Imagens** (prompts de vídeo).

Hoje a "voz" da plataforma — tom do roteiro, regras da pesquisa e estilo dos prompts de
imagem — está **fixa e única** em `lib/voz.ts`. O objetivo do usuário é operar **3 canais de
nichos bem diferentes**, em **alto volume**:

- **História do Brasil** — narrativa factual.
- **Conspirações** — suspense investigativo, honesto.
- **Inspiracional / desenvolvimento pessoal** — motivacional, calorosa.

Três nichos tão distintos precisam de **vozes próprias** e, em alguns casos, de **fluxos
próprios** (o Inspiracional não parte de uma notícia a conferir). Uma voz única não serve.

## 2. Objetivo

Transformar a plataforma de "1 voz" em "3 canais": o usuário escolhe um **Canal** e produz
vídeos com a voz, o fluxo e o visual daquele nicho, com **histórico separado por canal**.

Esta é a **fundação** — o alicerce sobre o qual as fases seguintes (pautas, narração,
metadados, vídeo, publicação) serão construídas, cada uma em seu próprio spec.

## 3. Escopo

**Entra nesta fase:**
- Conceito de **Canal** (perfil) com identidade, voz, fluxo e estilo visual.
- Os **3 canais** definidos abaixo.
- **Seletor de canal** na interface.
- **Passo 1 adaptável** por canal (pesquisa com checagem forte / pesquisa que separa fato de
  especulação / campo livre sem checagem).
- **Histórico separado por canal** (localStorage, por enquanto).
- Cada vídeo salvo **guarda a qual canal pertence**.

**Fora desta fase (viram specs próprios depois):**
- Geração de pautas/temas em lote.
- Narração (áudio a partir do roteiro).
- Título, descrição e tags automáticos.
- Thumbnail.
- Geração e montagem de vídeo.
- Publicação no YouTube.
- Banco de dados online (Supabase) e acesso multi-PC do histórico.
- Edição de perfis de canal pela interface (por ora, perfis vivem no código).

## 4. O conceito de "Canal"

Um Canal é um **perfil** definido em código. Estrutura proposta (`lib/canais/tipos.ts`):

```ts
export interface Canal {
  id: string;          // "historia-brasil" | "conspiracoes" | "inspiracional"
  nome: string;        // "História do Brasil"
  emoji: string;       // "🇧🇷"
  cor: string;         // cor de destaque da UI (ex: classe Tailwind ou hex)
  descricao: string;   // subtítulo curto do canal

  // COMO O PASSO 1 FUNCIONA
  entrada: {
    modo: "pesquisa" | "livre"; // pesquisa = busca web + monta material; livre = desenvolve o tema
    buscaWeb: boolean;          // se o passo 1 usa web_search
    label: string;              // rótulo do campo na tela
    placeholder: string;        // exemplo dentro do campo
  };

  // A VOZ: os system prompts de cada passo (o que hoje está em voz.ts)
  prompts: {
    passo1: string;   // dossiê (pesquisa) OU desenvolvimento do tema (livre)
    roteiro: string;  // a voz do roteiro narrado
    imagens: string;  // estilo visual dos prompts de imagem
  };

  modelo?: string;    // opcional: override do modelo (ex: claude-sonnet-5 pra gastar menos)
}
```

O `VideoSalvo` (em `lib/tipos.ts`) ganha um campo novo:

```ts
export interface VideoSalvo {
  canal: string;   // NOVO: id do canal a que este vídeo pertence
  // ...campos atuais (id, titulo, data, fonte, extras, dossie, fontes, roteiro, meta, prompts, passoMax)
}
```

## 5. Os três canais

### 🇧🇷 História do Brasil
- **Voz do roteiro:** contador de histórias — "senta que lá vem história". Envolvente e humano,
  frases curtas, sem cara de IA, mantendo o rigor dos fatos. (Herda a voz atual do `voz.ts`.)
- **Passo 1:** `modo: pesquisa`, `buscaWeb: true`, **checagem de fatos forte** (regras atuais do
  `SYSTEM_FONTE`). Campo: "Fonte da informação (transcrição, link ou notícia)".
- **Visual:** sépia, tons terrosos, textura de época, atmosfera de arquivo histórico.

### 🕵️ Conspirações
- **Voz do roteiro:** intrigante e questionadora, cria suspense ("o que não te contaram..."),
  **equilibrada** — prende com o gancho, mas sempre deixa claro o que é fato e o que é teoria.
- **Passo 1:** `modo: pesquisa`, `buscaWeb: true`. O prompt do dossiê **separa explicitamente**
  "o que se sabe (confirmado)" de "o que é especulação/teoria", para o roteiro apresentar a
  teoria de forma envolvente **sem afirmar mentira como verdade** (proteção contra strikes e
  contra espalhar desinformação). Campo: "Assunto ou teoria que você quer investigar".
- **Visual:** sombrio, alto contraste, sombras, clima noir e tenso.

### 🌅 Inspiracional / Desenvolvimento pessoal
- **Voz do roteiro:** calorosa, próxima, encorajadora — fala que levanta, tom de conversa de
  coração. (Mantém as regras anti-"cara de IA" e de narração falada.)
- **Passo 1:** `modo: livre`, **sem checagem de fatos obrigatória**. Campo único e livre que
  aceita **um tema, uma frase/citação ou uma história** ("O que você quer passar nesse vídeo?").
  `buscaWeb: true`, porém usada **apenas para enriquecer** (trazer histórias/exemplos reais que
  ilustrem o tema), **nunca para "conferir fatos"**. O roteiro não depende da web: se ela não
  trouxer nada útil, o vídeo se sustenta no desenvolvimento do próprio tema.
- **Visual:** luz, amanhecer, natureza, tons quentes, sensação de movimento pra frente.

## 6. Arquitetura e mudanças no código

1. **`lib/voz.ts` → pasta `lib/canais/`:**
   - `lib/canais/tipos.ts` — a interface `Canal` e helpers.
   - `lib/canais/historia-brasil.ts`, `conspiracoes.ts`, `inspiracional.ts` — um perfil cada.
   - `lib/canais/index.ts` — lista os canais e expõe `getCanal(id)` (com fallback/erro claro).
   - As funções utilitárias atuais do `voz.ts` que **não** são específicas de voz (montar
     mensagens, `fatiarRoteiro`, contagem/estimativa de tempo) migram para um módulo neutro
     (ex: `lib/roteiro-utils.ts`), reaproveitadas por todos os canais.

2. **Rotas de API** (`app/api/{fonte,roteiro,prompts}/route.ts`):
   - Cada requisição passa a incluir `canal` (id). A rota chama `getCanal(id)` e usa
     `canal.prompts.*` no lugar das constantes fixas.
   - A rota do passo 1 respeita `canal.entrada.modo`/`buscaWeb` (com ou sem `web_search`).
   - Validação: canal inexistente → resposta de erro clara (400).

3. **Interface** (`app/page.tsx`):
   - **Seletor de canal** no topo (os 3 canais, com emoji/cor). O canal ativo fica guardado.
   - O passo 1 se adapta ao `canal.entrada` (label, placeholder, e se é "fonte" ou "tema livre").
   - O **histórico** mostra só os vídeos do canal ativo.
   - Ao criar/salvar um vídeo, grava o `canal` atual.

## 7. Persistência (nesta fase)

- Continua em **localStorage**, mas as entradas passam a carregar o campo `canal`.
- A leitura do histórico filtra pelo canal ativo.
- O formato já fica **pronto para migração**: quando o banco (Supabase) entrar, é só trocar a
  camada de leitura/escrita, sem mudar o formato dos dados nem a UI.
- **Sem migração de dados legados** necessária (o usuário começa do zero, sem histórico).

## 8. Tratamento de erros

- `getCanal(id)` com id inválido/ausente → erro explícito; a rota responde 400 com mensagem
  amigável ("Canal não reconhecido").
- A UI sempre garante um canal ativo válido (default para o primeiro canal se o guardado sumir).
- Os tratamentos atuais das rotas (texto curto demais, JSON inválido, limites) são mantidos.

## 9. Testes

Focar nas partes **puras e determinísticas** (sem chamar a API da Anthropic):
- `getCanal(id)` — retorna o canal certo; erro para id inválido; default coerente.
- Montagem de mensagens por canal — usa os prompts do canal correto conforme o `modo`.
- `fatiarRoteiro` e utilidades de tempo — comportamento preservado após a migração para o
  módulo neutro (testes de regressão simples).
- Persistência por canal — salvar/ler filtrando por canal (pode ser testado na camada de dados).

## 10. Critérios de sucesso

- Dá para trocar entre os 3 canais na interface e cada um gera com **voz visivelmente diferente**.
- O canal **Inspiracional** aceita um tema livre e gera um roteiro **sem** exigir fonte/checagem.
- O canal **Conspirações** entrega um dossiê que **separa fato de especulação**.
- O histórico mostra os vídeos **separados por canal**.
- Adicionar um 4º canal no futuro é só criar um arquivo em `lib/canais/` e listá-lo.
- Nada do que já funciona hoje quebra.

## 11. Próximas fases (contexto, fora deste spec)

Cada uma vira seu próprio spec, na ordem de retorno:
1. **Pautas em lote** — gerar temas/ideias por canal.
2. **Narração** — áudio do roteiro (voz por canal), via API de TTS.
3. **Metadados** — título, descrição e tags junto com o roteiro.
4. **Persistência online (Supabase)** — histórico multi-PC, alto volume.
5. **Vídeo + thumbnail** — a parte cara; decisão de estilo que escale.
6. **Publicação** — upload no YouTube (respeitando limites de cota).
