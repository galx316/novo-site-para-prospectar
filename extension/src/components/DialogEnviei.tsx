import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { adicionarDiasSP, formatarData, obterHojeSP } from '../date-utils';
import type { Oportunidade } from '../types';
import { showToast } from './Toast';

interface DialogEnvieiProps {
  contatoId: string;
  contatoNome: string;
  oportunidades: Oportunidade[];
  atalhosDias?: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DialogEnviei({
  contatoId,
  contatoNome,
  oportunidades,
  atalhosDias = [3, 7, 15, 30],
  onClose,
  onSuccess,
}: DialogEnvieiProps) {
  // Apenas oportunidades sem contato ou deste contato específico
  const oportunidadesValidas = oportunidades.filter(
    (op) => !op.contato_id || op.contato_id === contatoId
  );

  const [oportunidadeId, setOportunidadeId] = useState<string>(
    oportunidadesValidas.length === 1 ? oportunidadesValidas[0]!.id : ''
  );

  const primeiroAtalho = atalhosDias[0] || 5;
  const [dataProxima, setDataProxima] = useState<string>(adicionarDiasSP(primeiroAtalho));
  const [motivo, setMotivo] = useState('');
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);

    try {
      const opFinal =
        oportunidadesValidas.length === 1
          ? oportunidadesValidas[0]!.id
          : oportunidadeId || undefined;

      const { error: rpcErr } = await supabase.rpc('registrar_envio', {
        p_contato_id: contatoId,
        p_canal: 'whatsapp',
        ...(opFinal ? { p_oportunidade_id: opFinal } : {}),
        ...(dataProxima ? { p_data_proxima: dataProxima } : {}),
        ...(texto.trim() ? { p_texto: texto.trim() } : {}),
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      // Se houver motivo: update em followups set motivo where contato_id, origem 'prospeccao', status 'pendente'
      const motivoTrim = motivo.trim();
      if (motivoTrim) {
        const { error: fErr } = await supabase
          .from('followups')
          .update({ motivo: motivoTrim })
          .eq('contato_id', contatoId)
          .eq('origem', 'prospeccao')
          .eq('status', 'pendente');

        if (fErr) console.error('Erro ao atualizar motivo do follow-up:', fErr);
      }

      showToast('Envio de apresentação registrado!');
      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao registrar envio.', 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Registrar Envio (WhatsApp)</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={carregando}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-subtitle">
            Registrar envio de apresentação para <strong>{contatoNome}</strong> via WhatsApp.
          </p>

          {oportunidadesValidas.length > 1 && (
            <div className="form-group">
              <label htmlFor="envio-op">Oportunidade</label>
              <select
                id="envio-op"
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
            <label>Próximo follow-up</label>
            <div className="atalhos-container">
              {atalhosDias.map((dias) => {
                const dataCalc = adicionarDiasSP(dias);
                const selecionado = dataProxima === dataCalc;
                return (
                  <button
                    key={dias}
                    type="button"
                    className={`btn-atalho ${selecionado ? 'active' : ''}`}
                    onClick={() => setDataProxima(dataCalc)}
                  >
                    +{dias}d
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={dataProxima}
              min={obterHojeSP()}
              onChange={(e) => setDataProxima(e.target.value)}
              required
            />
            <span className="field-hint">Agendado para: {formatarData(dataProxima)}</span>
          </div>

          <div className="form-group">
            <label htmlFor="envio-motivo">Motivo do próximo follow-up (opcional)</label>
            <input
              id="envio-motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Cobrar retorno da apresentação"
            />
          </div>

          <div className="form-group">
            <label htmlFor="envio-texto">Observações do envio (opcional)</label>
            <textarea
              id="envio-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Apresentação enviada via WhatsApp comercial."
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Confirmar Envio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
