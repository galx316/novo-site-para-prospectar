import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface GrupoCronogramaLido {
  rotulo: string; // 'Apto modelo' | '1ª entrega' | '2ª entrega'...
  data: string | null; // yyyy-mm-dd
  quantidade: number;
}

export interface CronogramaPradoLido {
  titulo: string | null;
  numero: string | null;
  entrada: string | null; // yyyy-mm-dd
  total: number | null;
  grupos: GrupoCronogramaLido[];
}

interface ItemTextoPdf {
  texto: string;
  x: number;
  y: number;
  page: number;
}

interface LinhaPdf {
  page: number;
  y: number;
  itens: ItemTextoPdf[];
}

function formatarDataISO(dataBR: string): string | null {
  const match = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, a] = match;
  return `${a}-${m}-${d}`;
}

export async function lerCronogramaPrado(arrayBuffer: ArrayBuffer): Promise<CronogramaPradoLido> {
  // Carrega pdfjs dinamicamente apenas no navegador
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });
  const pdfDoc = await loadingTask.promise;

  const todosItens: ItemTextoPdf[] = [];

  // 1. Extrai todos os itens de texto de todas as páginas
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string') {
        const texto = item.str.trim();
        if (texto) {
          todosItens.push({
            texto,
            x: item.transform[4],
            y: item.transform[5],
            page: p,
          });
        }
      }
    }
  }

  if (todosItens.length === 0) {
    throw new Error('O arquivo PDF não contém texto extraível.');
  }

  // 2. Agrupa itens em linhas por página (|y1 - y2| <= 2)
  const linhas: LinhaPdf[] = [];
  // Ordena por página, depois y decrescente (topo para base), depois x crescente
  todosItens.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 2) return b.y - a.y; // y maior fica mais acima no PDF
    return a.x - b.x;
  });

  for (const item of todosItens) {
    const ultimaLinha = linhas[linhas.length - 1];
    if (
      ultimaLinha &&
      ultimaLinha.page === item.page &&
      Math.abs(ultimaLinha.y - item.y) <= 2
    ) {
      ultimaLinha.itens.push(item);
    } else {
      linhas.push({
        page: item.page,
        y: item.y,
        itens: [item],
      });
    }
  }

  // 3. Em cada linha, mescla tokens quebrados comuns (ex: "1ª" + "ENT", "APTO." + "MOD", "QTDE." + "SALDO")
  for (const linha of linhas) {
    linha.itens.sort((a, b) => a.x - b.x);
    const novosItens: ItemTextoPdf[] = [];
    let i = 0;
    while (i < linha.itens.length) {
      const atual = linha.itens[i]!;
      const prox = linha.itens[i + 1];

      // Casos como "1" + "ª" + "ENT" ou "1ª" + "ENT"
      if (prox && /^\d+$/.test(atual.texto) && prox.texto === 'ª') {
        const prox2 = linha.itens[i + 2];
        if (prox2 && /^ENT/i.test(prox2.texto)) {
          novosItens.push({
            texto: `${atual.texto}ª ${prox2.texto}`.toUpperCase(),
            x: atual.x,
            y: atual.y,
            page: atual.page,
          });
          i += 3;
          continue;
        }
      }

      if (prox && /^(\d+)\s*ª$/i.test(atual.texto) && /^ENT/i.test(prox.texto)) {
        novosItens.push({
          texto: `${atual.texto} ${prox.texto}`.toUpperCase(),
          x: atual.x,
          y: atual.y,
          page: atual.page,
        });
        i += 2;
        continue;
      }

      // "APTO." + "MOD"
      if (prox && /^APTO\.?$/i.test(atual.texto) && /^MOD$/i.test(prox.texto)) {
        novosItens.push({
          texto: 'APTO.MOD',
          x: atual.x,
          y: atual.y,
          page: atual.page,
        });
        i += 2;
        continue;
      }

      // "QTDE." + "SALDO"
      if (prox && /^QTDE\.?$/i.test(atual.texto) && /^SALDO$/i.test(prox.texto)) {
        novosItens.push({
          texto: 'QTDE.SALDO',
          x: atual.x,
          y: atual.y,
          page: atual.page,
        });
        i += 2;
        continue;
      }

      novosItens.push(atual);
      i++;
    }
    linha.itens = novosItens;
  }

  // 4. Identificar Título, Número e Entrada
  let titulo: string | null = null;
  let numero: string | null = null;
  let entrada: string | null = null;

  for (const linha of linhas) {
    const textoLinha = linha.itens.map((it) => it.texto).join(' ');

    // Número (ex: "Nº 02559" ou "N° 02559" ou "No 02559")
    if (!numero) {
      const matchNum = textoLinha.match(/N[ºo°]?\s*(\d{3,})/i);
      if (matchNum) {
        numero = `Nº ${matchNum[1]}`;
      }
    }

    // Título (ex: "SOL CLUBE MAIA - MEDIÇÃO 2")
    if (!titulo) {
      if (/MEDIÇÃO|MEDICAO/i.test(textoLinha) && !/RELATÓRIO|SISTEMA|CRONOGRAMA/i.test(textoLinha)) {
        titulo = textoLinha.trim();
      }
    }

    // Entrada (ex: "- ENTRADA 10/08/2026")
    if (!entrada) {
      const matchEntrada = textoLinha.match(/ENTRADA\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (matchEntrada && matchEntrada[1]) {
        entrada = formatarDataISO(matchEntrada[1]);
      }
    }
  }

  // 5. Localizar cabeçalho da tabela de entregas
  // Procura linha que contenha cabeçalhos como "1ª ENT", "2ª ENT", etc.
  interface CabecalhoGrupo {
    rotulo: string;
    isEnt: boolean;
    x: number;
  }

  let linhaCabecalho: LinhaPdf | null = null;
  let cabecalhos: CabecalhoGrupo[] = [];

  for (const linha of linhas) {
    const gruposEncontrados: CabecalhoGrupo[] = [];

    for (const it of linha.itens) {
      const entMatch = it.texto.match(/^(\d+)\s*ª\s*ENT$/i);
      if (entMatch && entMatch[1]) {
        gruposEncontrados.push({
          rotulo: `${entMatch[1]}ª entrega`,
          isEnt: true,
          x: it.x,
        });
      } else if (/^APTO\.?MOD$/i.test(it.texto)) {
        gruposEncontrados.push({
          rotulo: 'Apto modelo',
          isEnt: false,
          x: it.x,
        });
      }
    }

    if (gruposEncontrados.length > 0) {
      linhaCabecalho = linha;
      cabecalhos = gruposEncontrados;
      break;
    }
  }

  // Regra j: Se não achar nenhum cabeçalho "ENT", lançar erro específico
  if (!linhaCabecalho || cabecalhos.filter((c) => c.isEnt).length === 0) {
    throw new Error('Arquivo fora do padrão do cronograma Prado. Preencha as entregas manualmente.');
  }

  // Ordena cabeçalhos de grupo por coordenada x crescente
  cabecalhos.sort((a, b) => a.x - b.x);

  // Faixa de cada grupo: [minX, maxX]
  // de (x do cabeçalho - 15) até (x do próximo cabeçalho - 15); o último vai até infinito
  const faixas = cabecalhos.map((c, idx) => {
    const minX = c.x - 15;
    const maxX = idx < cabecalhos.length - 1 ? cabecalhos[idx + 1]!.x - 15 : Infinity;
    return {
      grupo: c,
      minX,
      maxX,
    };
  });

  // 6. Data de cada grupo
  // Linha de datas logo ACIMA do cabeçalho (em PDF y maior fica mais em cima)
  const linhasAcimaCabecalho = linhas
    .filter((l) => l.page === linhaCabecalho!.page && l.y > linhaCabecalho!.y)
    .sort((a, b) => a.y - b.y); // Ordena das mais próximas do cabeçalho para as mais distantes acima

  const linhaDatas = linhasAcimaCabecalho.find((l) =>
    l.itens.some((it) => /\d{2}\/\d{2}\/\d{4}/.test(it.texto))
  );

  const datasPorGrupo: Record<string, string | null> = {};
  if (linhaDatas) {
    for (const faixa of faixas) {
      const itemData = linhaDatas.itens.find((it) => {
        const temData = /\d{2}\/\d{2}\/\d{4}/.test(it.texto);
        return temData && it.x >= faixa.minX && it.x < faixa.maxX;
      });

      if (itemData) {
        const m = itemData.texto.match(/(\d{2}\/\d{2}\/\d{4})/);
        datasPorGrupo[faixa.grupo.rotulo] = m && m[1] ? formatarDataISO(m[1]) : null;
      } else {
        datasPorGrupo[faixa.grupo.rotulo] = null;
      }
    }
  }

  // 7. Localizar linha de TOTAIS e Total (QTDE.SALDO)
  // A linha de totais é a última linha só com números inteiros antes de "CRONOGRAMA DAS ETAPAS"
  const linhaCronogramaEtapas = linhas.find(
    (l) =>
      l.page === linhaCabecalho!.page &&
      l.itens.some((it) => /CRONOGRAMA\s+DAS\s+ETAPAS/i.test(it.texto))
  );

  const yLimiteInferior = linhaCronogramaEtapas ? linhaCronogramaEtapas.y : -Infinity;

  // Linhas da tabela (abaixo do cabeçalho e acima de cronograma etapas)
  const linhasTabela = linhas.filter(
    (l) =>
      l.page === linhaCabecalho!.page &&
      l.y < linhaCabecalho!.y &&
      l.y > yLimiteInferior
  );

  // Procura x do cabeçalho "QTDE.SALDO"
  let xQtdeSaldo = linhaCabecalho.itens.find((it) => /QTDE\.?SALDO|SALDO/i.test(it.texto))?.x ?? 0;

  // Identifica a linha de totais (só números inteiros)
  // Percorre as linhas de baixo para cima (y crescente)
  let linhaTotais: LinhaPdf | null = null;
  const linhasOrdenadasBaixoParaCima = [...linhasTabela].sort((a, b) => a.y - b.y);

  for (const l of linhasOrdenadasBaixoParaCima) {
    if (l.itens.length >= 2 && l.itens.every((it) => /^\d+$/.test(it.texto))) {
      linhaTotais = l;
      break;
    }
  }

  const quantidadesPorGrupo: Record<string, number> = {};
  let total: number | null = null;

  if (linhaTotais) {
    // Quantidade de cada grupo pela linha de totais
    for (const faixa of faixas) {
      const itemNum = linhaTotais.itens.find(
        (it) => it.x >= faixa.minX && it.x < faixa.maxX
      );
      quantidadesPorGrupo[faixa.grupo.rotulo] = itemNum ? parseInt(itemNum.texto, 10) : 0;
    }

    // Total = número da coluna QTDE.SALDO
    if (xQtdeSaldo > 0) {
      // Pega o número da linha de totais mais próximo de xQtdeSaldo
      let maisProximo = linhaTotais.itens[0];
      let menorDist = Math.abs((maisProximo?.x ?? 0) - xQtdeSaldo);
      for (const it of linhaTotais.itens) {
        const dist = Math.abs(it.x - xQtdeSaldo);
        if (dist < menorDist) {
          menorDist = dist;
          maisProximo = it;
        }
      }
      if (maisProximo) {
        total = parseInt(maisProximo.texto, 10);
      }
    } else {
      // Se não encontrou xQtdeSaldo, usa o primeiro número da linha de totais
      total = linhaTotais.itens[0] ? parseInt(linhaTotais.itens[0].texto, 10) : null;
    }
  } else {
    // Fallback: soma os números de cada linha de item que caem na faixa
    for (const faixa of faixas) {
      let somaGrupo = 0;
      for (const l of linhasTabela) {
        // Se a linha começa com número de pedido (ex: >= 4 dígitos)
        const primeiroItem = l.itens[0];
        if (primeiroItem && /^\d{4,}$/.test(primeiroItem.texto)) {
          const itemNum = l.itens.find((it) => it.x >= faixa.minX && it.x < faixa.maxX);
          if (itemNum && /^\d+$/.test(itemNum.texto)) {
            somaGrupo += parseInt(itemNum.texto, 10);
          }
        }
      }
      quantidadesPorGrupo[faixa.grupo.rotulo] = somaGrupo;
    }

    // Total fallback pela soma da coluna saldo
    if (xQtdeSaldo > 0) {
      let somaSaldo = 0;
      for (const l of linhasTabela) {
        const itemSaldo = l.itens.find((it) => Math.abs(it.x - xQtdeSaldo) < 30);
        if (itemSaldo && /^\d+$/.test(itemSaldo.texto)) {
          somaSaldo += parseInt(itemSaldo.texto, 10);
        }
      }
      total = somaSaldo > 0 ? somaSaldo : null;
    }
  }

  // 8. Montar lista de grupos e remover os que tiverem quantidade 0 (Regra i)
  const grupos: GrupoCronogramaLido[] = faixas
    .map((faixa) => ({
      rotulo: faixa.grupo.rotulo,
      data: datasPorGrupo[faixa.grupo.rotulo] ?? null,
      quantidade: quantidadesPorGrupo[faixa.grupo.rotulo] ?? 0,
    }))
    .filter((g) => g.quantidade > 0);

  return {
    titulo,
    numero,
    entrada,
    total,
    grupos,
  };
}
