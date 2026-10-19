import React, { useState } from 'react';
import type { DadosContatoPainel, ConversaInfo } from '../types';
import { formatarData, formatarDataHora, statusData } from '../date-utils';
import { SeloPrado } from './SeloPrado';
import { DialogEnviei } from './DialogEnviei';
import { DialogRespondeu } from './DialogRespondeu';
import { DialogFollowup } from './DialogFollowup';
import { DialogAtividade } from './DialogAtividade';
import { showToast } from './Toast';

interface ContatoViewProps {
  dados: DadosContatoPainel;
  conversa: ConversaInfo;
  atalhosDias?: number[];
  onAtualizar: () => void;
}

const ETAPA_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção',
  aguardando_demanda: 'Aguardando demanda',
  demanda_prevista: 'Demanda prevista',
  orcamento: 'Orçamento',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

const TIPO_REGISTRO_LABELS: Record<string, { label: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  ligacao: { label: 'Ligação', icon: '📞' },
  visita: { label: 'Visita', icon: '🚗' },
  nota: { label: 'Nota', icon: '📝' },
  email: { label: 'E-mail', icon: '✉️' },
  outro: { label: 'Outro', icon: '📌' },
  ata: { label: 'Ata', icon: '📋' },
  cronograma: { label: 'Cronograma', icon: '⏱️' },
  medicao: { label: 'Medição', icon: '📏' },
  problema: { label: 'Problema', icon: '⚠️' },
};

export function ContatoView({ dados, conversa, atalhosDias = [3, 7, 15, 30], onAtualizar }: ContatoViewProps) {
  const [modalEnvieiAberto, setModalEnvieiAberto] = useState(false);
  const [modalRespondeuAberto, setModalRespondeuAberto] = useState(false);
  const [modalFollowupAberto, setModalFollowupAberto] = useState(false);
  const [modalAtividadeAberto, setModalAtividadeAberto] = useState(false);

  const { contato, cliente, oportunidades, followup_pendente, ultimos_registros, aviso_resposta_pendente } = dados;

  async function handleAbrirCRM() {
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

      const urlCliente = `${crmUrl}/prospeccao/${cliente.id}`;
      chrome.tabs.create({ url: urlCliente });
    } catch (e: any) {
      showToast(e?.message || 'Erro ao abrir CRM.', 'erro');
    }
  }

  // Filtrar oportunidades abertas da construtora (não fechadas/perdidas)
  const oportunidadesAbertas = (oportunidades || []).filter(
    (op) => op.etapa !== 'fechado' && op.etapa !== 'perdido'
  );

  const statusFollowup = followup_pendente ? statusData(followup_pendente.data) : 'nenhum';

  return (
    <div className="contato-view-container">
      {/* Aviso amarelo: Chegou resposta depois do seu último envio */}
      {aviso_resposta_pendente && (
        <div className="aviso-resposta-amarelo">
          <span className="aviso-icon">⚠️</span>
          <div className="aviso-content">
            <strong>Chegou resposta depois do seu último envio</strong>
            <p>
              O cliente enviou mensagem às{' '}
              {conversa.ultimaMensagem?.horario || 'recente'}. Verifique e registre a resposta.
            </p>
          </div>
        </div>
      )}

      {/* Cartão da Construtora e Contato */}
      <div className="card-secao">
        <div className="secao-header">
          <div>
            <span className="label-secao">Construtora</span>
            <h2 className="titulo-construtora">{cliente.nome}</h2>
            {cliente.cidade && (
              <span className="subtitulo-cidade">
                {cliente.cidade}
                {cliente.uf ? `/${cliente.uf}` : ''}
              </span>
            )}
          </div>
          <SeloPrado situacao={cliente.situacao_prado} representante={cliente.representante_prado} />
        </div>

        <div className="contato-detalhes">
          <div className="avatar-contato">
            {contato.nome.charAt(0).toUpperCase()}
          </div>
          <div className="contato-info">
            <h3 className="contato-nome">{contato.nome}</h3>
            {contato.cargo && <span className="contato-cargo">{contato.cargo}</span>}
            {contato.whatsapp && <span className="contato-wa">WA: {contato.whatsapp}</span>}
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas */}
      <div className="botoes-acao-grid">
        <button
          className="btn-acao btn-enviei"
          onClick={() => setModalEnvieiAberto(true)}
          title="Registrar envio de apresentação"
        >
          <span className="btn-acao-icon">📤</span>
          <span className="btn-acao-label">Enviei</span>
        </button>

        <button
          className="btn-acao btn-respondeu"
          onClick={() => setModalRespondeuAberto(true)}
          title="Registrar retorno/resposta do cliente"
        >
          <span className="btn-acao-icon">💬</span>
          <span className="btn-acao-label">Respondeu</span>
        </button>

        <button
          className="btn-acao btn-followup"
          onClick={() => setModalFollowupAberto(true)}
          title={followup_pendente ? 'Remarcar próximo contato' : 'Agendar próximo contato'}
        >
          <span className="btn-acao-icon">📅</span>
          <span className="btn-acao-label">{followup_pendente ? 'Remarcar' : '+ Follow-up'}</span>
        </button>

        <button
          className="btn-acao btn-atividade"
          onClick={() => setModalAtividadeAberto(true)}
          title="Registrar ligação, visita, nota ou outro"
        >
          <span className="btn-acao-icon">📝</span>
          <span className="btn-acao-label">Atividade</span>
        </button>
      </div>

      <div className="abrir-crm-wrapper">
        <button className="btn-abrir-crm" onClick={handleAbrirCRM}>
          <span>Abrir construtora no CRM</span>
          <span className="external-icon">↗</span>
        </button>
      </div>

      {/* Próximo Follow-up Pendente */}
      <div className="card-secao">
        <div className="secao-titulo-row">
          <span className="secao-titulo">Próximo Follow-up</span>
          {followup_pendente && (
            <span className={`badge-status badge-status-${statusFollowup}`}>
              {statusFollowup === 'hoje'
                ? 'Hoje'
                : statusFollowup === 'atrasado'
                  ? 'Atrasado'
                  : 'Agendado'}
            </span>
          )}
        </div>

        {followup_pendente ? (
          <div className="followup-destaque">
            <div className="followup-data">
              <span className="calendar-icon">📅</span>
              <strong>{formatarData(followup_pendente.data)}</strong>
            </div>
            <p className="followup-motivo">{followup_pendente.motivo || 'Sem motivo especificado'}</p>
          </div>
        ) : (
          <div className="vazio-suave">Nenhum follow-up pendente para este contato.</div>
        )}
      </div>

      {/* Oportunidades Abertas da Construtora */}
      <div className="card-secao">
        <div className="secao-titulo-row">
          <span className="secao-titulo">Oportunidades em Aberto</span>
          <span className="contador-badge">{oportunidadesAbertas.length}</span>
        </div>

        {oportunidadesAbertas.length > 0 ? (
          <div className="lista-oportunidades">
            {oportunidadesAbertas.map((op) => (
              <div key={op.id} className="item-oportunidade">
                <div className="op-marcas">
                  {op.marcas && op.marcas.length > 0 ? (
                    op.marcas.map((m) => (
                      <span key={m.id} className="badge-marca">
                        {m.nome}
                      </span>
                    ))
                  ) : (
                    <span className="badge-marca">{op.descricao || 'Oportunidade'}</span>
                  )}
                </div>
                <div className="op-etapa">
                  <span className={`badge-etapa etapa-${op.etapa}`}>
                    {ETAPA_LABELS[op.etapa] || op.etapa}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="vazio-suave">Nenhuma oportunidade ativa no momento.</div>
        )}
      </div>

      {/* Últimos 5 Registros */}
      <div className="card-secao">
        <div className="secao-titulo-row">
          <span className="secao-titulo">Últimos Registros</span>
          <span className="contador-badge">{ultimos_registros.length}</span>
        </div>

        {ultimos_registros.length > 0 ? (
          <div className="timeline-registros">
            {ultimos_registros.map((reg) => {
              const tipoConf = TIPO_REGISTRO_LABELS[reg.tipo] || {
                label: reg.tipo,
                icon: '📌',
              };
              return (
                <div key={reg.id} className="item-timeline">
                  <div className="timeline-dot"></div>
                  <div className="timeline-body">
                    <div className="timeline-header">
                      <span className="badge-tipo-reg">
                        <span className="reg-icon">{tipoConf.icon}</span>
                        {tipoConf.label}
                        {reg.direcao && reg.direcao !== 'nenhuma' && (
                          <span className="reg-dir"> • {reg.direcao}</span>
                        )}
                      </span>
                      <span className="timeline-data">
                        {formatarDataHora(reg.created_at || reg.data)}
                      </span>
                    </div>
                    {reg.texto && <p className="timeline-texto">{reg.texto}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="vazio-suave">Nenhum registro histórico deste contato.</div>
        )}
      </div>

      {/* Modais de Ação */}
      {modalEnvieiAberto && (
        <DialogEnviei
          contatoId={contato.id}
          contatoNome={contato.nome}
          oportunidades={oportunidades}
          atalhosDias={atalhosDias}
          onClose={() => setModalEnvieiAberto(false)}
          onSuccess={() => {
            setModalEnvieiAberto(false);
            onAtualizar();
          }}
        />
      )}

      {modalRespondeuAberto && (
        <DialogRespondeu
          contatoId={contato.id}
          contatoNome={contato.nome}
          oportunidades={oportunidades}
          onClose={() => setModalRespondeuAberto(false)}
          onSuccess={() => {
            setModalRespondeuAberto(false);
            onAtualizar();
          }}
        />
      )}

      {modalFollowupAberto && (
        <DialogFollowup
          contatoId={contato.id}
          clienteId={cliente.id}
          contatoNome={contato.nome}
          followupPendente={followup_pendente}
          atalhosDias={atalhosDias}
          onClose={() => setModalFollowupAberto(false)}
          onSuccess={() => {
            setModalFollowupAberto(false);
            onAtualizar();
          }}
        />
      )}

      {modalAtividadeAberto && (
        <DialogAtividade
          contatoId={contato.id}
          clienteId={cliente.id}
          contatoNome={contato.nome}
          onClose={() => setModalAtividadeAberto(false)}
          onSuccess={() => {
            setModalAtividadeAberto(false);
            onAtualizar();
          }}
        />
      )}
    </div>
  );
}
