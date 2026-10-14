import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';

export interface ArquivoParaVisualizar {
  nome: string;
  mime?: string | null | undefined;
  caminho: string;
  tamanho?: number | null | undefined;
}

interface VisualizadorArquivoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arquivo: ArquivoParaVisualizar | null;
}

function formatarBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VisualizadorArquivo({
  open,
  onOpenChange,
  arquivo,
}: VisualizadorArquivoProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const carregarArquivo = useCallback(async () => {
    if (!arquivo?.caminho) return;

    try {
      setLoading(true);
      setErro(null);

      const { data: blob, error } = await supabase.storage
        .from('arquivos')
        .download(arquivo.caminho);

      if (error || !blob) {
        setErro(error?.message || 'Falha ao baixar o arquivo.');
        return;
      }

      // Cria a URL no navegador
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err: any) {
      setErro(err?.message || 'Erro inesperado ao carregar arquivo.');
    } finally {
      setLoading(false);
    }
  }, [arquivo]);

  useEffect(() => {
    if (open && arquivo) {
      carregarArquivo();
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setErro(null);
      setLoading(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [open, arquivo]);

  function handleBaixar() {
    if (!blobUrl || !arquivo) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = arquivo.nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!arquivo) return null;

  const isPdf =
    arquivo.mime === 'application/pdf' ||
    arquivo.nome.toLowerCase().endsWith('.pdf');

  const isImagem =
    Boolean(arquivo.mime?.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(arquivo.nome);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-[96vw] w-full p-4 sm:p-6 max-h-[95vh] flex flex-col gap-3">
        {/* Barra superior de ações */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3 pr-6">
          <div className="flex items-center gap-2 max-w-[70%] truncate">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-bold truncate">
              {arquivo.nome}
            </DialogTitle>
            {arquivo.tamanho ? (
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                ({formatarBytes(arquivo.tamanho)})
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBaixar}
              disabled={!blobUrl || loading}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              Fechar
            </Button>
          </div>
        </DialogHeader>

        {/* Área de Visualização */}
        <div className="flex-1 min-h-[50vh] flex items-center justify-center overflow-auto rounded-lg bg-accent/10 border border-border/50 p-2">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Carregando arquivo...</p>
            </div>
          )}

          {!loading && erro && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center max-w-md px-4">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Não foi possível carregar o arquivo</p>
                <p className="text-xs text-muted-foreground">{erro}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={carregarArquivo}
                className="gap-1.5 text-xs font-semibold mt-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar de novo
              </Button>
            </div>
          )}

          {!loading && !erro && blobUrl && (
            <>
              {isPdf && (
                <iframe
                  src={blobUrl}
                  title={arquivo.nome}
                  className="w-full h-[80vh] rounded-md border-0 bg-background"
                />
              )}

              {isImagem && !isPdf && (
                <div className="w-full h-full max-h-[80vh] flex items-center justify-center p-2">
                  <img
                    src={blobUrl}
                    alt={arquivo.nome}
                    className="max-h-[80vh] max-w-full object-contain rounded-md shadow-xs"
                  />
                </div>
              )}

              {!isPdf && !isImagem && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center max-w-md">
                  <FileText className="h-12 w-12 text-muted-foreground/60" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">{arquivo.nome}</p>
                    {arquivo.tamanho && (
                      <p className="text-xs text-muted-foreground">{formatarBytes(arquivo.tamanho)}</p>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                      Visualização não disponível para este tipo de arquivo.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleBaixar}
                    className="gap-1.5 text-xs font-semibold mt-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar arquivo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
