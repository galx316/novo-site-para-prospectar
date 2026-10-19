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

    // b) Número: se o título for um telefone, use os dígitos.
    // Senão, procure nas mensagens da conversa aberta um atributo data-id que contenha "@c.us"
    // e extraia os dígitos antes de "@c.us". Ignore conversas de grupo ("@g.us").
    // Se não achar número, envie só o título.
    let numero: string | null = null;
    if (ehTelefone(titulo)) {
      numero = soDigitos(titulo);
    } else if (!ehGrupo) {
      const msgsComDataId = main.querySelectorAll<HTMLElement>('[data-id*="@c.us"]');
      for (const el of msgsComDataId) {
        const dataId = el.getAttribute('data-id') || '';
        // data-id pode vir como: false_5511999999999@c.us_3EB... ou true_5511999999999@c.us_...
        const match = dataId.match(/(?:^|[_\s])(\d{8,15})@c\.us/);
        if (match && match[1]) {
          numero = match[1];
          break;
        }
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
