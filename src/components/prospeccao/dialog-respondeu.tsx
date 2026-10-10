import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { registrarResposta } from '@/lib/prospeccao.functions';
import { adicionarDiasSP, obterHojeSP } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  Mail,
  Phone,
  CheckCircle2,
  CalendarClock,
  Clock,
  UserX,
  CalendarCheck,
  Ban,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];

type SituacaoResposta =
  | 'tem_demanda'
  | 'demanda_prevista'
  | 'sem_demanda'
  | 'atendido_outro_rep_prado'
  | 'falar_depois'
  | 'sem_interesse';

export interface OportunidadeItem {
  id: string;
  contato_id?: string | null;
  descricao?: string | null;
  marcas?: Array<{ id: string; nome: string; [key: string]: any }> | null;
}

interface DialogRespondeuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contatoId?: string;
  contatoNome?: string;
  clienteNome?: string;
  oportunidades?: OportunidadeItem[];
  onSuccess: () => void;
}

export function DialogRespondeu({
  open,
  onOpenChange,
  contatoId,
  contatoNome,
  clienteNome,
  oportunidades = [],
  onSuccess,
}: DialogRespondeuProps) {
  const [canal, setCanal] = useState<TipoRegistro>('whatsapp');
  const [situacao, setSituacao] = useState<SituacaoResposta>('tem_demanda');
  const [mesAnoNecessidade, setMesAnoNecessidade] = useState(''); // YYYY-MM
  const [nomeRepresentante, setNomeRepresentante] = useState('');
  const [dataFalarDepois, setDataFalarDepois] = useState(adicionarDiasSP(15));
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Mostre só as oportunidades do contato escolhido ou sem contato (contato_id nulo).
  // Nunca envie oportunidade de outro contato.
  const oportunidadesValidas = (oportunidades || []).filter(
    (op) => !op.contato_id || (contatoId && op.contato_id === contatoId)
  );

  const [oportunidadeSelecionadaId, setOportunidadeSelecionadaId] = useState<string>('');

  const executarResposta = useServerFn(registrarResposta);

  useEffect(() => {
    if (open) {
      if (oportunidadesValidas.length > 0) {
        setOportunidadeSelecionadaId(oportunidadesValidas[0]?.id || '');
      } else {
        setOportunidadeSelecionadaId('');
      }
    }
  }, [open, contatoId]);

  const opcoesSituacao: {
    key: SituacaoResposta;
    titulo: string;
    subtitulo: string;
    icon: any;
    cor: string;
  }[] = [
    {
      key: 'tem_demanda',
      titulo: 'Tem demanda agora',
      subtitulo: 'Avança para orçamento e agenda follow-up em 2 dias',
      icon: CheckCircle2,
      cor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'demanda_prevista',
      titulo: 'Demanda prevista em mês/ano',
      subtitulo: 'Agenda acompanhamento antecipado para a obra',
      icon: CalendarClock,
      cor: 'text-purple-600 dark:text-purple-400',
    },
    {
      key: 'sem_demanda',
      titulo: 'Sem demanda no momento',
      subtitulo: 'Fica aguardando demanda e pausa por 60 dias',
      icon: Clock,
      cor: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'atendido_outro_rep_prado',
      titulo: 'Atendido por outro representante PRADO',
      subtitulo: 'Atualiza o selo da construtora com o nome do representante',
      icon: UserX,
      cor: 'text-destructive',
    },
    {
      key: 'falar_depois',
      titulo: 'Pediu para falar depois',
      subtitulo: 'Escolha a data combinada com o cliente',
      icon: CalendarCheck,
      cor: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'sem_interesse',
      titulo: 'Sem interesse',
      subtitulo: 'Marca oportunidade como perdida e encerra follow-ups',
      icon: Ban,
      cor: 'text-rose-600 dark:text-rose-400',
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contatoId) {
      toast.error('Nenhum contato selecionado.');
      return;
    }

    if (situacao === 'demanda_prevista') {
      if (!mesAnoNecessidade) {
        toast.error('Por favor informe o mês e ano da demanda prevista.');
        return;
      }
    }

    if (situacao === 'atendido_outro_rep_prado') {
      if (!nomeRepresentante.trim()) {
        toast.error('Informe o nome do representante PRADO que atende a construtora.');
        return;
      }
    }

    if (situacao === 'falar_depois') {
      if (!dataFalarDepois) {
        toast.error('Informe a data agendada para o retorno.');
        return;
      }
    }

    // Se houver só uma, use essa sem perguntar.
    // Se houver mais de uma, use a selecionada.
    // Se não houver nenhuma, envie sem oportunidade.
    const oportunidadeFinalId =
      oportunidadesValidas.length === 1
        ? oportunidadesValidas[0]?.id
        : oportunidadesValidas.length > 1
          ? (oportunidadeSelecionadaId || oportunidadesValidas[0]?.id || undefined)
          : undefined;

    setCarregando(true);
    try {
      // Converte YYYY-MM para YYYY-MM-01
      const necessidadeFormatada =
        situacao === 'demanda_prevista' && mesAnoNecessidade ? `${mesAnoNecessidade}-01` : undefined;

      await executarResposta({
        data: {
          contatoId,
          canal,
          situacao,
          oportunidadeId: oportunidadeFinalId || undefined,
          necessidade: necessidadeFormatada,
          dataProxima:
            situacao === 'falar_depois'
              ? dataFalarDepois
              : undefined,
          representante:
            situacao === 'atendido_outro_rep_prado' ? nomeRepresentante.trim() : undefined,
          texto: texto.trim() || undefined,
        },
      });

      toast.success('Resposta registrada com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar resposta.');
    } finally {
      setCarregando(false);
    }
  }

  const canais: { tipo: TipoRegistro; label: string; icon: any }[] = [
    { tipo: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { tipo: 'email', label: 'E-mail', icon: Mail },
    { tipo: 'ligacao', label: 'Ligação', icon: Phone },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Registrar Resposta do Cliente</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome && <span className="font-semibold text-foreground">{clienteNome}</span>}
            {contatoNome && ` • Contato: ${contatoNome}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Seletor de Oportunidade (mostrado se houver mais de uma válida) */}
          {oportunidadesValidas.length > 1 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Oportunidade vinculada
              </label>
              <select
                value={oportunidadeSelecionadaId}
                onChange={(e) => setOportunidadeSelecionadaId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {oportunidadesValidas.map((op) => {
                  const marcasNomes = (op.marcas || []).map((m) => m.nome).filter(Boolean).join(', ');
                  const rotulo =
                    marcasNomes && op.descricao
                      ? `${marcasNomes} — ${op.descricao}`
                      : marcasNomes || op.descricao || 'Oportunidade comercial';
                  return (
                    <option key={op.id} value={op.id}>
                      {rotulo}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Escolha do Canal de Retorno */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Canal da resposta
            </label>
            <div className="grid grid-cols-3 gap-2">
              {canais.map((c) => {
                const Icon = c.icon;
                const selecionado = canal === c.tipo;
                return (
                  <button
                    key={c.tipo}
                    type="button"
                    onClick={() => setCanal(c.tipo)}
                    className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-lg border text-sm font-medium transition-all ${
                      selecionado
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opções de Situação Comercial */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Qual foi o retorno do cliente? *
            </label>
            <div className="space-y-2">
              {opcoesSituacao.map((item) => {
                const Icon = item.icon;
                const selecionado = situacao === item.key;
                return (
                  <label
                    key={item.key}
                    onClick={() => setSituacao(item.key)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selecionado
                        ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="situacao"
                      checked={selecionado}
                      onChange={() => setSituacao(item.key)}
                      className="sr-only"
                    />
                    <div className={`mt-0.5 ${item.cor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{item.titulo}</div>
                      <div className="text-xs text-muted-foreground">{item.subtitulo}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Campos específicos dependendo da situação */}
          {situacao === 'demanda_prevista' && (
            <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold text-foreground block">
                Previsão de demanda da obra (mês e ano) *
              </label>
              <Input
                type="month"
                min={obterHojeSP().slice(0, 7)}
                value={mesAnoNecessidade}
                onChange={(e) => setMesAnoNecessidade(e.target.value)}
                className="h-11 bg-card"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                O sistema agendará automaticamente o follow-up com a antecedência padrão configurada.
              </p>
            </div>
          )}

          {situacao === 'atendido_outro_rep_prado' && (
            <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold text-foreground block">
                Nome do outro representante PRADO *
              </label>
              <Input
                placeholder="Ex: Carlos Silva"
                value={nomeRepresentante}
                onChange={(e) => setNomeRepresentante(e.target.value)}
                className="h-11 bg-card"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Esta construtora passará a exibir o selo vermelho de atendimento por outro representante.
              </p>
            </div>
          )}

          {situacao === 'falar_depois' && (
            <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold text-foreground block">
                Data combinada para o retorno *
              </label>
              <Input
                type="date"
                min={obterHojeSP()}
                value={dataFalarDepois}
                onChange={(e) => setDataFalarDepois(e.target.value)}
                className="h-11 bg-card"
                required
              />
            </div>
          )}

          {/* Anotação adicional */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Observações adicionais (opcional)
            </label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Detalhes sobre a conversa, perfil da construtora ou motivos informados..."
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 w-full sm:w-auto"
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-12 w-full sm:w-auto font-medium gap-2"
              disabled={carregando}
            >
              {carregando ? (
                'Salvando...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Resposta
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
