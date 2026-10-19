# Extensão do Chrome para WhatsApp Web — GAL Gestão (Fase 5)

Painel lateral (Side Panel) de inteligência comercial e CRM para o **WhatsApp Web**, integrado diretamente à plataforma **GAL Gestão**.

---

## 🔒 Princípios de Segurança e Privacidade

- **Apenas Leitura**: A extensão **nunca** envia mensagens sozinhas, **nunca** clica em nada no WhatsApp Web e **nunca** abre conversas automaticamente. Toda interação e envio de mensagem é 100% manual e controlado pelo usuário.
- **Sem Automação Não Autorizada**: Não utiliza bibliotecas de bot/automação (como Baileys, WPPConnect ou WhatsApp-Web.js), operando de acordo com as diretrizes do navegador e do WhatsApp.
- **Isolamento de Conversas**: A extensão detecta **apenas a conversa aberta no momento** na tela principal (`#main`). Ela nunca lê a lista lateral de conversas nem vasculha conversas que não estejam abertas.
- **Sem Mensagens Prontas**: Não há templates automáticos ou botões de cópia de texto invasivos.

---

## 🚀 Passo a Passo para Instalação

### 1. Gerar o Build da Extensão
No terminal, na raiz do projeto, execute o comando:

```bash
bun run build:extension
```
*(ou `npm run build:extension`)*

Isso criará a pasta `extension/dist/` contendo todos os arquivos empacotados pelo **esbuild**, ícones gerados e o `manifest.json` (Chrome Manifest V3).

---

### 2. Carregar a Extensão no Google Chrome

1. Abra o Google Chrome e acesse:
   ```text
   chrome://extensions
   ```
2. No canto superior direito da página, ative a chave **"Modo do desenvolvedor"** (Developer mode).
3. No canto superior esquerdo, clique no botão **"Carregar sem compactação"** (Load unpacked).
4. Navegue até a pasta do projeto e selecione a pasta:
   ```text
   extension/dist
   ```
5. A extensão **GAL Gestão - WhatsApp** aparecerá na sua lista de extensões ativas.
6. Recomenda-se clicar no ícone de quebra-cabeça do Chrome (Extensões) e **fixar** o ícone do **GAL Gestão** na barra de ferramentas do navegador.

---

### 3. Configurar o Endereço do Site (Opções)

1. Na lista de extensões (`chrome://extensions`), localize o card da extensão **GAL Gestão - WhatsApp** e clique em **"Detalhes"** → **"Opções da extensão"** (ou clique com o botão direito no ícone da extensão na barra de ferramentas e selecione **"Opções"**).
2. No campo **"Endereço do site"**, informe a URL publicada da aplicação no Lovable (por exemplo, `https://galgestao.lovable.app`).
3. Clique em **"Salvar Configurações"**.
4. *(Opcional)* Clique em **"Testar Abertura do CRM ↗"** para certificar-se de que a URL está acessível.

---

### 4. Usar no WhatsApp Web

1. Acesse o **[WhatsApp Web](https://web.whatsapp.com)** no seu navegador Google Chrome.
2. Clique no ícone da extensão **GAL Gestão** na barra de ferramentas do Chrome.
3. O painel lateral do Chrome (`chrome.sidePanel`) será aberto ao lado da tela do WhatsApp.
4. **Primeiro Acesso (Login)**:
   - Digite o seu **e-mail** e **senha** (as mesmas credenciais de acesso ao CRM).
   - O sistema validará suas credenciais e a autorização (`is_authorized`).
5. **Navegação nas Conversas**:
   - Ao clicar em qualquer conversa no WhatsApp Web, a extensão detecta automaticamente o nome e o telefone do contato.
   - **Se o contato for encontrado**: exibe o nome da construtora, selo PRADO com suas respectivas cores, cargo, oportunidades em aberto, próximo follow-up agendado e os últimos 5 registros de histórico.
   - **Alerta de Resposta**: se o cliente responder após o último envio registrado, um aviso em amarelo destaca que há um novo retorno aguardando tratativa.
   - **Se o contato não for encontrado**: oferece os botões para **Vincular a contato existente** (com busca em tempo real) ou criar um **Novo prospect**, abrindo o formulário já pré-preenchido no CRM.
6. **Ações Comerciais**:
   - **Enviei**: registra o envio de apresentação e já agenda o próximo follow-up com atalhos de dias.
   - **Respondeu**: registra a resposta nas situações previstas (tem demanda, demanda prevista em mês/ano, sem demanda, atendido por outro rep. PRADO, falar depois ou sem interesse).
   - **+ Follow-up**: remarca o próximo contato ou agenda uma nova data.
   - **Atividade**: registra ligações, visitas presenciais, notas ou outras atividades com o cliente.
   - **Abrir no CRM**: abre diretamente a ficha completa da construtora no GAL Gestão.
