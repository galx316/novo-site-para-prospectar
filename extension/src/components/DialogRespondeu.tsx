import React, { useState } from 'react';
import { supabase } from '../supabase';
import { adicionarDiasSP, formatarData, obterHojeSP } from '../date-utils';
import type { Oportunidade, SituacaoResposta } from '../types';
import { showToast } from './Toast';

interface DialogRespondeuProps {
  contatoId: string;
  contatoNome: string;
  oportunidades: Oportunidade[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DialogRespondeu({
  contatoId,
  contatoNome,
  oportunidades,
  onClose,
  onSuccess,
}: DialogRespondeuProps) {
  const oportunidadesValidas = oportunidades.filter(
    (op) => !op.contato_id || op.contato_id === contatoId
  );

  const [oportunidadeId, setOportunidadeId] = useState<string>(
    oportunidadesValidas.length === 1 ? oportunidadesValidas[0]!.id : ''
  );

  const [situacao, setSituacao] = useState<SituacaoResposta>('tem_demanda');
  const [mesAnoNecessidade, setMesAnoNecessidade] = useState(''); // YYYY-MM
  const [nomeRepresentante, setNomeRepresentante] = useState('');
  const [dataFalarDepois, setDataFalarDepois] = useState(adicionarDiasSP(15));
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);

  const situacoes: Array<{
    key: SituacaoResposta;
    titulo: string;
    subtitulo: string;
  }> = [
    {
      key: 'tem_demanda',
      titulo: 'Tem demanda agora',
      subtitulo: 'Avança para orçamento e agenda follow-up em 2 dias',
    },
    {
      key: 'demanda_prevista',
      titulo: 'Demanda prevista em mês/ano',
      subtitulo: 'Agenda acompanhamento antecipado para a obra',
    },
    {
      key: 'sem_demanda',
      titulo: 'Sem demanda no momento',
      subtitulo: 'Aguardando demanda e pausa por 60 dias',
    },
    {
      key: 'atendido_outro_rep_prado',
      titulo: 'Atendido por outro representante PRADO',
      subtitulo: 'Atualiza selo com o nome do representante',
    },
    {
      key: 'falar_depois',
      titulo: 'Pediu para falar depois',
      subtitulo: 'Escolha a data combinada para o próximo contato',
    },
    {
      key: 'sem_interesse',
      titulo: 'Sem interesse',
      subtitulo: 'Marca oportunidade como perdida e encerra follow-ups',
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (situacao === 'demanda_prevista' && !mesAnoNecessidade) {
      showToast('Informe o mês e ano da demanda prevista.', 'erro');
      return;
    }

    if (situacao === 'atendido_outro_rep_prado' && !nomeRepresentante.trim()) {
      showToast('Informe o nome do outro representante PRADO.', 'erro');
      return;
    }

    if (situacao === 'falar_depois' && !dataFalarDepois) {
      showToast('Informe a data para falar depois.', 'erro');
      return;
    }

    setCarregando(true);
    try {
      const opFinal =
        oportunidadesValidas.length === 1
          ? oportunidadesValidas[0]!.id
          : oportunidadeId || undefined;

      const necessidadeFormatada =
        situacao === 'demanda_prevista' && mesAnoNecessidade
          ? `${mesAnoNecessidade}-01`
          : undefined;

      const { error: rpcErr } = await supabase.rpc('registrar_resposta', {
        p_contato_id: contatoId,
        p_canal: 'whatsapp',
        p_situacao: situacao,
        ...(opFinal ? { p_oportunidade_id: opFinal } : {}),
        ...(necessidadeFormatada ? { p_necessidade: necessidadeFormatada } : {}),
        ...(situacao === 'falar_depois' && dataFalarDepois ? { p_data_proxima: dataFalarDepois } : {}),
        ...(situacao === 'atendido_outro_rep_prado' && nomeRepresentante.trim()
          ? { p_representante: nomeRepresentante.trim() }
          : {}),
        ...(texto.trim() ? { p_texto: texto.trim() } : {}),
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      showToast('Resposta registrada com sucesso!');
      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao registrar resposta.', 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Registrar Resposta do Cliente</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={carregando}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-subtitle">
            Cliente <strong>{contatoNome}</strong> respondeu pelo WhatsApp.
          </p>

          {oportunidadesValidas.length > 1 && (
            <div className="form-group">
              <label htmlFor="resp-op">Oportunidade</label>
              <select
                id="resp-op"
                value={oportunidadeId}
                onChange={(e) => setOportunidadeId(e.target.value)}
              >
                <option value="">Selecione a oportunidade...</option>
                {oportunidadesValidas.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.marcas?.map((m) => m.nome).join(', ') || op.descricao || 'Oportunidade'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Qual foi a resposta?</label>
            <div className="opcoes-situacao">
              {situacoes.map((item) => {
                const ativo = situacao === item.key;
                return (
                  <div
                    key={item.key}
                    className={`opcao-card ${ativo ? 'selected' : ''}`}
                    onClick={() => setSituacao(item.key)}
                  >
                    <input
                      type="radio"
                      name="situacao"
                      checked={ativo}
                      onChange={() => setSituacao(item.key)}
                    />
                    <div className="opcao-info">
                      <div className="opcao-titulo">{item.titulo}</div>
                      <div className="opcao-sub">{item.subtitulo}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campo extra: demanda prevista (mês e ano) */}
          {situacao === 'demanda_prevista' && (
            <div className="form-group alert-box alert-extra-field">
              <label htmlFor="resp-mesano">Mês e Ano da Previsão (YYYY-MM)</label>
              <input
                id="resp-mesano"
                type="month"
                value={mesAnoNecessidade}
                onChange={(e) => setMesAnoNecessidade(e.target.value)}
                required
              />
              <span className="field-hint">O CRM agendará o acompanhamento para 60 dias antes.</span>
            </div>
          )}

          {/* Campo extra: atendido outro representante PRADO */}
          {situacao === 'atendido_outro_rep_prado' && (
            <div className="form-group alert-box alert-extra-field">
              <label htmlFor="resp-rep">Nome do Representante PRADO</label>
              <input
                id="resp-rep"
                type="text"
                value={nomeRepresentante}
                onChange={(e) => setNomeRepresentante(e.target.value)}
                placeholder="Ex: João Silva ou Empresa Parceira"
                required
              />
            </div>
          )}

          {/* Campo extra: falar depois */}
          {situacao === 'falar_depois' && (
            <div className="form-group alert-box alert-extra-field">
              <label htmlFor="resp-data">Data combinada para retorno</label>
              <input
                id="resp-data"
                type="date"
                min={obterHojeSP()}
                value={dataFalarDepois}
                onChange={(e) => setDataFalarDepois(e.target.value)}
                required
              />
              <span className="field-hint">Agendando para: {formatarData(dataFalarDepois)}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="resp-texto">Observações da conversa (opcional)</label>
            <textarea
              id="resp-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Cliente disse que a obra inicia em outubro e vai cotar..."
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Confirmar Resposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
