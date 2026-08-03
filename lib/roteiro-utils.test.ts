import { describe, it, expect } from "vitest";
import {
  contarPalavras,
  estimarSegundos,
  fatiarRoteiro,
  mensagemTema,
  mensagemPesquisa,
  instrucaoDuracao,
  instrucaoFormatoRoteiro,
  instrucaoFormatoImagens,
  mensagemAngulos,
  mensagemDirecao,
  montarFonteInsight,
  parsearAngulos,
  instrucaoFormatoCapa,
  mensagemCapa,
} from "./roteiro-utils";

describe("contarPalavras", () => {
  it("conta palavras separadas por espaco", () => {
    expect(contarPalavras("um dois tres")).toBe(3);
  });
  it("texto vazio conta zero", () => {
    expect(contarPalavras("   ")).toBe(0);
  });
});

describe("estimarSegundos", () => {
  it("usa 130 palavras por minuto", () => {
    expect(estimarSegundos(130)).toBe(60);
  });
});

describe("fatiarRoteiro", () => {
  it("divide o roteiro em partes contiguas e cobre tudo", () => {
    const roteiro = Array.from({ length: 40 }, (_, i) => `p${i}`).join(" ");
    const p0 = fatiarRoteiro(roteiro, 2, 0);
    const p1 = fatiarRoteiro(roteiro, 2, 1);
    expect(`${p0.trecho} ${p1.trecho}`.split(/\s+/)).toHaveLength(40);
    expect(p0.numeroInicial).toBe(1);
  });
});

describe("mensagemPesquisa / mensagemTema", () => {
  it("a mensagem de pesquisa inclui o material", () => {
    expect(mensagemPesquisa("caso X")).toContain("caso X");
  });
  it("a mensagem de tema inclui o tema e nao fala em conferir fatos", () => {
    const m = mensagemTema("resiliencia");
    expect(m).toContain("resiliencia");
    expect(m.toLowerCase()).not.toContain("confira os fatos");
  });
});

describe("instrucaoDuracao", () => {
  it("inclui os minutos e a quantidade de palavras alvo", () => {
    const s = instrucaoDuracao(5);
    expect(s).toContain("5 minuto");
    expect(s).toContain("650"); // 5 * 130
  });
  it("limita a duracao entre 1 e 20", () => {
    expect(instrucaoDuracao(100)).toContain("20 minuto");
    expect(instrucaoDuracao(0)).toContain("1 minuto");
  });
});

describe("instrucaoFormatoRoteiro", () => {
  it("youtube nao adiciona instrucao", () => {
    expect(instrucaoFormatoRoteiro("youtube")).toBe("");
  });
  it("tiktok pede gancho rapido e direto", () => {
    expect(instrucaoFormatoRoteiro("tiktok").toLowerCase()).toContain("gancho");
  });
});

describe("instrucaoFormatoImagens", () => {
  it("youtube menciona 16:9", () => {
    expect(instrucaoFormatoImagens("youtube")).toContain("16:9");
  });
  it("tiktok menciona 9:16", () => {
    expect(instrucaoFormatoImagens("tiktok")).toContain("9:16");
  });
});

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

describe("capa", () => {
  it("instrucaoFormatoCapa menciona 16:9 no youtube e 9:16 no tiktok", () => {
    expect(instrucaoFormatoCapa("youtube")).toContain("16:9");
    expect(instrucaoFormatoCapa("tiktok")).toContain("9:16");
  });
  it("mensagemCapa inclui tema, cores da paleta e a orientacao do formato", () => {
    const m = mensagemCapa({
      canalNome: "Finanças",
      canalDescricao: "educação financeira",
      paleta: ["#4caf7d", "#d4af37"],
      tema: "reserva de emergencia",
      roteiro: "texto do roteiro que explica o assunto todo",
      formato: "youtube",
      temReferencias: false,
    });
    expect(m).toContain("reserva de emergencia");
    expect(m).toContain("#4caf7d");
    expect(m).toContain("16:9");
  });
  it("mensagemCapa so fala de referencias quando temReferencias e true", () => {
    const base = {
      canalNome: "X",
      canalDescricao: "y",
      paleta: ["#000000"],
      tema: "t",
      roteiro: "roteiro suficientemente grande pra passar",
      formato: "youtube" as const,
    };
    expect(mensagemCapa({ ...base, temReferencias: true }).toLowerCase()).toContain("referenc");
    expect(
      mensagemCapa({ ...base, temReferencias: false }).toLowerCase(),
    ).not.toContain("imagens de referenc");
  });
});
