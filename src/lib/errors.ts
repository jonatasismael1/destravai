// Tradução de erros técnicos para mensagens amigáveis ao usuário.
//
// Por quê: muitos erros (Supabase, Asaas, rede) chegam em inglês e com jargão
// técnico. Mostrar isso direto na tela assusta e confunde o usuário. Aqui a gente
// reconhece os casos comuns e devolve uma frase simples em português; quando não
// reconhece, devolve o `fallback` contextual (nunca o texto técnico cru).

// Pares [padrão, mensagem]. O primeiro que casar vence — ordem importa (mais
// específico antes do mais genérico).
const MAPA_ERROS: Array<[RegExp, string]> = [
  // ── Autenticação (Supabase Auth) ──────────────────────────────────────────
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada (e o spam).'],
  [/(user|email).*already (registered|been registered)/i, 'Este e-mail já tem conta. Faça login.'],
  [/password should be at least/i, 'A senha deve ter ao menos 8 caracteres.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da atual.'],
  [/(unable to validate email|invalid format|invalid email)/i, 'E-mail inválido. Confira e tente de novo.'],
  [/(email link is invalid|token has expired|otp.*expired|invalid.*expired)/i, 'O link expirou. Peça um novo e tente de novo.'],
  [/user not found/i, 'Não encontramos uma conta com esses dados.'],
  [/signups? (not allowed|is disabled)/i, 'Cadastro indisponível no momento. Tente mais tarde.'],

  // ── Limite de tentativas ──────────────────────────────────────────────────
  [/(rate limit|too many requests|for security purposes, you can only)/i, 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.'],

  // ── Pagamento (Asaas) ─────────────────────────────────────────────────────
  [/(cpf|cnpj)/i, 'CPF ou CNPJ inválido. Confira os números e tente de novo.'],
  [/(credit card|cartão|card declined|recusad)/i, 'Não foi possível processar o cartão. Confira os dados ou tente outro cartão.'],

  // ── Rede / servidor ───────────────────────────────────────────────────────
  [/(failed to fetch|networkerror|network error|load failed|err_internet|net::)/i, 'Sem conexão. Verifique sua internet e tente de novo.'],
  [/(timeout|timed out|deadline)/i, 'A conexão demorou demais. Tente de novo.'],
  [/(5\d{2}|internal server error|bad gateway|service unavailable)/i, 'O serviço está instável agora. Tente de novo em instantes.'],
]

// Extrai uma string de mensagem de qualquer formato de erro (Error, string,
// objeto do Supabase/fetch com .message ou .error_description).
function extrairMensagem(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    return String(o.message || o.error_description || o.error || o.msg || '')
  }
  return String(err)
}

// Heurística: a mensagem já parece português amigável (nossa)? Se sim, mantemos.
// Acentos ou palavras comuns de PT indicam que o texto foi escrito por nós.
function jaEhPortugues(msg: string): boolean {
  return /[ãâáàéêíóôõúç]/i.test(msg)
    || /\b(não|senha|e-?mail|tente|conta|pagamento|inválid|erro ao|confira|aguarde)\b/i.test(msg)
}

/**
 * Converte um erro em uma mensagem amigável em português.
 * @param err erro capturado (qualquer tipo)
 * @param fallback frase contextual a usar quando o erro não for reconhecido
 */
export function mensagemDeErro(err: unknown, fallback: string): string {
  const bruta = extrairMensagem(err).trim()
  if (!bruta) return fallback

  for (const [padrao, mensagem] of MAPA_ERROS) {
    if (padrao.test(bruta)) return mensagem
  }

  // Não reconhecido: se já é português escrito por nós, preserva; senão, usa o
  // fallback para não vazar texto técnico/inglês.
  return jaEhPortugues(bruta) ? bruta : fallback
}

// Mensagens para erros do reconhecimento de voz (Web Speech API). Os códigos
// vêm em inglês (ex.: 'not-allowed', 'no-speech') e não devem aparecer crus.
const MAPA_ERROS_VOZ: Record<string, string> = {
  'not-allowed': 'Permita o acesso ao microfone nas configurações do navegador para usar o ditado.',
  'service-not-allowed': 'Permita o acesso ao microfone nas configurações do navegador para usar o ditado.',
  'no-speech': 'Não consegui ouvir nada. Toque para tentar de novo e fale mais perto do microfone.',
  'audio-capture': 'Não encontrei um microfone. Verifique se há um conectado e tente de novo.',
  'network': 'Sem conexão para o reconhecimento de voz. Verifique sua internet.',
  'language-not-supported': 'Seu navegador não suporta ditado em português. Digite o texto.',
}

export function mensagemDeErroVoz(codigo: string): string {
  return MAPA_ERROS_VOZ[codigo] || 'Não foi possível usar o microfone agora. Tente de novo.'
}
