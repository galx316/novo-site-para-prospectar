import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

export function OptionsApp() {
  const [crmUrl, setCrmUrl] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('crm_url', (res) => {
      if (typeof res?.crm_url === 'string') {
        setCrmUrl(res.crm_url);
      }
    });
  }, []);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagemSucesso(false);

    try {
      // Normalizar URL removendo barra final
      let urlNormalizada = crmUrl.trim().replace(/\/+$/, '');
      if (urlNormalizada && !/^https?:\/\//i.test(urlNormalizada)) {
        urlNormalizada = `https://${urlNormalizada}`;
      }

      await chrome.storage.local.set({ crm_url: urlNormalizada });
      setCrmUrl(urlNormalizada);
      setMensagemSucesso(true);
      setTimeout(() => setMensagemSucesso(false), 4000);
    } catch (err) {
      console.error('Erro ao salvar URL:', err);
    } finally {
      setSalvando(false);
    }
  }

  function handleTestarAbertura() {
    if (!crmUrl) return;
    chrome.tabs.create({ url: crmUrl });
  }

  return (
    <div className="options-container">
      <div className="options-card">
        <div className="options-header">
          <div className="brand-logo">G</div>
          <div>
            <h2>GAL Gestão</h2>
            <p>Configurações da Extensão do WhatsApp</p>
          </div>
        </div>

        {mensagemSucesso && (
          <div className="alert-box alert-success">
            ✓ Endereço do site salvo com sucesso!
          </div>
        )}

        <form onSubmit={handleSalvar} className="options-form">
          <div className="form-group">
            <label htmlFor="crm-url">
              Endereço do site (URL do Lovable ou Domínio do CRM)
            </label>
            <input
              id="crm-url"
              type="text"
              value={crmUrl}
              onChange={(e) => setCrmUrl(e.target.value)}
              placeholder="https://galgestao.lovable.app"
              required
            />
            <span className="field-hint">
              Esta URL é utilizada nos botões "Abrir no CRM" e "Novo prospect" para direcionar
              à ficha cadastral correta.
            </span>
          </div>

          <div className="options-actions">
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </button>

            {crmUrl && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestarAbertura}
              >
                Testar Abertura do CRM ↗
              </button>
            )}
          </div>
        </form>

        <div className="options-footer">
          <p>
            GAL Gestão • Extensão Google Chrome para WhatsApp Web (Manifest V3)
          </p>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<OptionsApp />);
}
