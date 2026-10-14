import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  criarFollowupObra,
  TIPOS_LOTE_LABELS,
  type TipoLote,
} from '@/lib/obras.functions';
import { adicionarDiasSP, obterHojeSP, formatarData } from '@/lib/date-utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Loader2, Check, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export type ModeloFollowup =
  | 'livre'
  | 'lembrar_medicao'
  | 'treinamento_instalacao'
  | 'confirmar_entrega';

type QuandoTreinamento = 'apto_modelo' | 'primeira_entrega' | 'especifica';

interface DialogNovoFollowupObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes?: any[];
  modeloInicial?: ModeloFollowup;
  onSuccess: () => void;
}

export function DialogNovoFollowupObra({
  open,
  onOpenChange,
  obraId,
  lotes = [],
  modeloInicial = 'livre',
  onSuccess,
}: DialogNovoFollowupObraProps) {
  const [modelo, setModelo] = useState<ModeloFollowup>(modeloInicial);
  const [data, setData] = useState(adicionarDiasSP(7));
  const [motivo, setMotivo] = useState('');
  const [loteId, setLoteId] = useState('');
  const [quandoTreinamento, setQuandoTreinamento] = useState<QuandoTreinamento>('apto_modelo');
  const [dataEspecificaTreinamento, setDataEspecificaTreinamento] = useState('');
  const [avisoData, setAvisoData] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const executarCriar = useServerFn(criarFollowupObra);

  function aplicarModeloMedicao(targetLoteId: string) {
    setLoteId(targetLoteId);
    setAvisoData(null);
    const lote = lotes.find((l) => l.id === targetLoteId);
    if (!lote) return;

    const tipoLegivel = TIPOS_LOTE_LABELS[lote.tipo as TipoLote] || lote.tipo;
    const tipoDesc = `${tipoLegivel}${lote.descricao ? ` ${lote.descricao}` : ''}`;
    const hoje = obterHojeSP();

    if (lote.previsao_medicao) {
      const prev = lote.previsao_medicao.slice(0, 10);
      let d = adicionarDiasSP(-3, prev);
      if (d < hoje) d = hoje;
      setData(d);
      const ddmm = formatarData(prev).slice(0, 5);
      setMotivo(`Confirmar com a obra a medição de ${tipoDesc} prevista para ${ddmm}`);
    } else {
      setData(hoje);
      setAvisoData('Lote selecionado não possui data prevista de medição cadastrada.');
      setMotivo(`Confirmar com a obra a medição de ${tipoDesc}`);
    }
  }

  function aplicarModeloTreinamento(quando: QuandoTreinamento, dataEsp = dataEspecificaTreinamento) {
    setQuandoTreinamento(quando);
    setAvisoData(null);
    const hoje = obterHojeSP();
    let dataAlvo: string | null = null;
    let opcaoTexto = '';

    if (quando === 'apto_modelo') {
      opcaoTexto = 'apto modelo';
      const loteApto = lotes.find((l) => l.tipo === 'apto_modelo');
      if (loteApto) {
        setLoteId(loteApto.id);
        if (Array.isArray(loteApto.entregas) && loteApto.entregas.length > 0) {
          const prox = loteApto.entregas.find((e: any) => !e.entregue_em);
          if (prox) {
            dataAlvo = prox.data_confirmada || prox.previsao || null;
          }
        } else if (!loteApto.entregue_em) {
          dataAlvo = loteApto.data_confirmada || loteApto.previsao_entrega || null;
        }
      } else {
        setLoteId('');
      }
    } else if (quando === 'primeira_entrega') {
      opcaoTexto = 'primeira entrega';
      setLoteId('');
      const datasPendentes: string[] = [];
      for (const l of lotes) {
        if (Array.isArray(l.entregas) && l.entregas.length > 0) {
          for (const e of l.entregas) {
            if (!e.entregue_em && (e.data_confirmada || e.previsao)) {
              datasPendentes.push((e.data_confirmada || e.previsao).slice(0, 10));
            }
          }
        } else if (!l.entregue_em && (l.data_confirmada || l.previsao_entrega)) {
          datasPendentes.push((l.data_confirmada || l.previsao_entrega).slice(0, 10));
        }
      }
      if (datasPendentes.length > 0) {
        datasPendentes.sort();
        dataAlvo = datasPendentes[0] || null;
      }
    } else if (quando === 'especifica') {
      opcaoTexto = 'data específica';
      setLoteId('');
      dataAlvo = dataEsp || null;
    }

    if (!dataAlvo) {
      setData('');
      setAvisoData('Sem data de entrega prevista. Informe a data.');
      setMotivo(`Marcar treinamento de instalação com a obra (${opcaoTexto})`);
    } else {
      const dataAlvoLimpa = dataAlvo.slice(0, 10);
      let d = adicionarDiasSP(-7, dataAlvoLimpa);
      if (d < hoje) d = hoje;
      setData(d);
      const ddmm = formatarData(dataAlvoLimpa).slice(0, 5);
      setMotivo(`Marcar treinamento de instalação com a obra (${opcaoTexto}, ${ddmm})`);
    }
  }

  function aplicarModeloEntrega(targetLoteId: string) {
    setLoteId(targetLoteId);
    setAvisoData(null);
    const lote = lotes.find((l) => l.id === targetLoteId);
    if (!lote) return;

    const tipoLegivel = TIPOS_LOTE_LABELS[lote.tipo as TipoLote] || lote.tipo;
    const tipoDesc = `${tipoLegivel}${lote.descricao ? ` ${lote.descricao}` : ''}`;
    const hoje = obterHojeSP();
    let dataEntrega: string | null = null;

    if (Array.isArray(lote.entregas) && lote.entregas.length > 0) {
      const prox = lote.entregas.find((e: any) => !e.entregue_em);
      if (prox) {
        dataEntrega = prox.data_confirmada || prox.previsao || null;
      }
    } else if (!lote.entregue_em) {
      dataEntrega = lote.data_confirmada || lote.previsao_entrega || null;
    }

    if (!dataEntrega) {
      setData('');
      setAvisoData('Sem data de entrega prevista para este lote. Informe a data.');
      setMotivo(`Confirmar entrega de ${tipoDesc}`);
    } else {
      const dataEntregaLimpa = dataEntrega.slice(0, 10);
      let d = adicionarDiasSP(-7, dataEntregaLimpa);
      if (d < hoje) d = hoje;
      setData(d);
      const ddmm = formatarData(dataEntregaLimpa).slice(0, 5);
      setMotivo(`Confirmar entrega de ${tipoDesc} prevista para ${ddmm}`);
    }
  }

  function handleMudarModelo(novoModelo: ModeloFollowup) {
    setModelo(novoModelo);
    setAvisoData(null);

    if (novoModelo === 'livre') {
      setData(adicionarDiasSP(7));
      setMotivo('');
      setLoteId('');
    } else if (novoModelo === 'lembrar_medicao') {
      const lotePadrao = lotes.find((l) => !!l.previsao_medicao) || lotes[0];
      if (lotePadrao) {
        aplicarModeloMedicao(lotePadrao.id);
      } else {
        setData(obterHojeSP());
        setMotivo('Confirmar com a obra a medição');
      }
    } else if (novoModelo === 'treinamento_instalacao') {
      aplicarModeloTreinamento('apto_modelo');
    } else if (novoModelo === 'confirmar_entrega') {
      const lotePadrao =
        lotes.find((l) => (Array.isArray(l.entregas) && l.entregas.some((e: any) => !e.entregue_em)) || (!l.entregue_em && (l.data_confirmada || l.previsao_entrega))) ||
        lotes[0];
      if (lotePadrao) {
        aplicarModeloEntrega(lotePadrao.id);
      } else {
        setData(obterHojeSP());
        setMotivo('Confirmar entrega com a obra');
      }
    }
  }

  useEffect(() => {
    if (open) {
      handleMudarModelo(modeloInicial);
    }
  }, [open, modeloInicial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const motivoLimpo = motivo.trim();
    if (!motivoLimpo) {
      toast.error('Informe o motivo do follow-up.');
      return;
    }
    if (!data) {
      toast.error('Informe a data do follow-up.');
      return;
    }

    try {
      setSalvando(true);
      await executarCriar({
        data: {
          obraId,
          loteId: loteId || undefined,
          data,
          motivo: motivoLimpo,
        },
      });

      toast.success('Follow-up da obra agendado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar follow-up.');
    } finally {
      setSalvando(false);
    }
  }

  const atalhosDias = [3, 7, 15, 30];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Acompanhamento</span>
          </div>
          <DialogTitle className="text-xl font-bold">Novo Follow-up da Obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Escolha um modelo automático ou defina um lembrete livre para esta obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Select de Modelo */}
          <div className="space-y-1.5">
            <label htmlFor="modelo-fup" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Modelo de Follow-up
            </label>
            <Select value={modelo} onValueChange={(v) => handleMudarModelo(v as ModeloFollowup)}>
              <SelectTrigger id="modelo-fup" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="livre">Livre (personalizado)</SelectItem>
                <SelectItem value="lembrar_medicao">Lembrar medição</SelectItem>
                <SelectItem value="treinamento_instalacao">Treinamento de instalação</SelectItem>
                <SelectItem value="confirmar_entrega">Confirmar entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subcampos específicos do modelo */}
          {modelo === 'lembrar_medicao' && (
            <div className="space-y-1.5 p-3 rounded-lg bg-accent/20 border border-border">
              <label htmlFor="lote-med-fup" className="text-xs font-semibold text-foreground">
                Lote da medição *
              </label>
              <Select value={loteId} onValueChange={(id) => aplicarModeloMedicao(id)}>
                <SelectTrigger id="lote-med-fup" className="h-9">
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => {
                    const tipoNome = TIPOS_LOTE_LABELS[l.tipo as TipoLote] || l.tipo;
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        {tipoNome}{l.descricao ? ` - ${l.descricao}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {modelo === 'treinamento_instalacao' && (
            <div className="space-y-3 p-3 rounded-lg bg-accent/20 border border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Quando realizar o treinamento? *
                </label>
                <Select
                  value={quandoTreinamento}
                  onValueChange={(q) => aplicarModeloTreinamento(q as QuandoTreinamento)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apto_modelo">Na entrega do apto modelo</SelectItem>
                    <SelectItem value="primeira_entrega">Na primeira entrega da obra</SelectItem>
                    <SelectItem value="especifica">Data específica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quandoTreinamento === 'especifica' && (
                <div className="space-y-1">
                  <label htmlFor="data-esp-treinamento" className="text-[11px] font-medium text-muted-foreground">
                    Data da entrega de referência
                  </label>
                  <Input
                    id="data-esp-treinamento"
                    type="date"
                    value={dataEspecificaTreinamento}
                    onChange={(e) => {
                      setDataEspecificaTreinamento(e.target.value);
                      aplicarModeloTreinamento('especifica', e.target.value);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {modelo === 'confirmar_entrega' && (
            <div className="space-y-1.5 p-3 rounded-lg bg-accent/20 border border-border">
              <label htmlFor="lote-ent-fup" className="text-xs font-semibold text-foreground">
                Lote da entrega *
              </label>
              <Select value={loteId} onValueChange={(id) => aplicarModeloEntrega(id)}>
                <SelectTrigger id="lote-ent-fup" className="h-9">
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => {
                    const tipoNome = TIPOS_LOTE_LABELS[l.tipo as TipoLote] || l.tipo;
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        {tipoNome}{l.descricao ? ` - ${l.descricao}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aviso se data de referência não encontrada */}
          {avisoData && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{avisoData}</span>
            </div>
          )}

          {/* Data do follow-up */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="data-fup-obra" className="text-xs font-semibold text-foreground">
                Data do Follow-up *
              </label>
              <span className="text-xs text-primary font-medium">
                {data ? formatarData(data) : 'Informe a data'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {atalhosDias.map((dias) => {
                const dataCalculada = adicionarDiasSP(dias);
                const ativo = data === dataCalculada;
                return (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setData(dataCalculada)}
                    className={`flex-1 min-w-[65px] h-8 rounded-md text-xs font-semibold border transition-all ${
                      ativo
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    +{dias} dias
                  </button>
                );
              })}
            </div>

            <Input
              id="data-fup-obra"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={salvando}
              required
              className="h-10"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label htmlFor="motivo-fup-obra" className="text-xs font-semibold text-foreground">
              Motivo do Follow-up *
            </label>
            <Input
              id="motivo-fup-obra"
              placeholder="Ex: Confirmar medição com o engenheiro da obra"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={salvando}
              required
              className="h-10"
            />
          </div>

          {/* Lote vinculado em modo livre */}
          {modelo === 'livre' && lotes.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="lote-fup-obra" className="text-xs font-semibold text-foreground">
                Lote vinculado (opcional)
              </label>
              <select
                id="lote-fup-obra"
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
                disabled={salvando}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs font-medium"
              >
                <option value="">Geral da obra (sem lote específico)</option>
                {lotes.map((lote) => {
                  const tipoNome = TIPOS_LOTE_LABELS[lote.tipo as TipoLote] || lote.tipo;
                  return (
                    <option key={lote.id} value={lote.id}>
                      {tipoNome}{lote.descricao ? ` - ${lote.descricao}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || !motivo.trim() || !data}
              className="gap-2 font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Agendar Follow-up
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
