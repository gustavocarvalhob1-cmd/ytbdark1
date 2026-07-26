import { NextRequest } from "next/server";
import { senhaConfigurada, autorizado } from "@/lib/auth";

export const runtime = "nodejs";

// Usada pela tela de login: diz se precisa de senha e valida a senha enviada.
export async function POST(req: NextRequest) {
  const precisa = senhaConfigurada();
  if (!precisa) {
    return json({ ok: true, precisaSenha: false });
  }
  if (autorizado(req)) {
    return json({ ok: true, precisaSenha: true });
  }
  return json({ ok: false, precisaSenha: true }, 401);
}

function json(obj: object, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
