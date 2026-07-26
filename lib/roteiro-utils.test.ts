import { describe, it, expect } from "vitest";
import {
  contarPalavras,
  estimarSegundos,
  fatiarRoteiro,
  mensagemTema,
  mensagemPesquisa,
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
