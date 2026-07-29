# Estudio Dark — Contexto do Projeto (memória para retomar)

> Este arquivo resume o estado do projeto e o histórico do trabalho, pra retomar
> em uma nova conversa sem perder contexto. Última atualização: 2026-07-29.

---

## 1. O que é

**Estudio Dark** (pacote npm: `plataforma-ytb`) é uma plataforma web pessoal do Gustavo para
criar conteúdo de canais "dark" no YouTube. Fluxo em 3 passos:
1. **Fonte** — cola uma transcrição/link/notícia (ou uma ideia); a IA confere fatos e monta um dossiê.
2. **Roteiro** — a IA escreve um roteiro narrado na "voz" do canal.
3. **Imagens** — a IA gera prompts de vídeo de até 8s (para Veo/Kling/Runway).

O "cérebro" é o **Claude (Anthropic)**. É tudo **client-side** (roda no navegador), com histórico
salvo no **localStorage** (por navegador, não sincroniza entre PCs ainda).

## 2. Onde vive (infra)

- **Pasta local:** `C:\Users\gusta\Plataforma YTB`
- **GitHub:** `github.com/gustavocarvalhob1-cmd/ytbdark1` (branch `main`)
- **Vercel:** `plataforma-ytb.vercel.app` (scope/time `dark1-plataform`, plano Hobby, projeto `plataforma-ytb`, Root Directory = raiz)
- **Deploy automático:** `git push origin main` → o Vercel publica sozinho em ~1-2 min. (Não precisa mais de token nem CLI.)

## 3. Stack e como rodar

- Next.js 14 (App Router) + React 18 + TypeScript + Tailwind + `@anthropic-ai/sdk`. Testes: **Vitest**.
- **Rodar local:** abrir terminal na pasta do projeto → `npm run dev` → abrir `http://localhost:3000`.
- **Testes:** `npm test`. **Build:** `npm run build`.
- **Variáveis (`.env.local`):** `ANTHROPIC_API_KEY` (obrigatória), `APP_PASSWORD` (senha de acesso; vazio = abre sem senha, bom pra teste local), `ANTHROPIC_MODEL` (padrão `claude-opus-4-8`; `claude-sonnet-5` gasta menos).
- O **site publicado pede a senha** (`APP_PASSWORD` configurada no Vercel — só o Gustavo sabe).

## 4. Estrutura do código

- `app/page.tsx` — toda a interface (um componente grande, client-side). Já está grande; se crescer mais, considerar extrair hooks `useInsight`/`useFila`.
- `app/api/*/route.ts` — rotas de API com streaming: `fonte`, `roteiro`, `prompts`, `ping`, `angulos`, `direcao`.
- `lib/canais/` — um arquivo por canal (`historia-brasil.ts`, `conspiracoes.ts`, `inspiracional.ts`, `financas.ts`) + `tipos.ts` (interface `Canal`) + `index.ts` (`CANAIS`, `getCanal`, `CANAL_PADRAO`).
- `lib/roteiro-utils.ts` — funções puras (montagem de mensagens, `instrucaoDuracao`/`instrucaoFormato*`, `mensagemAngulos`/`mensagemDirecao`/`montarFonteInsight`/`parsearAngulos`).
- `lib/voz-insight.ts` — system prompts do modo insight.
- `lib/anthropic.ts` (cliente + `gerarComStream`), `auth.ts`, `stream.ts`, `cliente.ts` (`streamFetch`), `tipos.ts`.
- `docs/superpowers/specs/` e `docs/superpowers/plans/` — specs e planos de cada feature. `docs/roadmap.md` — backlog.

## 5. Features já implementadas e no ar

1. **Multi-canal** — 4 canais, cada um com voz/fluxo/estilo próprios: 🇧🇷 História do Brasil, 🕵️ Conspirações, 🌅 Inspiracional, 💰 Finanças (educação financeira). Trocar canal no topo; histórico separado por canal.
2. **Duração** — campo de minutos (1-20) no Passo 1; o roteiro mira o tamanho escolhido.
3. **Formato** — botões YouTube (16:9) / TikTok (9:16). TikTok deixa o roteiro mais direto + imagens verticais. Ao trocar formato, a duração sugerida muda (editável).
4. **Modo Insight** — botão "💡 Explorar ângulos": ideia solta → a IA traz 3-5 ângulos (clicáveis) + campo livre → escolher/escrever → a IA confirma o rumo → "Seguir com esse rumo" gera o dossiê. Rotas `/api/angulos` e `/api/direcao`.
5. **Fila** — botão "🗂️ Modo fila": adicionar várias fontes (uma a uma), "Rodar fila" processa Fonte→Roteiro em lote no histórico (roda com a aba aberta), com progresso e botão parar. Histórico guarda 30 itens.

### Como um canal funciona (pra editar a voz)
Cada canal é um perfil em `lib/canais/<id>.ts` com: `id`, `nome`, `emoji`, `cor`, `entrada` (modo `pesquisa`|`livre`, label, placeholder, botão) e `prompts` (`passo1`, `roteiro`, `imagens`). Modo **pesquisa** confere fatos (história, conspiração, finanças); modo **livre** desenvolve o tema sem checar (inspiracional). Pra ajustar o tom de um canal, é só editar o arquivo dele.

## 6. O que falta (roadmap — em `docs/roadmap.md`)

- **Canais editáveis pela tela** (criar/excluir canais na UI) — precisa de persistência/nuvem (Supabase).
- **Sincronizar o histórico entre PCs** (Supabase) — hoje é localStorage, por navegador. É o que faria o trabalho "seguir" o Gustavo entre casa e trabalho.
- **Paleta de cores por canal** + **sugestões de capa (thumbnail)** com upload de imagens de referência (a API da Anthropic aceita imagens).
- Fases seguintes: pautas em lote, narração (TTS), título/descrição/tags, geração/montagem de vídeo, publicação no YouTube.

## 7. Como trabalhamos (fluxo estabelecido)

- Direto na `main`: cada mudança é **implementar → commit → push → deploy automático**.
- Processo por feature: **brainstorming → spec** (`docs/superpowers/specs/`) **→ plano** (`docs/superpowers/plans/`) **→ implementação com testes (TDD)**.
- O **Git Credential Manager** já está autenticado neste PC (o `git push` funciona sem pedir login).

## 8. Perfil do Gustavo / cuidados

- Iniciante em desenvolvimento/ferramentas — prefere **orientação passo a passo**, explicações claras, em português.
- Usa **2 PCs**: casa (este, Windows 11) e o do trabalho. O **código** sincroniza via GitHub (é só `git clone` no outro PC); o **histórico de vídeos NÃO** (localStorage).
- **Segurança já resolvida:** tokens do Vercel revogados; `TOKEN-VERCEL.txt` e os scripts de resgate (`recover.mjs`, `pull-env.mjs`) apagados. A chave da Anthropic fica só no `.env.local` (protegido pelo `.gitignore`).

## 9. Para retomar numa nova conversa

Diga algo como: *"Leia `docs/CONTEXTO-DO-PROJETO.md` e vamos continuar"*. Boas próximas tarefas:
- Trabalhar a **paleta de cores + sugestões de capa** (roadmap), ou
- Encarar a **nuvem (Supabase)** para canais editáveis e histórico sincronizado entre PCs.
