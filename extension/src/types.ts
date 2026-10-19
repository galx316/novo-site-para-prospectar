export type DirecaoMensagem = 'enviada' | 'recebida';

export interface UltimaMensagemInfo {
  direcao: DirecaoMensagem;
  horario: string;
  timestamp?: number | null;
  rawDateStr?: string;
}

export interface ConversaInfo {
  aberta: boolean;
  erro?: 'nao_identificado' | null;
  titulo?: string | null;
  numero?: string | null;
  ultimaMensagem?: UltimaMensagemInfo | null;
}

export type SituacaoPrado = 'nao_verificado' | 'livre' | 'ja_cliente' | 'atendida_outro_rep';
export type SituacaoResposta =
  | 'tem_demanda'
  | 'demanda_prevista'
  | 'sem_demanda'
  | 'atendido_outro_rep_prado'
  | 'falar_depois'
  | 'sem_interesse';

export type TipoRegistro =
  | 'nota'
  | 'ata'
  | 'cronograma'
  | 'medicao'
  | 'ligacao'
  | 'whatsapp'
  | 'email'
  | 'visita'
  | 'problema'
  | 'outro';

export interface Contato {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  whatsapp: string | null;
  telefone: string | null;
  email: string | null;
}

export interface Cliente {
  id: string;
  nome: string;
  situacao_prado: SituacaoPrado;
  representante_prado: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface Oportunidade {
  id: string;
  cliente_id: string;
  contato_id: string | null;
  marca_ids: string[];
  descricao: string | null;
  etapa: string;
  marcas?: Array<{ id: string; nome: string }>;
}

export interface Followup {
  id: string;
  cliente_id: string;
  contato_id: string | null;
  data: string;
  motivo: string | null;
  origem: string;
  status: string;
}

export interface Registro {
  id: string;
  data: string;
  created_at: string;
  tipo: TipoRegistro;
  direcao: 'enviado' | 'recebido' | 'nenhuma';
  texto: string;
}

export interface DadosContatoPainel {
  contato: Contato;
  cliente: Cliente;
  oportunidades: Oportunidade[];
  followup_pendente: Followup | null;
  ultimos_registros: Registro[];
  aviso_resposta_pendente: boolean;
}

export interface Marca {
  id: string;
  nome: string;
  linha?: string;
  cor?: string | null;
}
