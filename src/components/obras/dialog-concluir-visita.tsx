import { useState, useEffect, useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import {
  concluirVisitaObra,
  registrarArquivo,
  CATEGORIAS_VISITA_LABELS,
  type CategoriaFollowup,
  type TipoLote,
} from '@/lib/obras.functions';
import { obterHojeSP, formatarData } from '@/lib/date-utils';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Paperclip, X, File, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export interface ParametrosReposicaoAposVisita {
  tipo: TipoLote;
  semMedicao: boolean;
  descricao: string;
}

interface DialogConcluirVisitaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  visita: any | null;
  onSuccess: (reposicao?: ParametrosReposicaoAposVisita) => void;
}

const LIMITE_TAMANHO_BYTES = 20 * 1024 * 1024; // 20 MB

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function DialogConcluirVisita({
  open,
  onOpenChange,
  obraId,
  visita,
  onSuccess,
}: DialogConcluirVisitaProps) {
  const [dataVisita, setDataVisita] = useState(obterHojeSP());
  const [relato, setRelato] = useState('');
  const [precisaReposicao, setPrecisaReposicao] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const executarConcluirVisita = useServerFn(concluirVisitaObra);
  const executarRegistrarArquivo = useServerFn(registrarArquivo);

  useEffect(() => {
    if (open) {
      setDataVisita(obterHojeSP());
      setRelato('');
      setPrecisaReposicao(false);
      setArquivos([]);
      setSalvando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  if (!visita) return null;

  const cat = (visita.categoria as CategoriaFollowup) || 'visita_tecnica';
  const tipoLabel = CATEGORIAS_VISITA_LABELS[cat] || 'Visita';

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selecionados = Array.from(e.target.files);

    const validos: File[] = [];
    for (const f of selecionados) {
      if (f.size > LIMITE_TAMANHO_BYTES) {
        toast.error(`O arquivo "${f.name}" excede o limite máximo de 20 MB.`);
      } else {
        validos.push(f);
      }
    }

    setArquivos((prev) => [...prev, ...validos]);
  }

  function removerArquivo(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const relatoLimpo = relato.trim();
    if (!relatoLimpo) {
      toast.error('Informe o que aconteceu na visita/serviço.');
      return;
    }
    if (!dataVisita) {
      toast.error('Informe a data da realização.');
      return;
    }

    try {
      setSalvando(true);

      // 1. Concluir follow-up e gravar registro tipo 'visita'
      const res = await executarConcluirVisita({
        data: {
          obraId,
          followupId: visita.id,
          data: dataVisita,
          relato: relatoLimpo,
          tipoLabel,
          loteId: visita.lote_id || undefined,
        },
      });

      const novoRegistroId = res.registroId;

      // 2. Upload de anexos se houver
      if (arquivos.length > 0 && novoRegistroId) {
        for (const file of arquivos) {
          const nomeSanitizado = sanitizarNomeArquivo(file.name);
          const uuid = crypto.randomUUID();
          const caminho = `obras/${obraId}/${uuid}-${nomeSanitizado}`;

          const { error: uploadErr } = await supabase.storage
            .from('arquivos')
            .upload(caminho, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadErr) {
            toast.error(`Falha no upload de "${file.name}": ${uploadErr.message}`);
            continue;
          }

          try {
            await executarRegistrarArquivo({
              data: {
                obraId,
                loteId: visita.lote_id || undefined,
                registroId: novoRegistroId,
                nome: file.name,
                mime: file.type || undefined,
                tamanho: file.size,
                caminho,
              },
            });
          } catch (regErr: any) {
            await supabase.storage.from('arquivos').remove([caminho]);
            toast.error(`Erro ao vincular "${file.name}": ${regErr.message}`);
          }
        }
      }

      toast.success(`${tipoLabel} concluída com sucesso!`);
      onOpenChange(false);

      if (precisaReposicao) {
        const ddmm = formatarData(dataVisita).slice(0, 5);
        onSuccess({
          tipo: 'reposicao',
          semMedicao: true,
          descricao: `Reposição da ${tipoLabel} de ${ddmm}`,
        });
      } else {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao concluir visita/serviço.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Concluir {tipoLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre o que aconteceu na visita/serviço e anexe fotos ou relatórios se desejar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Data da realização */}
            <div className="space-y-1.5">
              <Label htmlFor="data-visita" className="text-xs font-semibold">
                Data de realização *
              </Label>
              <Input
                id="data-visita"
                type="date"
                value={dataVisita}
                onChange={(e) => setDataVisita(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            {/* O que aconteceu */}
            <div className="space-y-1.5">
              <Label htmlFor="relato-visita" className="text-xs font-semibold">
                O que aconteceu *
              </Label>
              <Textarea
                id="relato-visita"
                placeholder="Ex: Reguladas todas as folhas da sacada; cliente assinou termo de recebimento sem pendências."
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                rows={3}
                required
                className="text-xs resize-none"
              />
            </div>

            {/* Anexos opcionais */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Anexos (opcional)
                </Label>
                <span className="text-[10px] text-muted-foreground">Máx. 20 MB por arquivo</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs h-8 border-dashed gap-1.5"
              >
                <UploadCloud className="h-4 w-4" />
                Selecionar arquivos (fotos, relatórios, etc.)
              </Button>

              {arquivos.length > 0 && (
                <div className="space-y-1 mt-2 max-h-28 overflow-y-auto pr-1">
                  {arquivos.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-1.5 rounded border border-border bg-muted/30 text-xs"
                    >
                      <span className="truncate flex items-center gap-1 text-[11px]">
                        <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => removerArquivo(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkbox: Precisa de reposição */}
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <div className="flex items-start space-x-2.5">
                <Checkbox
                  id="precisa-reposicao"
                  checked={precisaReposicao}
                  onCheckedChange={(checked) => setPrecisaReposicao(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="grid gap-1 leading-none">
                  <Label
                    htmlFor="precisa-reposicao"
                    className="text-xs font-bold text-foreground cursor-pointer"
                  >
                    Precisa de reposição
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Se marcado, abrirá o cadastro de um novo lote de reposição sem medição ao concluir.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Concluindo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir visita
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
