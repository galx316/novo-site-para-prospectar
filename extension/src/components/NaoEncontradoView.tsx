import React from 'react';
import type { ConversaInfo } from '../types';
import { showToast } from './Toast';

interface NaoEncontradoViewProps {
  conversa: ConversaInfo;
  onAbrirVincular: () => void;
}

export function NaoEncontradoView({ conversa, onAbrirVincular }: NaoEncontradoViewProps) {
  async function handleNovoProspect() {
    try {
      const res = await chrome.storage.local.get('crm_url');
      const crmUrl = ((res?.crm_url as string) || '').trim().replace(/\/+$/, '');

      if (!crmUrl) {
        showToast('Configure o Endereço do site nas Opções antes de abrir o CRM.', 'erro');
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
        return;
      }

      const params = new URLSearchParams();
      params.set('novo', '1');
      if (conversa.numero) {
        params.set('whatsapp', conversa.numero);
      }
      if (conversa.titulo) {
        params.set('nome', conversa.titulo);
      }

      const urlFinal = `${crmUrl}/prospeccao?${params.toString()}`;
      chrome.tabs.create({ url: urlFinal });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao abrir CRM.', 'erro');
    }
  }

  return (
    <div className="nao-encontrado-container">
      <div className="card-conversa-header">
        <div className="avatar-placeholder">
          {conversa.titulo ? conversa.titulo.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="conversa-meta">
          <h3 className="conversa-titulo">{conversa.titulo || 'Conversa sem título'}</h3>
          {conversa.numero ? (
            <p className="conversa-numero">WhatsApp: {conversa.numero}</p>
          ) : (
            <p className="conversa-numero-vazio">Número não detectado</p>
          )}
          {conversa.ultimaMensagem && (
            <p className="conversa-ultima-msg">
              Última mensagem: {conversa.ultimaMensagem.direcao === 'recebida' ? 'recebida' : 'enviada'} às{' '}
              {conversa.ultimaMensagem.horario}
            </p>
          )}
        </div>
      </div>

      {!conversa.numero && (
        <div className="dica-painel-numero">
          <span className="dica-icon">💡</span>
          <span className="dica-texto">
            Clique no nome no topo da conversa para abrir os Dados do contato. O painel lê o número.
          </span>
        </div>
      )}

      <div className="alert-box alert-info">
        <span className="alert-icon">ℹ</span>
        <div>
          <strong>Contato não cadastrado</strong>
          <p>Esta conversa ainda não foi encontrada no banco do GAL Gestão.</p>
        </div>
      </div>

      <div className="acoes-nao-encontrado">
        <button className="btn-secondary btn-block" onClick={onAbrirVincular}>
          <span className="btn-icon">🔗</span>
          Vincular a contato existente
        </button>

        <button className="btn-primary btn-block" onClick={handleNovoProspect}>
          <span className="btn-icon">➕</span>
          Novo prospect no CRM
        </button>
      </div>
    </div>
  );
}
