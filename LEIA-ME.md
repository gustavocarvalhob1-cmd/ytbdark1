# Estudio Dark

Plataforma pessoal para criar conteudo de canais dark no YouTube, em tres passos:

1. **Fonte** — voce cola uma transcricao, um link ou uma noticia. A plataforma confere os fatos na internet e monta um dossie confiavel.
2. **Roteiro** — com o dossie pronto (e as citacoes/argumentos que voce pediu), ela escreve um roteiro narrado de 8 a 12 minutos, na sua voz.
3. **Imagens** — ela estima a duracao e cria prompts de video de ate 8 segundos cada, prontos para colar em ferramentas como Veo, Kling ou Runway.

O "cerebro" e o Claude (Opus 4.8) da Anthropic, com busca na internet embutida para nao inventar fato.

---

## Passo a passo (do zero ao link no celular)

### 1. Criar a chave de API da Anthropic (o motor)

1. Entre em **https://console.anthropic.com** e faca login (ou crie a conta).
2. Va em **Settings → Billing** e coloque um credito (ex.: cinco ou dez dolares ja rende muito video).
3. Va em **Settings → API Keys → Create Key**. Copie a chave (comeca com `sk-ant-...`). **Guarde bem, ela nao aparece de novo.**

Custo por video: normalmente menos de meio dolar cada, um pouco mais se a fonte for bem grande. Da pra gastar menos trocando o modelo (veja o final).

### 2. Rodar no seu PC para testar

1. Nesta pasta, faca uma copia do arquivo `.env.local.example` e renomeie a copia para **`.env.local`**.
2. Abra o `.env.local` e preencha:
   - `ANTHROPIC_API_KEY=` com a chave que voce copiou.
   - `APP_PASSWORD=` com uma senha que voce inventar (para ninguem mais usar o link).
3. No terminal, dentro desta pasta, rode:

```bash
npm run dev
```

4. Abra **http://localhost:3000** no navegador. Pronto, da pra testar o fluxo completo.

### 3. Publicar na internet (Vercel) para abrir de qualquer lugar

Assim voce tem um link que abre no PC do trabalho, no de casa e no celular, sem precisar do seu PC ligado.

**Jeito mais simples (linha de comando):**

1. Instale a ferramenta da Vercel (so uma vez):

```bash
npm install -g vercel
```

2. Nesta pasta, rode:

```bash
vercel
```

Ele vai pedir para voce fazer login (abre o navegador) e responder umas perguntas. Pode aceitar tudo no padrao.

3. Configure as variaveis de ambiente na Vercel (a chave e a senha). Rode:

```bash
vercel env add ANTHROPIC_API_KEY
vercel env add APP_PASSWORD
```

Cole o valor de cada uma quando pedir, e escolha **Production** (pode marcar os tres ambientes).

4. Publique de verdade:

```bash
vercel --prod
```

No final ele mostra o link (algo como `https://estudio-dark.vercel.app`). Esse e o seu link. Abra no celular, salve nos favoritos.

> Sempre que a gente mudar alguma coisa na plataforma, e so rodar `vercel --prod` de novo para atualizar o link.

---

## Variaveis de ambiente

| Variavel            | Para que serve                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Sua chave da Anthropic. **Obrigatoria.**                                        |
| `APP_PASSWORD`      | Senha de acesso. Se ficar vazia, a plataforma abre sem senha (so use em teste). |
| `ANTHROPIC_MODEL`   | Opcional. Padrao `claude-opus-4-8`. Troque por `claude-sonnet-5` para gastar menos. |

---

## Regras que a plataforma ja segue no roteiro

- Frases curtas, texto corrido, tom de amigo passando informacao (sem autoridade).
- Sem travessao, sem cara de "feito por IA", sem dado complexo nem analogia.
- Sem divisoes de "introducao / desenvolvimento / conclusao" (a narracao le tudo em voz alta).
- Ela usa as citacoes e argumentos que voce escrever na caixa do Passo 1.
- Ela se apoia so nos fatos que conferiu, para nao dar problema com o video.

Se quiser mudar o tom ou as regras, tudo isso esta no arquivo `lib/voz.ts`.
