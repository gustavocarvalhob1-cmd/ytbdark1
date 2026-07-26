"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamFetch } from "@/lib/cliente";
import type { Fonte, MetaFinal, VideoSalvo } from "@/lib/tipos";

const CHAVE_HISTORICO = "estudio-dark-historico";
const CHAVE_ATUAL = "estudio-dark-atual";
const CHAVE_SENHA = "estudio-dark-senha";
const MAX_HISTORICO = 10; // guarda os ultimos 10 videos

type Passo = 1 | 2 | 3;

function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function derivarTitulo(v: { roteiro: string; dossie: string; fonte: string }): string {
  const base = (v.roteiro || v.dossie || v.fonte || "").trim();
  if (!base) return "Video sem titulo";
  const primeira = base.split("\n").find((l) => l.trim().length > 0) || base;
  const limpa = primeira.replace(/^#+\s*/, "").replace(/^TEMA\s*/i, "").trim();
  return limpa.length > 55 ? limpa.slice(0, 55) + "..." : limpa;
}

function formatarData(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Pagina() {
  // ----- login / senha -----
  const [verificandoLogin, setVerificandoLogin] = useState(true);
  const [precisaSenha, setPrecisaSenha] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaDigitada, setSenhaDigitada] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [entrando, setEntrando] = useState(false);

  // ----- fluxo -----
  const [passo, setPasso] = useState<Passo>(1);
  const [passoMax, setPassoMax] = useState<Passo>(1);

  // passo 1
  const [fonte, setFonte] = useState("");
  const [extras, setExtras] = useState("");
  const [dossie, setDossie] = useState("");
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [carregando1, setCarregando1] = useState(false);
  const [status1, setStatus1] = useState("");

  // passo 2
  const [roteiro, setRoteiro] = useState("");
  const [meta, setMeta] = useState<MetaFinal | null>(null);
  const [carregando2, setCarregando2] = useState(false);
  const [status2, setStatus2] = useState("");

  // passo 3
  const [prompts, setPrompts] = useState("");
  const [carregando3, setCarregando3] = useState(false);
  const [status3, setStatus3] = useState("");

  const [erro, setErro] = useState("");

  // ----- historico de videos (fica salvo no navegador) -----
  const [historico, setHistorico] = useState<VideoSalvo[]>([]);
  const [idAtual, setIdAtual] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  function aplicarVideo(v: VideoSalvo) {
    setFonte(v.fonte || "");
    setExtras(v.extras || "");
    setDossie(v.dossie || "");
    setFontes(v.fontes || []);
    setRoteiro(v.roteiro || "");
    setMeta(v.meta || null);
    setPrompts(v.prompts || "");
    setPassoMax((v.passoMax || 1) as Passo);
  }

  // ---- ao abrir: carregar senha, historico e o video em que estava ----
  useEffect(() => {
    const s = localStorage.getItem(CHAVE_SENHA) || "";
    validarSenha(s).finally(() => setVerificandoLogin(false));

    let hist: VideoSalvo[] = [];
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]");
      if (Array.isArray(bruto)) hist = bruto;
    } catch {
      /* ignora */
    }
    setHistorico(hist);

    const atual = localStorage.getItem(CHAVE_ATUAL) || "";
    const item = hist.find((v) => v.id === atual);
    if (item) {
      aplicarVideo(item);
      setIdAtual(item.id);
    } else {
      setIdAtual(novoId());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- salvar o video atual no historico, a cada mudanca ----
  useEffect(() => {
    if (verificandoLogin || !idAtual) return;
    const temConteudo = `${fonte}${dossie}${roteiro}${prompts}`.trim().length > 0;
    if (!temConteudo) return;

    setHistorico((prev) => {
      const outros = prev.filter((v) => v.id !== idAtual);
      const atual: VideoSalvo = {
        id: idAtual,
        titulo: derivarTitulo({ roteiro, dossie, fonte }),
        data: Date.now(),
        fonte,
        extras,
        dossie,
        fontes,
        roteiro,
        meta,
        prompts,
        passoMax,
      };
      const nova = [atual, ...outros].slice(0, MAX_HISTORICO);
      try {
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(nova));
        localStorage.setItem(CHAVE_ATUAL, idAtual);
      } catch {
        /* ignora (armazenamento cheio) */
      }
      return nova;
    });
  }, [fonte, extras, dossie, fontes, roteiro, meta, prompts, passoMax, verificandoLogin, idAtual]);

  function novoVideo() {
    setIdAtual(novoId());
    setFonte("");
    setExtras("");
    setDossie("");
    setFontes([]);
    setRoteiro("");
    setMeta(null);
    setPrompts("");
    setPassoMax(1);
    setPasso(1);
    setErro("");
    setMostrarHistorico(false);
  }

  function carregarVideo(v: VideoSalvo) {
    aplicarVideo(v);
    setIdAtual(v.id);
    setPasso(1);
    setErro("");
    setMostrarHistorico(false);
  }

  function excluirVideo(id: string) {
    setHistorico((prev) => {
      const nova = prev.filter((v) => v.id !== id);
      try {
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(nova));
      } catch {
        /* ignora */
      }
      return nova;
    });
    if (id === idAtual) novoVideo();
  }

  async function validarSenha(s: string): Promise<boolean> {
    try {
      const res = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(s ? { "x-app-password": s } : {}) },
      });
      const j = await res.json().catch(() => null);
      if (!j) return false;
      setPrecisaSenha(!!j.precisaSenha);
      if (!j.precisaSenha) {
        setAutenticado(true);
        return true;
      }
      if (j.ok) {
        setAutenticado(true);
        setSenha(s);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function fazerLogin() {
    setErroLogin("");
    setEntrando(true);
    const ok = await validarSenha(senhaDigitada.trim());
    setEntrando(false);
    if (ok) {
      localStorage.setItem(CHAVE_SENHA, senhaDigitada.trim());
    } else {
      setErroLogin("Senha incorreta.");
    }
  }

  // ---------------- PASSO 1 ----------------
  const rodarPasso1 = useCallback(async () => {
    if (carregando1) return;
    if (fonte.trim().length < 20) {
      setErro("Cole a transcricao, o link ou a noticia (precisa de um pouco mais de texto).");
      return;
    }
    setErro("");
    setDossie("");
    setFontes([]);
    setCarregando1(true);
    setStatus1("Iniciando...");
    let texto = "";
    const ok = await streamFetch("/api/fonte", { fonte }, senha, {
      onStatus: setStatus1,
      onDelta: (t) => {
        texto += t;
        setDossie(texto);
      },
      onSources: setFontes,
      onError: (m) => setErro(m),
    });
    setCarregando1(false);
    setStatus1("");
    if (ok && texto.trim()) {
      setPassoMax((p) => (p < 2 ? 2 : p));
    }
  }, [carregando1, fonte, senha]);

  // ---------------- PASSO 2 ----------------
  const rodarPasso2 = useCallback(async () => {
    if (carregando2) return;
    if (dossie.trim().length < 20) {
      setErro("Faltou o dossie do Passo 1.");
      return;
    }
    setErro("");
    setRoteiro("");
    setMeta(null);
    setCarregando2(true);
    setStatus2("Iniciando...");
    let texto = "";
    const ok = await streamFetch("/api/roteiro", { dossie, extras }, senha, {
      onStatus: setStatus2,
      onDelta: (t) => {
        texto += t;
        setRoteiro(texto);
      },
      onDone: (m) => {
        if (m) setMeta(m);
      },
      onError: (m) => setErro(m),
    });
    setCarregando2(false);
    setStatus2("");
    if (ok && texto.trim()) {
      setPassoMax((p) => (p < 3 ? 3 : p));
    }
  }, [carregando2, dossie, extras, senha]);

  // ---------------- PASSO 3 (em lotes) ----------------
  const rodarPasso3 = useCallback(async () => {
    if (carregando3) return;
    if (roteiro.trim().length < 20) {
      setErro("Faltou o roteiro do Passo 2.");
      return;
    }
    setErro("");
    setPrompts("");
    setCarregando3(true);

    const segundos = meta?.duracaoSegundos || 600;
    const totalLotes = Math.max(1, Math.ceil(segundos / 120)); // ~2 min de roteiro por lote

    let acumulado = "";
    let falhou = false;

    for (let i = 0; i < totalLotes; i++) {
      const prefixo = i > 0 ? "\n\n" : "";
      let sucessoLote = false;

      // ate 3 tentativas por lote, para aguentar oscilacao de conexao
      for (let tentativa = 1; tentativa <= 3 && !sucessoLote; tentativa++) {
        let textoLote = "";
        let erroLote = "";
        setStatus3(
          `Montando as cenas (parte ${i + 1} de ${totalLotes})` +
            (tentativa > 1 ? ` — tentativa ${tentativa}` : "") +
            "...",
        );
        const ok = await streamFetch(
          "/api/prompts",
          { roteiro, indice: i, total: totalLotes },
          senha,
          {
            onDelta: (t) => {
              textoLote += t;
              setPrompts(acumulado + prefixo + textoLote);
            },
            onError: (m) => {
              erroLote = m;
            },
          },
        );
        if (ok) {
          acumulado += prefixo + textoLote;
          setPrompts(acumulado);
          sucessoLote = true;
        } else {
          // descarta o pedaco parcial e tenta de novo (ou desiste na ultima)
          setPrompts(acumulado);
          if (tentativa < 3) {
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            setErro(erroLote || "Nao consegui gerar esta parte das cenas. Tente de novo.");
            falhou = true;
          }
        }
      }
      if (falhou) break;
    }
    setCarregando3(false);
    setStatus3("");
  }, [carregando3, roteiro, meta, senha]);

  function irPara(p: Passo) {
    if (p <= passoMax) {
      setErro("");
      setPasso(p);
    }
  }

  // ---------------- TELAS ----------------
  if (verificandoLogin) {
    return (
      <main className="min-h-screen flex items-center justify-center text-suave">
        Carregando...
      </main>
    );
  }

  if (precisaSenha && !autenticado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-painel border border-borda rounded-xl p-6">
          <h1 className="text-xl font-semibold mb-1">Estudio Dark</h1>
          <p className="text-sm text-suave mb-5">Digite a senha de acesso.</p>
          <input
            type="password"
            value={senhaDigitada}
            onChange={(e) => setSenhaDigitada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fazerLogin()}
            placeholder="Senha"
            className="w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none mb-3"
          />
          {erroLogin && <p className="text-red-400 text-sm mb-3">{erroLogin}</p>}
          <button
            onClick={fazerLogin}
            disabled={entrando}
            className="w-full bg-destaque text-black font-semibold rounded-lg px-5 py-3 hover:brightness-110 disabled:opacity-40"
          >
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-3xl mx-auto px-4">
        {/* cabecalho */}
        <header className="pt-8 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">
            Estudio <span className="text-destaque">Dark</span>
          </h1>
          <p className="text-sm text-suave mt-1">
            Fonte, roteiro narrado e prompts de video para o seu canal.
          </p>
        </header>

        {/* barra do historico */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <button
            onClick={novoVideo}
            className="text-sm border border-borda rounded-lg px-3 py-2 text-suave hover:text-texto hover:border-destaque/60"
          >
            + Novo video
          </button>
          {historico.length > 0 && (
            <button
              onClick={() => setMostrarHistorico((v) => !v)}
              className="text-sm border border-borda rounded-lg px-3 py-2 text-suave hover:text-texto hover:border-destaque/60"
            >
              Meus videos ({historico.length}) {mostrarHistorico ? "▲" : "▼"}
            </button>
          )}
        </div>

        {mostrarHistorico && historico.length > 0 && (
          <div className="bg-painel border border-borda rounded-xl p-2 mb-4 divide-y divide-borda">
            {historico.map((v) => (
              <div key={v.id} className="flex items-center gap-2 px-2 py-2">
                <button onClick={() => carregarVideo(v)} className="flex-1 text-left min-w-0">
                  <div className="text-sm text-texto truncate">
                    {v.titulo}
                    {v.id === idAtual && <span className="text-destaque text-xs"> · atual</span>}
                  </div>
                  <div className="text-xs text-suave">
                    {formatarData(v.data)}
                    {v.meta?.duracaoTexto ? ` · ${v.meta.duracaoTexto}` : ""}
                  </div>
                </button>
                <button
                  onClick={() => excluirVideo(v.id)}
                  title="Excluir do historico"
                  className="text-suave hover:text-red-400 text-xs px-2 py-1 shrink-0"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}

        <Stepper passo={passo} passoMax={passoMax} onIr={irPara} />

        {erro && (
          <div className="mt-4 bg-red-950/40 border border-red-800/60 text-red-200 rounded-lg px-4 py-3 text-sm">
            {erro}
          </div>
        )}

        {/* ---------------- PASSO 1 ---------------- */}
        {passo === 1 && (
          <section className="mt-6 space-y-5">
            <div>
              <label className="text-sm text-suave">
                Fonte da informacao
                <span className="text-suave/70"> (transcricao do video, link ou noticia)</span>
              </label>
              <textarea
                value={fonte}
                onChange={(e) => setFonte(e.target.value)}
                placeholder="Cole aqui a transcricao do video, o link do YouTube ou o texto da noticia..."
                rows={9}
                className="mt-2 w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none resize-y"
              />
            </div>

            <div>
              <label className="text-sm text-suave">
                Citacoes ou argumentos que voce quer no conteudo
                <span className="text-suave/70"> (opcional)</span>
              </label>
              <textarea
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                placeholder="Ex.: quero citar uma frase especifica, defender um ponto de vista, incluir um dado que eu ja tenho..."
                rows={4}
                className="mt-2 w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none resize-y"
              />
              <p className="text-xs text-suave/70 mt-1">
                Isso fica guardado e entra na hora de escrever o roteiro, no Passo 2.
              </p>
            </div>

            <button
              onClick={rodarPasso1}
              disabled={carregando1}
              className="bg-destaque text-black font-semibold rounded-lg px-5 py-3 hover:brightness-110 disabled:opacity-40"
            >
              {carregando1 ? "Trabalhando..." : "Verificar fatos e pesquisar"}
            </button>

            {(carregando1 || dossie) && (
              <Resultado
                titulo="Dossie verificado"
                conteudo={dossie}
                gerando={carregando1}
                status={status1}
                nomeArquivo="dossie.txt"
              />
            )}

            {fontes.length > 0 && (
              <div className="bg-painel border border-borda rounded-xl p-4">
                <p className="text-sm text-suave mb-2">Fontes consultadas</p>
                <ul className="space-y-1">
                  {fontes.map((f, i) => (
                    <li key={i} className="text-sm">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-destaque2 hover:underline break-all"
                      >
                        {f.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {passoMax >= 2 && !carregando1 && (
              <div className="pt-2">
                <button
                  onClick={() => irPara(2)}
                  className="border border-destaque text-destaque rounded-lg px-5 py-3 hover:bg-destaque hover:text-black font-semibold"
                >
                  Continuar para o roteiro →
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---------------- PASSO 2 ---------------- */}
        {passo === 2 && (
          <section className="mt-6 space-y-5">
            <div>
              <label className="text-sm text-suave">
                Dossie <span className="text-suave/70">(pode ajustar antes de gerar)</span>
              </label>
              <textarea
                value={dossie}
                onChange={(e) => setDossie(e.target.value)}
                rows={7}
                className="mt-2 w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none resize-y"
              />
            </div>

            <div>
              <label className="text-sm text-suave">
                Citacoes ou argumentos que devem entrar no texto
                <span className="text-suave/70"> (opcional)</span>
              </label>
              <textarea
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                placeholder="Confirme ou ajuste o que voce quer que apareca no roteiro..."
                rows={3}
                className="mt-2 w-full bg-fundo border border-borda rounded-lg p-3 text-texto placeholder-suave focus:border-destaque outline-none resize-y"
              />
            </div>

            <button
              onClick={rodarPasso2}
              disabled={carregando2}
              className="bg-destaque text-black font-semibold rounded-lg px-5 py-3 hover:brightness-110 disabled:opacity-40"
            >
              {carregando2 ? "Escrevendo..." : roteiro ? "Gerar de novo" : "Gerar roteiro"}
            </button>

            {(carregando2 || roteiro) && (
              <Resultado
                titulo="Roteiro para narracao"
                conteudo={roteiro}
                gerando={carregando2}
                status={status2}
                nomeArquivo="roteiro.txt"
                rodape={
                  meta ? (
                    <span>
                      {meta.palavras} palavras · duracao estimada {meta.duracaoTexto}
                    </span>
                  ) : null
                }
              />
            )}

            {passoMax >= 3 && !carregando2 && (
              <div className="pt-2">
                <button
                  onClick={() => irPara(3)}
                  className="border border-destaque text-destaque rounded-lg px-5 py-3 hover:bg-destaque hover:text-black font-semibold"
                >
                  Continuar para os prompts →
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---------------- PASSO 3 ---------------- */}
        {passo === 3 && (
          <section className="mt-6 space-y-5">
            <div className="bg-painel border border-borda rounded-xl p-4 text-sm text-suave">
              Vou estimar a duracao pelo roteiro e criar prompts de video de ate oito
              segundos cada, na quantidade necessaria para preencher o video inteiro. Os
              prompts saem em ingles, prontos para colar em ferramentas como Veo, Kling ou
              Runway.
              {meta && (
                <span className="block mt-2 text-texto">
                  Duracao estimada: {meta.duracaoTexto} · {meta.palavras} palavras.
                </span>
              )}
            </div>

            <button
              onClick={rodarPasso3}
              disabled={carregando3}
              className="bg-destaque text-black font-semibold rounded-lg px-5 py-3 hover:brightness-110 disabled:opacity-40"
            >
              {carregando3 ? "Montando as cenas..." : prompts ? "Gerar de novo" : "Gerar prompts de video"}
            </button>

            {(carregando3 || prompts) && (
              <Resultado
                titulo="Prompts de video"
                conteudo={prompts}
                gerando={carregando3}
                status={status3}
                nomeArquivo="prompts-video.txt"
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
}

// ------------------ Componentes ------------------

function Stepper({
  passo,
  passoMax,
  onIr,
}: {
  passo: Passo;
  passoMax: Passo;
  onIr: (p: Passo) => void;
}) {
  const nomes: [Passo, string][] = [
    [1, "Fonte"],
    [2, "Roteiro"],
    [3, "Imagens"],
  ];
  return (
    <div className="flex items-center gap-2">
      {nomes.map(([n, nome], i) => {
        const ativo = passo === n;
        const liberado = n <= passoMax;
        return (
          <div key={n} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => onIr(n)}
              disabled={!liberado}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 w-full transition",
                ativo
                  ? "bg-destaque/15 border border-destaque"
                  : liberado
                    ? "border border-borda hover:border-destaque/60"
                    : "border border-borda opacity-40 cursor-not-allowed",
              ].join(" ")}
            >
              <span
                className={[
                  "w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  ativo ? "bg-destaque text-black" : "bg-borda text-suave",
                ].join(" ")}
              >
                {n}
              </span>
              <span className={ativo ? "text-texto font-medium" : "text-suave"}>{nome}</span>
            </button>
            {i < nomes.length - 1 && <div className="w-4 h-px bg-borda shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function Resultado({
  titulo,
  conteudo,
  gerando,
  status,
  nomeArquivo,
  rodape,
}: {
  titulo: string;
  conteudo: string;
  gerando: boolean;
  status: string;
  nomeArquivo: string;
  rodape?: React.ReactNode;
}) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gerando && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [conteudo, gerando]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* ignora */
    }
  }

  function baixar() {
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-painel border border-borda rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-borda">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{titulo}</span>
          {gerando && status && (
            <span className="text-xs text-destaque">· {status}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copiar}
            disabled={!conteudo}
            className="text-xs border border-borda rounded-md px-3 py-1.5 text-suave hover:text-texto hover:border-destaque/60 disabled:opacity-40"
          >
            {copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            onClick={baixar}
            disabled={!conteudo}
            className="text-xs border border-borda rounded-md px-3 py-1.5 text-suave hover:text-texto hover:border-destaque/60 disabled:opacity-40"
          >
            Baixar
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="leitura px-4 py-4 text-[15px] text-texto max-h-[55vh] overflow-y-auto"
      >
        <span className={gerando ? "cursor-gerando" : ""}>{conteudo}</span>
      </div>
      {rodape && (
        <div className="px-4 py-2 border-t border-borda text-xs text-suave">{rodape}</div>
      )}
    </div>
  );
}
