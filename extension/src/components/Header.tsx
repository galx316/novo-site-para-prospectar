import React from 'react';

interface HeaderProps {
  emailUsuario?: string | null;
  onRefresh: () => void;
  onLogout: () => void;
  carregando?: boolean;
}

export function Header({ emailUsuario, onRefresh, onLogout, carregando }: HeaderProps) {
  function abrirOpcoes() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  }

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">G</div>
        <div className="brand-text">
          <span className="brand-title">GAL Gestão</span>
          <span className="brand-sub">WhatsApp CRM</span>
        </div>
      </div>

      <div className="header-actions">
        {emailUsuario && (
          <span className="user-badge" title={emailUsuario}>
            {emailUsuario.split('@')[0]}
          </span>
        )}

        <button
          className="header-btn"
          onClick={onRefresh}
          disabled={carregando}
          title="Atualizar conversa"
        >
          <span className={`icon-refresh ${carregando ? 'spinning' : ''}`}>↻</span>
        </button>

        <button className="header-btn" onClick={abrirOpcoes} title="Configurações">
          ⚙
        </button>

        <button className="header-btn logout-btn" onClick={onLogout} title="Sair da conta">
          Sair
        </button>
      </div>
    </header>
  );
}
