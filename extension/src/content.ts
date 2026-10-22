/**
 * Content Script (web.whatsapp.com) - Apenas Leitura
 *
 * REGRAS CRÍTICAS:
 * - NUNCA envia mensagem
 * - NUNCA abre conversa sozinha
 * - NUNCA clica em nada do WhatsApp
 * - NUNCA lê conversas que não estão abertas (não lê #pane-side ou lista de conversas)
 * - NUNCA usa bibliotecas de automação
 */

import type { ConversaInfo, UltimaMensagemInfo } from './types';

function soDigitos(str: string): string {
  return str.replace(/\D/g, '');
}

// Cache em memória de números salvos vinculados a títulos
const numerosSalvosCache = new Map<string, string>();

function obterNumeroSalvo(titulo: string): string | null {
  if (!titulo) return null;
  return numerosSalvosCache.get(titulo) || null;
}

function sincronizarNumeroStorage(titulo: string) {
  if (!titulo || numerosSalvosCache.has(titulo)) return;
  try {
    const chave = `numero_${titulo}`;
    chrome.storage.local.get(chave, (res) => {
      if (res && res[chave]) {
        numerosSalvosCache.set(titulo, String(res[chave]));
      }
    });
  } catch {}
}

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      for (const key of Object.keys(changes)) {
        if (key.startsWith('numero_')) {
          const tit = key.slice('numero_'.length);
          if (!changes[key]?.newValue) {
            numerosSalvosCache.delete(tit);
          } else {
            numerosSalvosCache.set(tit, String(changes[key].newValue));
          }
        }
      }
    }
  });
} catch {}

function encontrarPainelDadosContato(tituloConversa: string): HTMLElement | null {
  const tituloLimpo = (tituloConversa || '').trim().toLowerCase();
  if (!tituloLimpo) return null;

  function painelValido(el: HTMLElement | null): boolean {
    if (!el) return false;
    const txt = (el.innerText || '').toLowerCase();
    if (!txt.trim()) return false;
    // 2. Só aceite o painel se o texto dele contiver o título da conversa aberta (o mesmo nome do cabeçalho)
    return txt.includes(tituloLimpo);
  }

  // 1. Seletores conhecidos do drawer direito do WhatsApp Web
  const seletores = [
    '[data-testid="contact-info-drawer"]',
    '[data-testid="drawer-right"]',
    '[data-testid="chat-info-drawer"]',
  ];
  for (const sel of seletores) {
    const el = document.querySelector<HTMLElement>(sel);
    if (painelValido(el)) return el;
  }

  // 2. Busca por textos "Dados do contato" / "Contact info" / "Dados da empresa" / "Business details" fora de #main e #pane-side
  const possiveis = document.querySelectorAll<HTMLElement>(
    'section, aside, div[role="region"], div[tabindex="-1"]'
  );
  for (const el of possiveis) {
    if (el.closest('#main') || el.closest('#pane-side')) continue;
    const txt = (el.innerText || '').toLowerCase();
    const contemCabecalho =
      txt.includes('dados do contato') ||
      txt.includes('contact info') ||
      txt.includes('dados da empresa') ||
      txt.includes('business details');

    if (contemCabecalho && painelValido(el)) {
      return el;
    }
  }

  return null;
}

function extrairNumeroDadosContato(tituloConversa: string): string | null {
  const painel = encontrarPainelDadosContato(tituloConversa);
  if (!painel) return null;

  // 3. Aceita só telefone que comece com "+" (o WhatsApp mostra assim, ex.: "+55 11 98765-4321")
  const regexTelefone = /\+\s*\d{1,3}\s*(?:\(?\d{2,3}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/;

  const telefonesEncontrados = new Set<string>();

  // 1. Procurar somente em elementos folhas (spans, divs, p) com pouco texto
  const elementos = painel.querySelectorAll<HTMLElement>('span, div, p');
  for (const el of elementos) {
    if (el.children.length > 1) continue;
    const txtBruto = el.innerText?.trim();
    if (!txtBruto) continue;
    const txt = txtBruto.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
    if (!txt.includes('+')) continue;
    if ((txt.match(/\d/g) || []).length < 8) continue;

    const match = txt.match(regexTelefone);
    if (match) {
      const digitos = soDigitos(match[0]);
      if (digitos.length >= 10 && digitos.length <= 15) {
        telefonesEncontrados.add(digitos);
      }
    }
  }

  // 4. Se o painel tiver mais de um telefone diferente (ou nenhum), não escolha nenhum (retorne null)
  if (telefonesEncontrados.size === 1) {
    return Array.from(telefonesEncontrados)[0]!;
  }

  return null;
}

function ehTelefone(titulo: string): boolean {
  const limpo = titulo.trim();
  // Se contiver qualquer caractere alfabético, não é telefone
  if (/[a-zA-ZÀ-ÿ]/.test(limpo)) {
    return false;
  }
  const digitos = soDigitos(limpo);
  return digitos.length >= 8;
}

function extrairConversa(): ConversaInfo {
  try {
    const main = document.querySelector<HTMLElement>('#main');
    if (!main) {
      return { aberta: false };
    }

    const header = main.querySelector<HTMLElement>('header');
    if (!header) {
      return { aberta: true, erro: 'nao_identificado' };
    }

    // a) Título do cabeçalho (nome ou número)
    let titulo: string | null = null;
    const seletoresTitulo = [
      'div[role="button"] span[title]',
      'span[title]',
      '[data-testid="conversation-info-header-chat-title"]',
      'h2',
    ];

    for (const sel of seletoresTitulo) {
      const el = header.querySelector<HTMLElement>(sel);
      if (el) {
        const val = el.getAttribute('title') || el.innerText;
        if (val && val.trim()) {
          titulo = val.trim();
          break;
        }
      }
    }

    if (!titulo) {
      // Tentar span com dir="auto" com texto relevante
      const spans = header.querySelectorAll<HTMLElement>('span[dir="auto"]');
      for (const span of spans) {
        const txt = span.innerText?.trim();
        if (
          txt &&
          txt.length > 0 &&
          !txt.toLowerCase().includes('online') &&
          !txt.toLowerCase().includes('visto por último') &&
          !txt.toLowerCase().includes('clique aqui') &&
          !txt.toLowerCase().includes('digitando')
        ) {
          titulo = txt;
          break;
        }
      }
    }

    if (!titulo) {
      return { aberta: true, erro: 'nao_identificado' };
    }

    // Verificar se a conversa aberta é de grupo (@g.us)
    const ehGrupo = !!main.querySelector('[data-id*="@g.us"]');

    // b) Número e Origem do Número:
    // Ordem de tentativa: título → data-id "@c.us" → Dados do contato → vínculo salvo
    let numero: string | null = null;
    let origemNumero: 'titulo' | 'data_id' | 'dados_contato' | null = null;

    // 1. Título
    if (ehTelefone(titulo)) {
      numero = soDigitos(titulo);
      origemNumero = 'titulo';
    }

    // 2. data-id "@c.us" nas mensagens da conversa aberta (não grupo)
    if (!numero && !ehGrupo) {
      const msgsComDataId = main.querySelectorAll<HTMLElement>('[data-id*="@c.us"]');
      for (const el of msgsComDataId) {
        const dataId = el.getAttribute('data-id') || '';
        // data-id pode vir como: false_5511999999999@c.us_3EB... ou true_5511999999999@c.us_...
        const match = dataId.match(/(?:^|[_\s])(\d{8,15})@c\.us/);
        if (match && match[1]) {
          numero = match[1];
          origemNumero = 'data_id';
          break;
        }
      }
    }

    // 3. Dados do contato (painel lateral direito quando aberto pelo usuário)
    if (!numero && titulo) {
      const numDadosContato = extrairNumeroDadosContato(titulo);
      if (numDadosContato) {
        numero = numDadosContato;
        origemNumero = 'dados_contato';
      }
    }

    // 4. Vínculo salvo (chrome.storage.local)
    if (!numero && titulo) {
      const salvo = obterNumeroSalvo(titulo);
      if (salvo) {
        numero = salvo;
        origemNumero = 'dados_contato';
      } else {
        sincronizarNumeroStorage(titulo);
      }
    }

    // c) Direção e horário da ÚLTIMA mensagem da conversa aberta (recebida ou enviada).
    // Use as classes "message-in" / "message-out" se existirem.
    let ultimaMensagem: UltimaMensagemInfo | null = null;
    const msgs = main.querySelectorAll<HTMLElement>('.message-in, .message-out');
    if (msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1]!;
      const direcao = lastMsg.classList.contains('message-in') ? 'recebida' : 'enviada';

      let horario = '';
      let timestamp: number | null = null;
      let rawDateStr: string | undefined = undefined;

      // WhatsApp Web costuma ter elemento com data-pre-plain-text="[14:32, 19/10/2026] Nome: "
      const copyable = lastMsg.querySelector<HTMLElement>('[data-pre-plain-text]');
      const preText = copyable?.getAttribute('data-pre-plain-text') || '';
      if (preText) {
        const matchTime = preText.match(/\[(\d{1,2}:\d{2}(?:\s?[APMapm]{2})?)/);
        if (matchTime && matchTime[1]) {
          horario = matchTime[1];
        }

        const matchCompleto = preText.match(/\[([^\]]+)\]/);
        if (matchCompleto && matchCompleto[1]) {
          rawDateStr = matchCompleto[1];
          const partes = rawDateStr.split(',');
          if (partes.length === 2) {
            const hPart = partes[0]!.trim();
            const dPart = partes[1]!.trim();
            const [d, m, y] = dPart.split('/').map(Number);
            if (d && m && y) {
              const [h, min] = hPart.split(':').map(Number);
              const dataObj = new Date(y, m - 1, d, h || 0, min || 0);
              if (!isNaN(dataObj.getTime())) {
                timestamp = dataObj.getTime();
              }
            }
          }
        }
      }

      if (!horario) {
        const timeEl = lastMsg.querySelector<HTMLElement>('div[data-testid="msg-meta"] span, span[dir="auto"]');
        if (timeEl && /\d{1,2}:\d{2}/.test(timeEl.innerText || '')) {
          horario = timeEl.innerText.trim();
        }
      }

      ultimaMensagem = {
        direcao,
        horario: horario || 'recente',
        timestamp,
        rawDateStr,
      };
    }

    return {
      aberta: true,
      titulo,
      numero,
      origemNumero,
      ultimaMensagem,
    };
  } catch {
    // Se o seletor quebrar, não lance erro: envie { erro: "nao_identificado" }
    return {
      aberta: true,
      erro: 'nao_identificado',
    };
  }
}

// Controle de envio para o runtime
let ultimoPayloadJson = '';
let debounceTimer: any = null;

function notificarPainel() {
  const dados = extrairConversa();
  const json = JSON.stringify(dados);
  if (json !== ultimoPayloadJson) {
    ultimoPayloadJson = json;
    try {
      chrome.runtime
        .sendMessage({
          type: 'CONVERSA_ATUALIZADA',
          payload: dados,
        })
        .catch(() => {
          // O painel lateral pode não estar aberto, comportamento normal
        });
    } catch {
      // Ignora erro se a extensão for recarregada
    }
  }
}

// MutationObserver estrito apenas no corpo para capturar mudanças da conversa
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notificarPainel, 250);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
});

// Listener para quando o side panel solicitar o estado atual imediatamente ao abrir
chrome.runtime.onMessage.addListener((mensagem, _sender, sendResponse) => {
  if (mensagem?.type === 'GET_CONVERSA_ATUAL') {
    const dados = extrairConversa();
    sendResponse(dados);
  }
  return true;
});

// Primeira checagem
setTimeout(notificarPainel, 1000);
