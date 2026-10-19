/**
 * Utilitários de data e hora para a Extensão no fuso America/Sao_Paulo
 */

export const FUSO_SP = 'America/Sao_Paulo';

export function obterHojeSP(): string {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatador.format(agora);
}

export function formatarData(dataStr?: string | null): string {
  if (!dataStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
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

export function formatarDataHora(dataStr?: string | null): string {
  if (!dataStr) return '—';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
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

export function adicionarDiasSP(dias: number, dataBase?: string): string {
  const baseStr = dataBase || obterHojeSP();
  const partes = baseStr.split('-').map(Number);
  const ano = partes[0] ?? 2026;
  const mes = partes[1] ?? 1;
  const dia = partes[2] ?? 1;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);

  const a = data.getUTCFullYear();
  const m = String(data.getUTCMonth() + 1).padStart(2, '0');
  const d = String(data.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function statusData(dataStr?: string | null): 'atrasado' | 'hoje' | 'futuro' | 'nenhum' {
  if (!dataStr) return 'nenhum';
  const hoje = obterHojeSP();
  const dataLimpa = dataStr.slice(0, 10);
  if (dataLimpa < hoje) return 'atrasado';
  if (dataLimpa === hoje) return 'hoje';
  return 'futuro';
}
