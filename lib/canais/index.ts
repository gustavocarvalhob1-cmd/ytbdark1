import { Canal } from "./tipos";
import { historiaBrasil } from "./historia-brasil";
import { conspiracoes } from "./conspiracoes";
import { inspiracional } from "./inspiracional";
import { financas } from "./financas";

export * from "./tipos";

export const CANAIS: Canal[] = [historiaBrasil, conspiracoes, inspiracional, financas];

const PORID: Record<string, Canal> = Object.fromEntries(CANAIS.map((c) => [c.id, c]));

export const CANAL_PADRAO: Canal = CANAIS[0];

export function getCanal(id: string | null | undefined): Canal | undefined {
  if (!id) return undefined;
  return PORID[id];
}
