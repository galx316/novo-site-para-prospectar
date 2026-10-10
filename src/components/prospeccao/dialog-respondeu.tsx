import { useState } from 'react';
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

interface DialogRespondeuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contatoId: string;
  contatoNome?: string;
  clienteNome?: string;
  oportunidadeId?: string;
  onSuccess: () => void;
}

export function DialogRespondeu({
  open,
  onOpenChange,
  contatoId,
  contatoNome,
  clienteNome,
  oportunidadeId,
  onSuccess,
}: DialogRespondeuProps) {
  const [canal, setCanal] = useState<TipoRegistro>('whatsapp');
  const [situacao, setSituacao] = useState<SituacaoResposta>('tem_demanda');
  const [mesAnoNecessidade, setMesAnoNecessidade] = useState(''); // YYYY-MM
  const [nomeRepresentante, setNomeRepresentante] = useState('');
  const [dataFalarDepois, setDataFalarDepois] = useState(adicionarDiasSP(15));
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);

  const executarResposta = useServerFn(registrarResposta);

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
          oportunidadeId: oportunidadeId || undefined,
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
          <DialogTitle className="text-xl font-semibold">Registrar Resposta do Prospect</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome && <span className="font-semibold text-foreground">{clienteNome}</span>}
            {contatoNome && ` • Contato: ${contatoNome}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Canal da resposta */}
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
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
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

          {/* Opções de Situação */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Qual foi a resposta?
            </label>
            <div className="space-y-2">
              {opcoesSituacao.map((item) => {
                const Icon = item.icon;
                const selecionado = situacao === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSituacao(item.key)}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all ${
                      selecionado
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                        : 'border-border bg-card hover:bg-accent/60'
                    }`}
                  >
                    <div className={`mt-0.5 p-1 rounded-md ${selecionado ? 'bg-primary/10' : ''}`}>
                      <Icon className={`h-5 w-5 ${item.cor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-foreground">{item.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.subtitulo}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campos condicionais baseados na situação */}
          {situacao === 'demanda_prevista' && (
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold uppercase tracking-wider text-purple-900 dark:text-purple-200 block">
                Mês e Ano da Demanda Prevista *
              </label>
              <Input
                type="month"
                value={mesAnoNecessidade}
                onChange={(e) => setMesAnoNecessidade(e.target.value)}
                min={obterHojeSP().slice(0, 7)}
                className="h-11 bg-card"
                required
              />
              <p className="text-xs text-muted-foreground">
                O sistema programará o contato automaticamente antes do início previsto.
              </p>
            </div>
          )}

          {situacao === 'atendido_outro_rep_prado' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold uppercase tracking-wider text-destructive block">
                Nome do Representante PRADO que atende *
              </label>
              <Input
                type="text"
                placeholder="Ex: Carlos Silva / Representação XYZ"
                value={nomeRepresentante}
                onChange={(e) => setNomeRepresentante(e.target.value)}
                className="h-11 bg-card"
                required
              />
              <p className="text-xs text-muted-foreground">
                A construtora receberá o selo vermelho de atendimento por outro representante. Sugerimos ofertar Scalla ou Kit Porta.
              </p>
            </div>
          )}

          {situacao === 'falar_depois' && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-200 block">
                Data combinada para falar novamente *
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

          {/* Anotação complementar */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Resumo / Anotação da resposta
            </label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Conversou com o diretor de compras, informou que estão cotando empreendimento..."
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
