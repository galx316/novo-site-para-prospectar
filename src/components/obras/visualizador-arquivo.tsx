import { useState, useEffect, useCallback, useRef } from 'react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';

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

interface PaginaPdfProps {
  pdfDoc: any;
  pageNum: number;
  containerWidth: number;
}

function PaginaPdf({ pdfDoc, pageNum, containerWidth }: PaginaPdfProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderizando, setRenderizando] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    async function renderPage() {
      if (!canvasRef.current || !pdfDoc) return;
      try {
        setRenderizando(true);
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        // Largura ajustada à largura disponível do modal com margem de segurança
        const targetWidth = Math.max(containerWidth - 32, 280);
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          ...(transform ? { transform } : {}),
        });

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Erro ao renderizar página ${pageNum}:`, err);
        }
      } finally {
        if (!cancelled) {
          setRenderizando(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, containerWidth]);

  return (
    <div
      data-page={pageNum}
      className="w-full flex flex-col items-center justify-center py-2 shrink-0"
    >
      <div className="relative rounded shadow-md border border-border/50 bg-white overflow-hidden max-w-full">
        <canvas ref={canvasRef} className="block max-w-full" />
        {renderizando && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] min-h-[300px]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

export function VisualizadorArquivo({
  open,
  onOpenChange,
  arquivo,
}: VisualizadorArquivoProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Estados de PDF
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [totalPaginas, setTotalPaginas] = useState<number>(0);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isPdf =
    arquivo?.mime === 'application/pdf' ||
    Boolean(arquivo?.nome?.toLowerCase().endsWith('.pdf'));

  const isImagem =
    Boolean(arquivo?.mime?.startsWith('image/')) ||
    (arquivo?.nome ? /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(arquivo.nome) : false);

  // Monitora largura do container do modal
  useEffect(() => {
    if (!open) return;
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };
    const t = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateWidth);
    };
  }, [open]);

  // Atualiza página atual conforme o usuário rola o modal
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || totalPaginas <= 1) return;
    const pageElements = container.querySelectorAll<HTMLElement>('[data-page]');
    const containerTop = container.getBoundingClientRect().top;

    let current = 1;
    pageElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top - containerTop <= 160) {
        const p = Number(el.getAttribute('data-page'));
        if (p) current = p;
      }
    });
    setPaginaAtual(current);
  }, [totalPaginas]);

  const carregarArquivo = useCallback(async () => {
    if (!arquivo?.caminho) return;

    try {
      setLoading(true);
      setErro(null);

      // Limpa documento anterior se houver
      if (pdfDoc) {
        try {
          pdfDoc.destroy();
        } catch {}
        setPdfDoc(null);
      }
      setTotalPaginas(0);
      setPaginaAtual(1);

      const { data: blob, error } = await supabase.storage
        .from('arquivos')
        .download(arquivo.caminho);

      if (error || !blob) {
        setErro(error?.message || 'Falha ao baixar o arquivo.');
        return;
      }

      // Cria a URL no navegador para o botão Baixar
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // Se for PDF, renderiza via pdfjs-dist a partir do ArrayBuffer
      if (isPdf) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPaginas(doc.numPages);
        setPaginaAtual(1);
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro inesperado ao carregar arquivo.');
    } finally {
      setLoading(false);
    }
  }, [arquivo, isPdf]);

  useEffect(() => {
    if (open && arquivo) {
      carregarArquivo();
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      if (pdfDoc) {
        try {
          pdfDoc.destroy();
        } catch {}
        setPdfDoc(null);
      }
      setTotalPaginas(0);
      setPaginaAtual(1);
      setErro(null);
      setLoading(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      if (pdfDoc) {
        try {
          pdfDoc.destroy();
        } catch {}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-[96vw] w-full p-4 sm:p-6 max-h-[95vh] flex flex-col gap-3">
        {/* Barra superior de ações */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3 pr-6">
          <div className="flex items-center gap-2 max-w-[55%] sm:max-w-[65%] truncate">
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
            {isPdf && totalPaginas > 0 && (
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 whitespace-nowrap">
                Página {paginaAtual} de {totalPaginas}
              </Badge>
            )}

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

        {/* Área de Visualização com rolagem interna */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-[50vh] max-h-[82vh] overflow-y-auto rounded-lg bg-accent/10 border border-border/50 p-2 sm:p-4 flex flex-col items-center"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground my-auto">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Carregando arquivo...</p>
            </div>
          )}

          {!loading && erro && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center max-w-md px-4 my-auto">
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

          {!loading && !erro && (
            <>
              {isPdf && pdfDoc && (
                <div className="w-full flex flex-col items-center gap-3">
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pageNum) => (
                    <PaginaPdf
                      key={`${arquivo.caminho}-p${pageNum}`}
                      pdfDoc={pdfDoc}
                      pageNum={pageNum}
                      containerWidth={containerWidth}
                    />
                  ))}
                </div>
              )}

              {isImagem && !isPdf && blobUrl && (
                <div className="w-full h-full max-h-[80vh] flex items-center justify-center p-2 my-auto">
                  <img
                    src={blobUrl}
                    alt={arquivo.nome}
                    className="max-h-[80vh] max-w-full object-contain rounded-md shadow-xs"
                  />
                </div>
              )}

              {!isPdf && !isImagem && blobUrl && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center max-w-md my-auto">
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
