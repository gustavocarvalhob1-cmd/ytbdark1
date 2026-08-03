# Roadmap / Backlog — Estudio Dark

Ideias e próximas fases além da **Fundação Multi-canal** (já implementada, ver `docs/superpowers/`).
Cada item vira seu próprio spec → plano → implementação quando for a vez.

---

## Ideias do Gustavo (a fazer)

### 1. Paleta de cores por canal (identidade visual) — ✅ FEITO (2026-08-03)
- No início da plataforma / na configuração de cada canal, o usuário define a **paleta de cores do canal** (sua identidade visual).
- Essa paleta alimenta outras partes da plataforma (principalmente as sugestões de capa) pra manter a cara do canal consistente.
- **Notas técnicas:** hoje os canais são perfis em código (`lib/canais/<id>.ts`). A paleta pode virar um campo do `Canal` (ex: `paleta: string[]` com cores hex) e/ou uma config editável pela tela — o que puxaria persistência/edição de perfil.

### 2. Sugestões de capa (thumbnail) pro YouTube — ✅ FEITO (2026-08-03)
- **Quando:** depois de finalizar o vídeo (um novo passo, ex: "Passo 4 — Capa").
- **O que:** a plataforma sugere **3 opções de capa**, com ideias/conceitos (composição, texto grande da capa, elementos visuais, enquadramento).
- **Referências do usuário:** o usuário pode **anexar imagens** (upload) que buscou de outros vídeos, como referência de estilo. → precisa de **upload de imagens** na interface.
- **Identidade visual:** as sugestões seguem a **paleta de cores do canal** (item 1).
- **Notas técnicas:**
  - A API da Anthropic é **multimodal** — dá pra enviar as imagens de referência pro Claude analisar o estilo e sugerir capas no mesmo tom.
  - **Decisão de design pendente:** as "capas" saem como **conceitos/descrições + prompt de imagem** (o usuário gera a imagem final em outra ferramenta), ou a plataforma **gera a imagem pronta** (exigiria integrar uma API de geração de imagem, ex: modelos de imagem)? Sugestão: começar por conceito + prompt, e a imagem final numa fase seguinte.

---

## Próximas fases já mapeadas (do spec da fundação)

1. Pautas em lote (temas por canal)
2. Narração (áudio do roteiro, voz por canal — TTS)
3. Título, descrição e tags automáticos
4. ~~Paleta do canal (item 1) + Capa/thumbnail (item 2)~~ — ✅ FEITO (2026-08-03). Falta: paleta editável pela tela e gerar a imagem pronta (fases futuras).
5. Geração e montagem de vídeo
6. Publicação no YouTube
7. Persistência online (Supabase) — histórico multi-PC
