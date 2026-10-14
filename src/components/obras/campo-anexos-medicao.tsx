import React, { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Paperclip, File, X } from 'lucide-react';
import { toast } from 'sonner';

export const LIMITE_ARQUIVO_BYTES = 20 * 1024 * 1024; // 20 MB

interface CampoAnexosMedicaoProps {
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  disabled?: boolean;
}

export function CampoAnexosMedicao({
  arquivos,
  onChange,
  disabled = false,
}: CampoAnexosMedicaoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selecionados = Array.from(e.target.files);
    const validos: File[] = [];

    for (const f of selecionados) {
      if (f.size > LIMITE_ARQUIVO_BYTES) {
        toast.error(`O arquivo "${f.name}" excede o limite máximo de 20 MB.`);
      } else {
        validos.push(f);
      }
    }

    onChange([...arquivos, ...validos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removerArquivo(idx: number) {
    onChange(arquivos.filter((_, i) => i !== idx));
  }

  function formatarBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          Anexar arquivos da medição (opcional)
        </label>
        <span className="text-[10px] text-muted-foreground">Máx. 20 MB por arquivo</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelection}
        disabled={disabled}
        className="hidden"
        id="anexos-medicao-input"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-9 text-xs font-medium border-dashed border-border hover:border-primary gap-1.5"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {arquivos.length === 0 ? 'Selecionar arquivos da medição' : 'Adicionar mais arquivos'}
      </Button>

      {arquivos.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {arquivos.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-2 rounded-md bg-accent/30 border border-border/60 text-xs"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <File className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  ({formatarBytes(file.size)})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => removerArquivo(index)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Função utilitária para fazer upload dos arquivos e registrar no banco.
 */
export async function uploadArquivosMedicao({
  arquivos,
  obraId,
  loteId,
  registroId,
  registrarArquivoFn,
}: {
  arquivos: File[];
  obraId: string;
  loteId?: string | null;
  registroId?: string;
  registrarArquivoFn: any;
}): Promise<number> {
  let enviados = 0;

  for (const file of arquivos) {
    const nomeSanitizado = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const uuid = crypto.randomUUID();
    const caminho = `obras/${obraId}/${uuid}-${nomeSanitizado}`;

    const { error: uploadErr } = await supabase.storage
      .from('arquivos')
      .upload(caminho, file, { cacheControl: '3600', upsert: false });

    if (uploadErr) {
      toast.error(`Falha no upload de "${file.name}": ${uploadErr.message}`);
      continue;
    }

    try {
      await registrarArquivoFn({
        data: {
          obraId,
          loteId: loteId || undefined,
          registroId: registroId || undefined,
          nome: file.name,
          mime: file.type || undefined,
          tamanho: file.size,
          caminho,
        },
      });
      enviados++;
    } catch (regErr: any) {
      await supabase.storage.from('arquivos').remove([caminho]);
      toast.error(`Erro ao salvar registro de "${file.name}": ${regErr.message}`);
    }
  }

  return enviados;
}
