import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  importarEntregas,
  registrarNotaObra,
  registrarArquivo,
} from '@/lib/obras.functions';
import { supabase } from '@/integrations/supabase/client';
import { lerCronogramaPrado, type CronogramaPradoLido } from '@/lib/ler-cronograma-prado';
import { formatarData, obterHojeSP } from '@/lib/date-utils';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FileText,
  UploadCloud,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface LinhaEntregaEdicao {
  id: string;
  rotulo: string;
  quantidade: string;
  previsao: string;
  observacao: string;
}

interface DialogImportarCronogramaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lote: any | null;
  onSuccess: () => void;
}

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function DialogImportarCronograma({
  open,
  onOpenChange,
  obraId,
  lote,
  onSuccess,
}: DialogImportarCronogramaProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modo, setModo] = useState<'automatico' | 'anexar'>('automatico');
  const [fase, setFase] = useState<'selecao' | 'conferencia' | 'erro_leitura'>('selecao');
  const [processando, setProcessando] = useState(false);

  const [dadosLidos, setDadosLidos] = useState<CronogramaPradoLido | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);

  const [linhas, setLinhas] = useState<LinhaEntregaEdicao[]>([]);
  const [usarQtdLote, setUsarQtdLote] = useState(true);
  const [substituirPendentes, setSubstituirPendentes] = useState<'substituir' | 'adicionar'>('substituir');

  const executarImportarEntregas = useServerFn(importarEntregas);
  const executarRegistrarNota = useServerFn(registrarNotaObra);
  const executarRegistrarArquivo = useServerFn(registrarArquivo);

  useEffect(() => {
    if (open) {
      setArquivo(null);
      setModo('automatico');
      setFase('selecao');
      setProcessando(false);
      setDadosLidos(null);
      setErroLeitura(null);
      setLinhas([]);
      setUsarQtdLote(true);
      setSubstituirPendentes('substituir');
    }
  }, [open, lote]);

  if (!lote) return null;

  const temEntregasPendentes =
    Array.isArray(lote.entregas) && lote.entregas.some((e: any) => !e.entregue_em);

  // Cálculos de checagem
  const totalCronograma = dadosLidos?.total ?? null;
  const somaTabela = linhas.reduce((acc, l) => acc + (parseInt(l.quantidade, 10) || 0), 0);
  const qtdLote = lote.quantidade ?? null;

  const avisoDiferencaCronograma = totalCronograma != null && somaTabela !== totalCronograma;
  const avisoExcedeLote = qtdLote != null && somaTabela > qtdLote;
  const temAviso = avisoDiferencaCronograma || avisoExcedeLote;

  function adicionarLinha() {
    const proximoNum = linhas.length + 1;
    setLinhas((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        rotulo: `${proximoNum}ª entrega`,
        quantidade: '',
        previsao: '',
        observacao: '',
      },
    ]);
  }

  function removerLinha(id: string) {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }

  function atualizarLinha(id: string, campo: keyof LinhaEntregaEdicao, valor: string) {
    setLinhas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l))
    );
  }

  async function handleConfirmarArquivo(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) {
      toast.error('Selecione um arquivo PDF.');
      return;
    }

    try {
      setProcessando(true);

      // 1. Tenta leitura do PDF
      let parsed: CronogramaPradoLido | null = null;
      let leituraErroMsg: string | null = null;

      try {
        const buffer = await arquivo.arrayBuffer();
        parsed = await lerCronogramaPrado(buffer);
      } catch (err: any) {
        leituraErroMsg = err?.message || 'Arquivo fora do padrão do cronograma Prado.';
      }

      // 2. SEMPRE salvar o PDF (Regra 3)
      const partesTitulo = [parsed?.titulo, parsed?.numero].filter(Boolean);
      const textoNota =
        partesTitulo.length > 0
          ? `Cronograma de entrega: ${partesTitulo.join(' - ')}`
          : `Cronograma de entrega: ${arquivo.name}`;

      const resNota = await executarRegistrarNota({
        data: {
          obraId,
          loteId: lote.id,
          tipo: 'cronograma',
          texto: textoNota,
          data: obterHojeSP(),
        },
      });

      const registroId = resNota?.registro?.id;

      // Upload do arquivo para o storage Supabase
      const nomeSanitizado = sanitizarNomeArquivo(arquivo.name);
      const uuid = crypto.randomUUID();
      const caminho = `obras/${obraId}/${uuid}-${nomeSanitizado}`;

      const { error: uploadErr } = await supabase.storage
        .from('arquivos')
        .upload(caminho, arquivo, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`Falha no upload do arquivo: ${uploadErr.message}`);
      }

      await executarRegistrarArquivo({
        data: {
          obraId,
          loteId: lote.id,
          registroId,
          nome: arquivo.name,
          mime: arquivo.type || 'application/pdf',
          tamanho: arquivo.size,
          caminho,
        },
      });

      // 3. Destino baseado no modo escolhido
      if (modo === 'anexar') {
        toast.success('Arquivo de cronograma salvo e anexado com sucesso!');
        onOpenChange(false);
        onSuccess();
        return;
      }

      // Modo automático
      if (leituraErroMsg || !parsed) {
        setErroLeitura(leituraErroMsg || 'Falha na leitura automática do cronograma.');
        setFase('erro_leitura');
        onSuccess(); // Arquivo já salvo, atualiza histórico da obra
        return;
      }

      // Leitura bem sucedida: avança para a conferência
      setDadosLidos(parsed);
      const novasLinhas: LinhaEntregaEdicao[] = parsed.grupos.map((g, idx) => ({
        id: String(idx + 1),
        rotulo: g.rotulo,
        quantidade: g.quantidade != null ? String(g.quantidade) : '',
        previsao: g.data || '',
        observacao: g.rotulo === 'Apto modelo' ? 'Apto modelo' : '',
      }));

      setLinhas(novasLinhas);
      setUsarQtdLote(!lote.quantidade && Boolean(parsed.total && parsed.total > 0));
      setSubstituirPendentes('substituir');
      setFase('conferencia');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar cronograma.');
    } finally {
      setProcessando(false);
    }
  }

  async function handleSalvarEntregasConferidas() {
    if (linhas.length === 0) {
      toast.error('Adicione ao menos uma entrega na tabela.');
      return;
    }

    try {
      setProcessando(true);

      const entregasPayload = linhas.map((l) => {
        const qtdNum = l.quantidade ? parseInt(l.quantidade, 10) : null;
        return {
          quantidade: isNaN(qtdNum as number) ? null : qtdNum,
          previsao: l.previsao || null,
          observacao: l.observacao.trim() || null,
        };
      });

      await executarImportarEntregas({
        data: {
          obraId,
          loteId: lote.id,
          entregas: entregasPayload,
          substituirPendentes: substituirPendentes === 'substituir',
          quantidadeLote:
            !lote.quantidade && usarQtdLote && totalCronograma
              ? totalCronograma
              : undefined,
        },
      });

      toast.success('Cronograma importado e entregas salvas com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar entregas.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <UploadCloud className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Cronograma Prado</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            {fase === 'conferencia'
              ? 'Conferência do Cronograma'
              : fase === 'erro_leitura'
              ? 'Arquivo Salvo'
              : 'Importar Cronograma de Entrega'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {fase === 'conferencia'
              ? 'Confira os dados extraídos do PDF antes de gravar as entregas no lote.'
              : fase === 'erro_leitura'
              ? 'O PDF foi anexado ao lote, mas a extração automática encontrou divergências.'
              : 'Envie o relatório PDF da Prado para preencher as entregas automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        {/* FASE 1: SELEÇÃO DE ARQUIVO E MODO */}
        {fase === 'selecao' && (
          <form onSubmit={handleConfirmarArquivo} className="space-y-5 py-2">
            {/* Escolha do arquivo */}
            <div className="space-y-2">
              <label htmlFor="input-pdf-cronograma" className="text-xs font-semibold text-foreground">
                Arquivo PDF do Cronograma Prado *
              </label>
              <div className="flex items-center gap-3">
                <Input
                  id="input-pdf-cronograma"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setArquivo(f || null);
                  }}
                  disabled={processando}
                  className="cursor-pointer file:cursor-pointer text-xs"
                  required
                />
              </div>
              {arquivo && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">{arquivo.name}</span>
                  <span>({(arquivo.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {/* Opção de preenchimento */}
            <div className="space-y-2.5 rounded-lg border border-border bg-accent/20 p-3.5">
              <span className="text-xs font-bold text-foreground block">
                Como deseja prosseguir?
              </span>
              <RadioGroup
                value={modo}
                onValueChange={(val) => setModo(val as 'automatico' | 'anexar')}
                disabled={processando}
                className="space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="automatico" id="modo-auto" className="mt-0.5" />
                  <label htmlFor="modo-auto" className="text-xs cursor-pointer">
                    <strong className="block text-foreground font-semibold">
                      Preencher automaticamente (eu confiro) — padrão
                    </strong>
                    <span className="text-muted-foreground text-[11px]">
                      O sistema lê os grupos (Apto modelo, 1ª entrega, datas e quantidades) para sua conferência.
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="anexar" id="modo-anexar" className="mt-0.5" />
                  <label htmlFor="modo-anexar" className="text-xs cursor-pointer">
                    <strong className="block text-foreground font-semibold">
                      Só anexar o arquivo (preencho manualmente)
                    </strong>
                    <span className="text-muted-foreground text-[11px]">
                      Salva o PDF nos arquivos da obra e do lote sem alterar as entregas atuais.
                    </span>
                  </label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={processando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!arquivo || processando}
                className="gap-2"
              >
                {processando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    {modo === 'automatico' ? 'Ler e Conferir' : 'Anexar Arquivo'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* FASE 2: CONFERÊNCIA DOS DADOS EXTRAÍDOS */}
        {fase === 'conferencia' && (
          <div className="space-y-4 py-2">
            {/* Metadados extraídos do PDF */}
            <div className="rounded-lg border border-border bg-accent/20 p-3 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                {dadosLidos?.titulo && (
                  <span>
                    <strong className="text-foreground">Título:</strong> {dadosLidos.titulo}
                  </span>
                )}
                {dadosLidos?.numero && (
                  <span>
                    <strong className="text-foreground">Nº:</strong> {dadosLidos.numero}
                  </span>
                )}
                {dadosLidos?.entrada && (
                  <span>
                    <strong className="text-foreground">Entrada:</strong>{' '}
                    {formatarData(dadosLidos.entrada)}
                  </span>
                )}
              </div>
            </div>

            {/* Tabela Editável */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Entregas Identificadas ({linhas.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarLinha}
                  className="h-7 text-xs font-semibold gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Linha
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                      <th className="py-2 px-3">Entrega</th>
                      <th className="py-2 px-3 w-28">Quantidade</th>
                      <th className="py-2 px-3 w-36">Data combinada</th>
                      <th className="py-2 px-3">Observação</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {linhas.map((linha) => (
                      <tr key={linha.id} className="hover:bg-accent/10">
                        <td className="py-1.5 px-3">
                          <Input
                            value={linha.rotulo}
                            onChange={(e) => atualizarLinha(linha.id, 'rotulo', e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Ex: 1ª entrega"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="number"
                            min="0"
                            value={linha.quantidade}
                            onChange={(e) =>
                              atualizarLinha(linha.id, 'quantidade', e.target.value)
                            }
                            className="h-7 text-xs"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="date"
                            value={linha.previsao}
                            onChange={(e) =>
                              atualizarLinha(linha.id, 'previsao', e.target.value)
                            }
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            value={linha.observacao}
                            onChange={(e) =>
                              atualizarLinha(linha.id, 'observacao', e.target.value)
                            }
                            className="h-7 text-xs"
                            placeholder="Opcional"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerLinha(linha.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Remover linha"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Linha de Checagem */}
            <div
              className={`rounded-md p-2.5 text-xs border ${
                temAviso
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border bg-accent/20 text-muted-foreground'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Total do cronograma:{' '}
                  <strong>{totalCronograma != null ? `${totalCronograma} peças` : '—'}</strong>
                  {' • '}
                  Soma da tabela: <strong>{somaTabela} peças</strong>
                  {' • '}
                  Quantidade do lote:{' '}
                  <strong>{qtdLote != null ? `${qtdLote} peças` : 'não definida'}</strong>
                </span>
                {temAviso && (
                  <span className="font-bold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {avisoExcedeLote
                      ? 'Soma ultrapassa o lote!'
                      : 'Soma difere do cronograma!'}
                  </span>
                )}
              </div>
            </div>

            {/* Opção se o lote estiver sem quantidade */}
            {!lote.quantidade && (
              <div className="flex items-center gap-2 pt-1 pl-1">
                <Checkbox
                  id="chk-usar-qtd-lote"
                  checked={usarQtdLote}
                  onCheckedChange={(c) => setUsarQtdLote(!!c)}
                  disabled={processando}
                />
                <label
                  htmlFor="chk-usar-qtd-lote"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  Usar {totalCronograma ?? somaTabela} como quantidade do lote
                </label>
              </div>
            )}

            {/* Opção se o lote já tiver entregas pendentes */}
            {temEntregasPendentes && (
              <div className="space-y-2 rounded-lg border border-border bg-accent/20 p-3 text-xs">
                <span className="font-bold text-foreground block">
                  O lote já possui entregas pendentes:
                </span>
                <RadioGroup
                  value={substituirPendentes}
                  onValueChange={(val) =>
                    setSubstituirPendentes(val as 'substituir' | 'adicionar')
                  }
                  disabled={processando}
                  className="space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="substituir" id="sub-pend-sub" />
                    <label htmlFor="sub-pend-sub" className="cursor-pointer font-medium">
                      Substituir as entregas pendentes (padrão)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="adicionar" id="sub-pend-add" />
                    <label htmlFor="sub-pend-add" className="cursor-pointer font-medium">
                      Adicionar às existentes
                    </label>
                  </div>
                </RadioGroup>
                <p className="text-[11px] text-muted-foreground italic">
                  Entregas já feitas nunca são apagadas.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={processando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSalvarEntregasConferidas}
                disabled={processando || linhas.length === 0}
                className="gap-2"
              >
                {processando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar entregas
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* FASE 3: ERRO DE LEITURA (ARQUIVO JÁ SALVO) */}
        {fase === 'erro_leitura' && (
          <div className="space-y-4 py-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-center max-w-md mx-auto">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">
                  {erroLeitura || 'Arquivo fora do padrão do cronograma Prado.'}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  O arquivo foi salvo. Preencha as entregas manualmente.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/60">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
