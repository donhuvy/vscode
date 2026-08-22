import * as vscode from 'vscode';
import { BkitAuthProvider } from './auth/bkitAuthProvider';
import { DeepSeekProxyService, ChatMessage } from './lm/deepseekProxyProvider';
import { BkitLanguageModelProvider, BKIT_AVAILABLE_MODELS } from './lm/bkitLanguageModelProvider';
import { BkitLocalModelServer } from './lm/bkitLocalModelServer';
import { BrowserTools } from './browser/browserTools';
import { BkitMcpClient } from './mcp/bkitMcpClient';

let localModelServerInstance: BkitLocalModelServer | null = null;

export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize Authentication Provider for auth.bkit.vn
  const authProvider = new BkitAuthProvider(context);
  await authProvider.initialize();
  context.subscriptions.push(authProvider);

  // 2. Initialize Backend Services & Token Provider
  const getAccessTokenFn = async () => authProvider.getValidAccessToken();

  const mcpClient = new BkitMcpClient(getAccessTokenFn);
  const deepseekService = new DeepSeekProxyService(getAccessTokenFn);

  // 3. Register BKIT as a Native VS Code Language Model Provider (vendor: 'bkit')
  const lmProvider = new BkitLanguageModelProvider(getAccessTokenFn, context);
  context.subscriptions.push(lmProvider);

  // 4. Start Embedded OpenAI-Compatible Model Provider Server (http://127.0.0.1:51111/v1)
  const localServer = new BkitLocalModelServer(getAccessTokenFn, context);
  localModelServerInstance = localServer;
  context.subscriptions.push(localServer);

  const serverPort = await localServer.start();

  // 5. Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'bkit.checkStatus';
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = async () => {
    const config = vscode.workspace.getConfiguration('bkit');
    const apiKey = config.get<string>('apiKey') || process.env.DEEPSEEK_API_KEY || '';
    const token = await authProvider.getValidAccessToken();
    const port = localServer.getPort();

    if (apiKey || token) {
      const authType = apiKey ? 'DeepSeek API Key' : 'Keycloak (auth.bkit.vn)';
      statusBarItem.text = `$(check) BKIT AI Provider :${port}`;
      statusBarItem.tooltip = `Đã kết nối BKIT Model Provider (${authType})\nOpenAI Endpoint: http://127.0.0.1:${port}/v1\nNative LM Provider: vendor 'bkit'\nMô hình: DeepSeek Flash 4, Chat V3, Reasoner R1`;
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = '$(sign-in) BKIT AI: Chưa cấu hình';
      statusBarItem.tooltip = 'Nhấn vào đây để thiết lập API Key hoặc đăng nhập vào auth.bkit.vn';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    statusBarItem.show();
  };

  authProvider.onDidChangeSessions(() => {
    updateStatusBar();
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('bkit')) {
        updateStatusBar();
      }
    })
  );

  await updateStatusBar();

  // 6. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bkit.login', async () => {
      try {
        await authProvider.createSession(['openid', 'profile', 'email', 'offline_access']);
        await updateStatusBar();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Đăng nhập thất bại: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('bkit.logout', async () => {
      const sessions = await authProvider.getSessions();
      if (sessions.length > 0) {
        await authProvider.removeSession(sessions[0].id);
        await updateStatusBar();
      } else {
        vscode.window.showInformationMessage('Chưa có phiên đăng nhập nào.');
      }
    }),

    vscode.commands.registerCommand('bkit.openBrowser', async () => {
      const url = await vscode.window.showInputBox({
        title: 'BKIT Web Browser',
        prompt: 'Nhập địa chỉ trang web cần mở (ví dụ: hoadondientu.gdt.gov.vn)',
        value: 'https://hoadondientu.gdt.gov.vn'
      });
      if (url) {
        await BrowserTools.openInIntegratedBrowser(url);
      }
    }),

    vscode.commands.registerCommand('bkit.copyModelProviderUrl', async () => {
      const port = localServer.getPort();
      const url = `http://127.0.0.1:${port}/v1`;
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage(`📋 Đã sao chép URL BKIT Model Provider: ${url}`);
    }),

    vscode.commands.registerCommand('bkit.configureAsDefaultModel', async () => {
      const port = localServer.getPort();
      const modelsList = BKIT_AVAILABLE_MODELS.map(m => `• **${m.id}**: ${m.name}`).join('\n');
      const info = `
### 🚀 Cấu hình BKIT làm Model Provider độc lập

Hệ thống BKIT cung cấp 2 phương thức kết nối:

#### 1. Sử dụng trực tiếp trong VS Code / GitHub Copilot Agents (Native Provider):
- Nhà cung cấp (Vendor): \`bkit\`
- Mô hình: \`bkit-deepseek-flash\`, \`bkit-deepseek-chat\`, \`bkit-deepseek-reasoner\`

#### 2. Dùng cho Continue / Cline / Roo Code / Cursor / Aider (OpenAI Compatible):
- **Base URL**: \`http://127.0.0.1:${port}/v1\`
- **API Key**: \`bkit\` hoặc Khóa API đã cấu hình
- **Danh sách Models khả dụng**:
${modelsList}
`;
      const copyBtn = 'Sao chép Base URL';
      const action = await vscode.window.showInformationMessage(
        'BKIT AI Model Provider (vendor: bkit) đã sẵn sàng hoạt động.',
        copyBtn
      );
      if (action === copyBtn) {
        await vscode.commands.executeCommand('bkit.copyModelProviderUrl');
      }
    }),

    vscode.commands.registerCommand('bkit.checkStatus', async () => {
      const token = await authProvider.getValidAccessToken();
      const config = vscode.workspace.getConfiguration('bkit');
      const apiKey = config.get<string>('apiKey') || process.env.DEEPSEEK_API_KEY || '';
      const authUrl = config.get<string>('authUrl');
      const backendApiUrl = config.get<string>('backendApiUrl');
      const aiBaseUrl = config.get<string>('aiBaseUrl', 'https://api.deepseek.com');
      const model = config.get<string>('model');
      const port = localServer.getPort();

      const isConnected = !!(apiKey || token);
      const authSource = apiKey ? `API Key trực tiếp (${aiBaseUrl})` : `Keycloak Token (${authUrl})`;

      const statusMsg = isConnected
        ? `✅ **Đã kết nối BKIT AI Model Provider (vendor: 'bkit')**\n- Phương thức xác thực: \`${authSource}\`\n- Local OpenAI Endpoint: \`http://127.0.0.1:${port}/v1\`\n- Máy chủ MCP: \`https://mcp.bkit.vn/mcp\`\n- Máy chủ Backend: \`${backendApiUrl}\`\n- Mô hình AI: \`${model}\`\n- Trạng thái: Sẵn sàng phục vụ độc lập và hỗ trợ Native VS Code LM API.`
        : `⚠️ **Chưa cấu hình BKIT AI**\n- Vui lòng thiết lập \`bkit.apiKey\` trong Cài đặt hoặc bấm Đăng nhập để sử dụng Model Provider và AI Agent.`;

      const action = isConnected ? 'Sao chép Provider URL' : 'Đăng nhập ngay';
      const selected = await vscode.window.showInformationMessage(
        statusMsg.replace(/\*\*/g, '').replace(/`/g, ''),
        action
      );

      if (selected === 'Đăng nhập ngay') {
        vscode.commands.executeCommand('bkit.login');
      } else if (selected === 'Sao chép Provider URL') {
        vscode.commands.executeCommand('bkit.copyModelProviderUrl');
      }
    })
  );

  // 7. Register Chat Participant @bkit
  const participant = vscode.chat.createChatParticipant('bkit.agent', async (request, context, response, token) => {
    if (request.command === 'login') {
      await vscode.commands.executeCommand('bkit.login');
      return;
    }

    if (request.command === 'web') {
      response.markdown('🌐 **BKIT Web Browser Mode**\n\nĐang kích hoạt công cụ duyệt web và nghiên cứu dữ liệu trực tuyến...\n\n');
    }

    let userPrompt = request.prompt.trim();

    const config = vscode.workspace.getConfiguration('bkit');
    const apiKey = config.get<string>('apiKey') || process.env.DEEPSEEK_API_KEY || '';
    const accessToken = await authProvider.getValidAccessToken();

    if (!apiKey && !accessToken) {
      response.markdown('⚠️ **Chưa cấu hình API Key hoặc đăng nhập BKIT**: Vui lòng thiết lập `bkit.apiKey` trong cài đặt hoặc nhấn **[BKIT AI: Chưa cấu hình]** ở góc dưới cùng bên phải để đăng nhập.');
      return;
    }

    // Direct MCP Query Check
    const isDataQuery = /hàng hóa|vật tư|tài khoản|khách hàng|nhà cung cấp|đối tác|hóa đơn|tài sản|thực thể|bảng|menu|mẫu biểu|dashboard|phần mềm thuế/i.test(userPrompt);

    if (isDataQuery || request.command === 'mcp') {
      response.progress('Đang truy vấn dữ liệu từ Máy chủ MCP (https://mcp.bkit.vn/mcp)...');
      try {
        const mcpResult = await mcpClient.handleUserQuery(userPrompt);
        if (mcpResult) {
          response.markdown(mcpResult);
          return;
        }
      } catch (err: any) {
        response.markdown(`⚠️ *Lưu ý khi gọi MCP*: ${err.message}\n\n`);
      }
    }

    // Build context messages
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Bạn là BKIT AI Assistant - Tác nhân AI tích hợp trong Visual Studio Code cho hệ thống Kế toán BKIT ERP.
Bạn có quyền truy cập vào Máy chủ MCP (https://mcp.bkit.vn/mcp) với 256 bảng dữ liệu kế toán và các công cụ duyệt web thông minh theo Thông tư 99/2025/TT-BTC.
Mô hình AI: DeepSeek Flash 4 / Chat V3.
Hãy trả lời lịch sự, chính xác bằng tiếng Việt, trình bày dạng bảng và các bước hành động rõ ràng.`
      }
    ];

    // Append history
    for (const h of context.history) {
      if (h instanceof vscode.ChatRequestTurn) {
        messages.push({ role: 'user', content: h.prompt });
      } else if (h instanceof vscode.ChatResponseTurn) {
        const textParts = h.response.map(r => {
          if (r instanceof vscode.ChatResponseMarkdownPart) {
            return r.value.value;
          }
          return '';
        }).join('');
        if (textParts) {
          messages.push({ role: 'assistant', content: textParts });
        }
      }
    }

    // If user provided a URL in prompt, auto-fetch readable summary
    const urlMatch = userPrompt.match(/https?:\/\/[^\s]+/i);
    if (urlMatch && request.command === 'web') {
      const targetUrl = urlMatch[0];
      response.progress(`Đang đọc nội dung từ trang web: ${targetUrl}...`);
      const pageText = await BrowserTools.fetchWebPage(targetUrl);
      userPrompt += `\n\n--- DỮ LIỆU ĐÃ THU THẬP TỪ TRANG WEB (${targetUrl}) ---\n${pageText}\n--- HẾT DỮ LIỆU TRANG WEB ---`;
    }

    messages.push({ role: 'user', content: userPrompt });

    // Stream AI response
    await deepseekService.streamChatCompletion(messages, response, token);
  });

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
  context.subscriptions.push(participant);
}

export function deactivate() {
  if (localModelServerInstance) {
    localModelServerInstance.dispose();
    localModelServerInstance = null;
  }
}
