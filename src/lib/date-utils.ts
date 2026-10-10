/**
 * Utilitários para formatação e manipulação de datas no fuso horário America/Sao_Paulo (SP).
 * Conforme regras do projeto:
 * - Datas exibidas no formato dd/mm/aaaa
 * - Horários exibidos no fuso America/Sao_Paulo
 * - Formatação ISO YYYY-MM-DD para colunas DATE do Postgres sem deslocamento de fuso.
 */

export const FUSO_SP = 'America/Sao_Paulo';

/**
 * Converte data string (YYYY-MM-DD ou ISO timestamptz) para dd/mm/aaaa
 */
export function formatarData(dataStr?: string | null): string {
  if (!dataStr) return '—';
  
  // Se for formato apenas YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_SP,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dataStr;
  }
}

/**
 * Formata data e hora para dd/mm/aaaa às HH:mm
 */
export function formatarDataHora(dataStr?: string | null): string {
  if (!dataStr) return '—';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return '—';
    const dataFmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_SP,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
    const horaFmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_SP,
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
    return `${dataFmt} às ${horaFmt}`;
  } catch {
    return dataStr;
  }
}

/**
 * Retorna a data atual no fuso de São Paulo no formato YYYY-MM-DD
 */
export function obterHojeSP(): string {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatador.format(agora); // 'en-CA' produz YYYY-MM-DD
}

/**
 * Adiciona N dias à data base (ou hoje em SP) e retorna YYYY-MM-DD
 */
export function adicionarDiasSP(dias: number, dataBase?: string): string {
  const baseStr = dataBase || obterHojeSP();
  const [ano, mes, dia] = baseStr.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  
  const a = data.getUTCFullYear();
  const m = String(data.getUTCMonth() + 1).padStart(2, '0');
  const d = String(data.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/**
 * Verifica se uma data YYYY-MM-DD está atrasada em relação a hoje em SP
 */
export function statusData(dataStr?: string | null): 'atrasado' | 'hoje' | 'futuro' | 'nenhum' {
  if (!dataStr) return 'nenhum';
  const hoje = obterHojeSP();
  const dataLimpa = dataStr.slice(0, 10);
  if (dataLimpa < hoje) return 'atrasado';
  if (dataLimpa === hoje) return 'hoje';
  return 'futuro';
}

/**
 * Formata para Mês/Ano (ex: 11/2026)
 */
export function formatarMesAno(dataStr?: string | null): string {
  if (!dataStr) return '—';
  if (/^\d{4}-\d{2}/.test(dataStr)) {
    const [ano, mes] = dataStr.split('-');
    return `${mes}/${ano}`;
  }
  return formatarData(dataStr);
}
