import { useState, useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { registrarArquivo, TIPOS_LOTE_LABELS } from '@/lib/obras.functions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogEnviarArquivosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes: any[];
  onSuccess: () => void;
}

const LIMITE_TAMANHO_BYTES = 20 * 1024 * 1024; // 20 MB

export function DialogEnviarArquivos({
  open,
  onOpenChange,
  obraId,
  lotes,
  onSuccess,
}: DialogEnviarArquivosProps) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [loteId, setLoteId] = useState<string>('nenhum');
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const executarRegistrarArquivo = useServerFn(registrarArquivo);

  function resetState() {
    setArquivos([]);
    setLoteId('nenhum');
    setEnviando(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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

  function sanitizarNomeArquivo(nome: string): string {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  function formatarBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleUpload() {
    if (arquivos.length === 0) {
      toast.error('Selecione pelo menos um arquivo para enviar.');
      return;
    }

    setEnviando(true);
    let enviadosComSucesso = 0;

    for (const file of arquivos) {
      const nomeSanitizado = sanitizarNomeArquivo(file.name);
      const uuid = crypto.randomUUID();
      const caminho = `obras/${obraId}/${uuid}-${nomeSanitizado}`;

      // 1. Upload no storage do Supabase
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('arquivos')
        .upload(caminho, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        toast.error(`Falha no upload de "${file.name}": ${uploadErr.message}`);
        continue;
      }

      // 2. Registrar na tabela arquivos
      try {
        await executarRegistrarArquivo({
          data: {
            obraId,
            loteId: loteId !== 'nenhum' ? loteId : undefined,
            nome: file.name,
            mime: file.type || undefined,
            tamanho: file.size,
            caminho,
          },
        });
        enviadosComSucesso++;
      } catch (regErr: any) {
        // Se registrarArquivo falhar, remover arquivo enviado do storage
        await supabase.storage.from('arquivos').remove([caminho]);
        toast.error(`Erro ao salvar registro de "${file.name}": ${regErr.message}`);
      }
    }

    setEnviando(false);
    if (enviadosComSucesso > 0) {
      toast.success(
        `${enviadosComSucesso} arquivo${enviadosComSucesso > 1 ? 's' : ''} enviado${enviadosComSucesso > 1 ? 's' : ''} com sucesso!`
      );
      resetState();
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <UploadCloud className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Arquivos</span>
          </div>
          <DialogTitle className="text-xl font-bold">Enviar arquivos para a obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Projetos, ordens de medição, atas ou laudos técnicos. Limite de 20 MB por arquivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lote opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Vincular a Lote (opcional)</label>
            <Select value={loteId} onValueChange={setLoteId} disabled={enviando}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Geral da obra (nenhum lote)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Geral da obra (nenhum lote)</SelectItem>
                {lotes.map((l) => {
                  const tipoLabel = TIPOS_LOTE_LABELS[l.tipo as keyof typeof TIPOS_LOTE_LABELS] || l.tipo;
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      {tipoLabel} {l.descricao ? `(${l.descricao})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Área de Seleção */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-accent/20"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
              disabled={enviando}
            />
            <UploadCloud className="h-8 w-8 mx-auto text-primary/70 mb-2" />
            <p className="text-xs font-semibold text-foreground">
              Clique para selecionar arquivos
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              PDF, imagens, planilhas ou documentos (até 20 MB cada)
            </p>
          </div>

          {/* Lista de selecionados */}
          {arquivos.length > 0 && (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              <p className="text-xs font-bold text-foreground">
                Arquivos selecionados ({arquivos.length}):
              </p>
              {arquivos.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      ({formatarBytes(file.size)})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removerArquivo(idx)}
                    disabled={enviando}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={enviando || arquivos.length === 0}
            className="gap-2 font-semibold"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando arquivos...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Enviar {arquivos.length > 0 ? `(${arquivos.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
