// Protecao simples por senha, para a chave de API nao ficar exposta a qualquer
// um que descubra o link. A senha fica so na variavel de ambiente APP_PASSWORD.

export function senhaConfigurada(): boolean {
  return !!process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0;
}

// Retorna true se a requisicao pode passar.
// Sem APP_PASSWORD definida, a plataforma abre sem senha (util em teste local).
export function autorizado(req: Request): boolean {
  const esperada = process.env.APP_PASSWORD;
  if (!esperada) return true;
  const enviada = req.headers.get("x-app-password");
  return enviada === esperada;
}

export function respostaNaoAutorizado(): Response {
  return new Response(JSON.stringify({ error: "Senha incorreta." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
