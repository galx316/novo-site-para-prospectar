import { toast } from 'sonner';

/**
 * Abre arquivo de forma segura em nova aba sem ser bloqueado pelo bloqueador de pop-ups do navegador.
 *
 * Abre a janela de forma síncrona no contexto do clique do usuário;
 * se o navegador bloquear, exibe toast persistente (15s) com ação para o usuário abrir manualmente.
 */
export async function abrirArquivoSeguro(
  obterUrl: () => Promise<string>
): Promise<void> {
  // a) No início, ainda síncrono no clique
  let aba: Window | null = null;
  try {
    aba = window.open('', '_blank');
    if (aba) {
      aba.opener = null;
      try {
        aba.document.write(
          '<!DOCTYPE html><html><head><title>Carregando arquivo...</title><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155;}</style></head><body><p>Carregando arquivo...</p></body></html>'
        );
      } catch {
        // Fallback silencioso se document.write sofrer restrição
      }
    }
  } catch {
    aba = null;
  }

  try {
    // b) Busque a URL
    const url = await obterUrl();

    if (!url) {
      throw new Error('URL do arquivo não retornada pelo servidor.');
    }

    // c) Se aba existir e não estiver fechada
    if (aba && !aba.closed) {
      aba.location.href = url;
    } else {
      // d) Se aba for null (bloqueada): toast com ação "Abrir arquivo" (15s)
      toast('Pop-up bloqueado pelo navegador.', {
        description: 'Clique abaixo para abrir o arquivo.',
        duration: 15000,
        action: {
          label: 'Abrir arquivo',
          onClick: () => {
            window.open(url, '_blank', 'noopener,noreferrer');
          },
        },
      });
    }
  } catch (err: any) {
    // e) Se der erro ao buscar a URL: feche a aba aberta (se existir) e mostre toast de erro
    if (aba && !aba.closed) {
      try {
        aba.close();
      } catch {
        // Ignora erro ao fechar aba
      }
    }
    toast.error(err?.message || 'Erro ao carregar arquivo.');
  }
}
