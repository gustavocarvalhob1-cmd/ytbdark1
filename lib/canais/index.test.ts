import { describe, it, expect } from "vitest";
import { CANAIS, CANAL_PADRAO, getCanal } from "./index";

describe("registro de canais", () => {
  it("tem exatamente 4 canais com ids unicos", () => {
    const ids = CANAIS.map((c) => c.id);
    expect(ids).toEqual(["historia-brasil", "conspiracoes", "inspiracional", "financas"]);
    expect(new Set(ids).size).toBe(4);
  });
  it("getCanal encontra por id", () => {
    expect(getCanal("conspiracoes")?.id).toBe("conspiracoes");
  });
  it("getCanal devolve undefined para id invalido ou vazio", () => {
    expect(getCanal("nao-existe")).toBeUndefined();
    expect(getCanal(undefined)).toBeUndefined();
    expect(getCanal("")).toBeUndefined();
  });
  it("o canal padrao e o primeiro (historia-brasil)", () => {
    expect(CANAL_PADRAO.id).toBe("historia-brasil");
  });
  it("todo canal tem os 3 prompts preenchidos", () => {
    for (const c of CANAIS) {
      expect(c.prompts.passo1.length).toBeGreaterThan(50);
      expect(c.prompts.roteiro.length).toBeGreaterThan(50);
      expect(c.prompts.imagens.length).toBeGreaterThan(50);
    }
  });
  it("nenhum roteiro tem tamanho fixo embutido (a duracao e dinamica)", () => {
    for (const c of CANAIS) {
      expect(c.prompts.roteiro).not.toContain("1040");
      expect(c.prompts.roteiro).not.toContain("1560");
    }
  });
});
