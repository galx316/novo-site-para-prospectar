import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  criarLote,
  criarFollowupObra,
  TIPOS_LOTE_LABELS,
  type TipoLote,
} from '@/lib/obras.functions';
import { obterHojeSP, adicionarDiasSP, formatarData } from '@/lib/date-utils';
import type { Database } from '@/integrations/supabase/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Loader2, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface DialogNovoLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes?: any[];
  onSuccess: () => void;
  initialTipo?: TipoLote | undefined;
  initialSemMedicao?: boolean | undefined;
  initialDescricao?: string | undefined;
}

const TIPOS_LOTE_OPCOES: { valor: TipoLote; rotulo: string }[] = [
  { valor: 'contramarco', rotulo: 'Contramarco' },
  { valor: 'apto_modelo', rotulo: 'Apto modelo' },
  { valor: 'andar_tipo', rotulo: 'Andar tipo' },
  { valor: 'area_comum', rotulo: 'Área comum' },
  { valor: 'especiais', rotulo: 'Especiais' },
  { valor: 'reposicao', rotulo: 'Reposição' },
];

function calcularProximoNumeroMedicao(todosLotes: any[] = []): number {
  const lotesMedicao = todosLotes.filter((l) => !l.sem_medicao);
  const medidos = lotesMedicao
    .filter((l) => !!l.medido_em)
    .sort((a, b) => String(a.medido_em).localeCompare(String(b.medido_em)));
  const previstos = lotesMedicao
    .filter((l) => !l.medido_em && !!l.previsao_medicao)
    .sort((a, b) => String(a.previsao_medicao).localeCompare(String(b.previsao_medicao)));
  return medidos.length + previstos.length + 1;
}

export function DialogNovoLote({
  open,
  onOpenChange,
  obraId,
  lotes = [],
  onSuccess,
  initialTipo,
  initialSemMedicao,
  initialDescricao,
}: DialogNovoLoteProps) {
  const [tipo, setTipo] = useState<TipoLote>(initialTipo || 'contramarco');
  const [semMedicao, setSemMedicao] = useState(
    initialSemMedicao ?? (initialTipo === 'apto_modelo' || initialTipo === 'reposicao')
  );
  const [descricao, setDescricao] = useState(initialDescricao || '');
  const [quantidade, setQuantidade] = useState<string>('');
  const [cadastroCompleto, setCadastroCompleto] = useState(false);
  const [previsaoMedicao, setPrevisaoMedicao] = useState('');
  const [medidoEm, setMedidoEm] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Lembrete
  const [criarLembrete, setCriarLembrete] = useState(true);
  const [dataLembrete, setDataLembrete] = useState('');
  const [motivoLembrete, setMotivoLembrete] = useState('');

  const executarCriarLote = useServerFn(criarLote);
  const executarCriarFollowup = useServerFn(criarFollowupObra);

  useEffect(() => {
    if (open) {
      const t = initialTipo || 'contramarco';
      setTipo(t);
      setSemMedicao(initialSemMedicao ?? (t === 'apto_modelo' || t === 'reposicao'));
      setDescricao(initialDescricao || '');
      setQuantidade('');
      setCadastroCompleto(false);
      setPrevisaoMedicao('');
      setMedidoEm('');
      setCriarLembrete(true);
      setDataLembrete('');
      setMotivoLembrete('');
    }
  }, [open, initialTipo, initialSemMedicao, initialDescricao]);

  function atualizarSugestaoLembrete(prevData: string, tipoAtual = tipo, descAtual = descricao) {
    if (!prevData) return;
    const hoje = obterHojeSP();
    let d = adicionarDiasSP(-3, prevData);
    if (d < hoje) d = hoje;
    setDataLembrete(d);

    const numMed = calcularProximoNumeroMedicao(lotes);
    const ddmm = formatarData(prevData).slice(0, 5);
    const tipoLegivel = TIPOS_LOTE_LABELS[tipoAtual] || tipoAtual;
    const tipoDesc = `${tipoLegivel}${descAtual.trim() ? ` ${descAtual.trim()}` : ''}`;
    setMotivoLembrete(`Confirmar com a obra a ${numMed}ª medição (${tipoDesc}) prevista para ${ddmm}`);
  }

  function resetForm() {
    setTipo('contramarco');
    setSemMedicao(false);
    setDescricao('');
    setQuantidade('');
    setCadastroCompleto(false);
    setPrevisaoMedicao('');
    setMedidoEm('');
    setCriarLembrete(true);
    setDataLembrete('');
    setMotivoLembrete('');
    setSalvando(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) {
      toast.error('Selecione o tipo do lote.');
      return;
    }

    if (!semMedicao && medidoEm && !cadastroCompleto) {
      toast.error('Complete o cadastro do lote antes da medição.');
      return;
    }

    try {
      setSalvando(true);
      const qtdNum = quantidade ? parseInt(quantidade, 10) : undefined;
      const res = await executarCriarLote({
        data: {
          obraId,
          tipo,
          descricao: descricao.trim() || undefined,
          quantidade: isNaN(qtdNum as number) ? undefined : qtdNum,
          cadastro_completo: cadastroCompleto,
          previsao_medicao: semMedicao ? undefined : (previsaoMedicao || undefined),
          medido_em: semMedicao ? undefined : (medidoEm || undefined),
          sem_medicao: semMedicao,
        },
      });

      // Se lembrete foi solicitado e há previsão de medição (só para lote com medição)
      if (
        !semMedicao &&
        criarLembrete &&
        previsaoMedicao &&
        dataLembrete &&
        motivoLembrete.trim() &&
        res?.lote?.id
      ) {
        try {
          await executarCriarFollowup({
            data: {
              obraId,
              loteId: res.lote.id,
              data: dataLembrete,
              motivo: motivoLembrete.trim(),
            },
          });
        } catch (fupErr: any) {
          toast.error(`Aviso: falha ao agendar lembrete: ${fupErr.message}`);
        }
      }

      toast.success('Lote criado com sucesso.');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lote.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Package className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Novo Lote</span>
          </div>
          <DialogTitle className="text-xl font-bold">Cadastrar lote da obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            O prazo e cronograma serão configurados e acompanhados a partir da medição do lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tipo de Lote *</label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                const novoTipo = v as TipoLote;
                setTipo(novoTipo);
                const ehSemMed = novoTipo === 'apto_modelo' || novoTipo === 'reposicao';
                setSemMedicao(ehSemMed);
                if (previsaoMedicao) atualizarSugestaoLembrete(previsaoMedicao, novoTipo);
              }}
              disabled={salvando}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_LOTE_OPCOES.map((opt) => (
                  <SelectItem key={opt.valor} value={opt.valor}>
                    {opt.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="desc-lote" className="text-xs font-semibold text-foreground">
              Descrição / Identificação (opcional)
            </label>
            <Input
              id="desc-lote"
              placeholder="Ex.: Torre A, Peças faltantes do andar tipo, Guarita"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                if (previsaoMedicao) atualizarSugestaoLembrete(previsaoMedicao, tipo, e.target.value);
              }}
              disabled={salvando}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qtd-lote" className="text-xs font-semibold text-foreground">
              Quantidade de Peças / Vãos (opcional)
            </label>
            <Input
              id="qtd-lote"
              type="number"
              min="1"
              placeholder="Ex: 40"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={salvando}
              className="h-10"
            />
          </div>

          {/* Não precisa de medição */}
          <div className="rounded-lg border border-border bg-accent/30 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Não precisa de medição</p>
              <p className="text-[11px] text-muted-foreground">
                Marcado automaticamente para apto modelo e reposição.
              </p>
            </div>
            <Checkbox
              id="novo-sem-medicao"
              checked={semMedicao}
              onCheckedChange={(checked) => setSemMedicao(!!checked)}
              disabled={salvando}
            />
          </div>

          {/* Cadastro Completo */}
          <div className="rounded-lg border border-border bg-accent/30 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Cadastro Completo</p>
              <p className="text-[11px] text-muted-foreground">
                {semMedicao
                  ? 'Avança o lote diretamente para PCP após salvar.'
                  : 'Obrigatório para registrar a data de medição efetiva.'}
              </p>
            </div>
            <Checkbox
              id="novo-cad-completo"
              checked={cadastroCompleto}
              onCheckedChange={(checked) => setCadastroCompleto(!!checked)}
              disabled={salvando}
            />
          </div>

          {/* Datas de Medição (escondidas se semMedicao for true) */}
          {!semMedicao && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="novo-prev-med" className="text-xs font-semibold text-foreground">
                    Previsão de Medição
                  </label>
                  <Input
                    id="novo-prev-med"
                    type="date"
                    value={previsaoMedicao}
                    onChange={(e) => {
                      setPrevisaoMedicao(e.target.value);
                      if (e.target.value) {
                        setCriarLembrete(true);
                        atualizarSugestaoLembrete(e.target.value);
                      }
                    }}
                    disabled={salvando}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="novo-med-em" className="text-xs font-semibold text-foreground">
                    Medido em
                  </label>
                  <Input
                    id="novo-med-em"
                    type="date"
                    value={medidoEm}
                    onChange={(e) => setMedidoEm(e.target.value)}
                    disabled={salvando}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Lembrete ao prever medição */}
              {previsaoMedicao && (
                <div className="rounded-lg border border-border bg-accent/20 p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="novo-chk-lembrete"
                      checked={criarLembrete}
                      onCheckedChange={(c) => setCriarLembrete(!!c)}
                      disabled={salvando}
                    />
                    <label
                      htmlFor="novo-chk-lembrete"
                      className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bell className="h-3.5 w-3.5 text-primary" />
                      Criar lembrete
                    </label>
                  </div>

                  {criarLembrete && (
                    <div className="space-y-2 pl-6 pt-1">
                      <div className="space-y-1">
                        <label htmlFor="novo-data-lembrete" className="text-[11px] font-medium text-muted-foreground">
                          Data do lembrete
                        </label>
                        <Input
                          id="novo-data-lembrete"
                          type="date"
                          value={dataLembrete}
                          onChange={(e) => setDataLembrete(e.target.value)}
                          disabled={salvando}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="novo-motivo-lembrete" className="text-[11px] font-medium text-muted-foreground">
                          Motivo do lembrete
                        </label>
                        <Input
                          id="novo-motivo-lembrete"
                          value={motivoLembrete}
                          onChange={(e) => setMotivoLembrete(e.target.value)}
                          disabled={salvando}
                          placeholder="Motivo do follow-up"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
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
            <Button type="submit" disabled={salvando} className="gap-2 font-semibold">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Criar Lote
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
