import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface BkitModelInfo {
  id: string;
  name: string;
  family: string;
  version: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  description: string;
}

export const BKIT_AVAILABLE_MODELS: BkitModelInfo[] = [
  {
    id: 'bkit-deepseek-flash',
    name: 'BKIT DeepSeek Flash 4',
    family: 'deepseek',
    version: '4.0.0',
    maxInputTokens: 64000,
    maxOutputTokens: 8192,
    description: 'Mô hình AI siêu tốc, tối ưu hóa cho tác vụ kế toán và phân tích chứng từ nhanh chóng.'
  },
  {
    id: 'bkit-deepseek-chat',
    name: 'BKIT DeepSeek Chat V3',
    family: 'deepseek',
    version: '3.0.0',
    maxInputTokens: 64000,
    maxOutputTokens: 8192,
    description: 'Mô hình trò chuyện và định khoản kế toán tổng hợp mạnh mẽ theo chuẩn Thông tư 99/2025/TT-BTC.'
  },
  {
    id: 'bkit-deepseek-reasoner',
    name: 'BKIT DeepSeek Reasoner R1',
    family: 'deepseek',
    version: '1.0.0',
    maxInputTokens: 64000,
    maxOutputTokens: 8192,
    description: 'Mô hình suy luận logic chuyên sâu, đối soát báo cáo tài chính phức tạp và giải bài toán thuế.'
  }
];

export class BkitLanguageModelProvider implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly getAccessToken: () => Promise<string | null>,
    private readonly context: vscode.ExtensionContext
  ) {
    this._registerProvider();
  }

  private _registerProvider() {
    try {
      const lmAny = vscode.lm as any;
      const providerImpl = {
        provideLanguageModelChatInformation: async (options?: any, token?: vscode.CancellationToken) => {
          return BKIT_AVAILABLE_MODELS.map(m => ({
            id: m.id,
            name: m.name,
            family: m.family,
            version: m.version,
            maxInputTokens: m.maxInputTokens,
            maxOutputTokens: m.maxOutputTokens
          }));
        },
        provideLanguageModelChatResponse: async (
          model: any,
          messages: readonly any[],
          options: any,
          progress: vscode.Progress<any>,
          token: vscode.CancellationToken
        ) => {
          const modelId = typeof model === 'string' ? model : (model?.id || 'bkit-deepseek-chat');
          await this.handleChatRequest(modelId, messages, progress, token);
        },
        provideLanguageModelResponse: async (
          model: any,
          messages: readonly any[],
          options: any,
          progress: vscode.Progress<any>,
          token: vscode.CancellationToken
        ) => {
          const modelId = typeof model === 'string' ? model : (model?.id || 'bkit-deepseek-chat');
          await this.handleChatRequest(modelId, messages, progress, token);
        },
        sendChatRequest: async (
          model: any,
          messages: readonly any[],
          options: any,
          progress: vscode.Progress<any>,
          token: vscode.CancellationToken
        ) => {
          const modelId = typeof model === 'string' ? model : (model?.id || 'bkit-deepseek-chat');
          await this.handleChatRequest(modelId, messages, progress, token);
        },
        provideTokenCount: async (model: any, text: string | any, token: vscode.CancellationToken) => {
          let rawStr = '';
          if (typeof text === 'string') {
            rawStr = text;
          } else if (text && typeof text === 'object') {
            if (typeof text.content === 'string') {
              rawStr = text.content;
            } else if (Array.isArray(text.content)) {
              rawStr = text.content.map((c: any) => c.value || c.text || '').join('');
            } else {
              rawStr = JSON.stringify(text);
            }
          }
          return Math.max(1, Math.ceil(rawStr.length / 4));
        }
      };

      if (typeof lmAny.registerLanguageModelChatProvider === 'function') {
        const disposable = lmAny.registerLanguageModelChatProvider('bkit', providerImpl);
        this._disposables.push(disposable);
      }

      if (typeof lmAny.registerChatModelProvider === 'function') {
        const disposable = lmAny.registerChatModelProvider('bkit', providerImpl);
        this._disposables.push(disposable);
      }
    } catch (err) {
      console.warn('BKIT LanguageModelProvider registration notice:', err);
    }
  }

  private _reportProgressText(progress: vscode.Progress<any>, text: string): void {
    if (typeof (vscode as any).LanguageModelTextPart === 'function') {
      try {
        progress.report(new (vscode as any).LanguageModelTextPart(text));
        return;
      } catch {
        // Fallback to direct report if constructor signature differs
      }
    }
    progress.report(text as any);
  }

  public async handleChatRequest(
    modelId: string,
    messages: readonly any[],
    progress: vscode.Progress<any>,
    token: vscode.CancellationToken
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('bkit');
    const apiKey = config.get<string>('apiKey') || process.env.DEEPSEEK_API_KEY || process.env.BKIT_AI_API_KEY || '';
    const aiBaseUrl = config.get<string>('aiBaseUrl', 'https://api.deepseek.com');
    let backendApiUrl = config.get<string>('backendApiUrl', 'https://a2a.bkit.vn');
    if (backendApiUrl.includes('a.bkit.vn')) {
      backendApiUrl = 'https://a2a.bkit.vn';
    }

    let authHeader = '';
    let targetEndpointUrl: URL;

    if (apiKey && apiKey.trim().length > 0) {
      // Direct connection using API Key
      authHeader = `Bearer ${apiKey.trim()}`;
      const normalizedBase = aiBaseUrl.replace(/\/+$/, '');
      const pathSuffix = normalizedBase.endsWith('/v1') ? '/chat/completions' : '/chat/completions';
      targetEndpointUrl = new URL(pathSuffix, normalizedBase);
    } else {
      // Fallback to Keycloak OAuth2 JWT Access Token
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        this._reportProgressText(
          progress,
          '⚠️ **Chưa cấu hình API Key hoặc đăng nhập BKIT**:\n' +
          '- Cách 1: Thiết lập `bkit.apiKey` trong cài đặt VS Code Settings.\n' +
          '- Cách 2: Nhấn vào thanh trạng thái hoặc chạy lệnh `BKIT: Đăng nhập vào hệ thống BKIT`.'
        );
        return;
      }
      authHeader = `Bearer ${accessToken}`;
      targetEndpointUrl = new URL('/api/ai/chat/completions', backendApiUrl);
    }

    // Map model
    let targetModel = 'deepseek-chat';
    if (modelId.includes('flash')) {
      targetModel = 'deepseek-chat';
    } else if (modelId.includes('reasoner')) {
      targetModel = 'deepseek-reasoner';
    } else if (modelId.includes('chat')) {
      targetModel = 'deepseek-chat';
    } else if (modelId) {
      targetModel = modelId;
    }

    // Format messages for OpenAI / DeepSeek API
    const formattedMessages = messages.map(m => {
      let role = 'user';
      if (m.role === 1 || m.role === 'user') role = 'user';
      else if (m.role === 2 || m.role === 'assistant') role = 'assistant';
      else if (m.role === 3 || m.role === 'system') role = 'system';

      let textContent = '';
      if (typeof m.content === 'string') {
        textContent = m.content;
      } else if (Array.isArray(m.content)) {
        textContent = m.content.map((c: any) => c.value || c.text || '').join('');
      } else if (m.content && typeof m.content === 'object') {
        textContent = m.content.value || m.content.text || JSON.stringify(m.content);
      }

      return { role, content: textContent };
    });

    const postData = JSON.stringify({
      model: targetModel,
      messages: formattedMessages,
      stream: true
    });

    const isHttps = targetEndpointUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = requestModule.request(
        targetEndpointUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'Accept': 'text/event-stream'
          }
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            let errorBody = '';
            res.on('data', chunk => errorBody += chunk);
            res.on('end', () => {
              this._reportProgressText(progress, `❌ Lỗi từ máy chủ AI (${res.statusCode}): ${errorBody || res.statusMessage}`);
              resolve();
            });
            return;
          }

          let buffer = '';
          res.on('data', (chunk: Buffer) => {
            if (token.isCancellationRequested) {
              req.destroy();
              resolve();
              return;
            }

            buffer += chunk.toString('utf-8');
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') {
                resolve();
                return;
              }

              if (trimmed.startsWith('data: ')) {
                try {
                  const jsonStr = trimmed.substring(6);
                  const parsed = JSON.parse(jsonStr);
                  const deltaText = parsed.choices?.[0]?.delta?.content || parsed.delta || '';
                  if (deltaText) {
                    this._reportProgressText(progress, deltaText);
                  }
                } catch {
                  // Ignore JSON parse errors in malformed stream chunks
                }
              }
            }
          });

          res.on('end', () => resolve());
          res.on('error', (err) => {
            this._reportProgressText(progress, `❌ Lỗi kết nối luồng: ${err.message}`);
            resolve();
          });
        }
      );

      token.onCancellationRequested(() => {
        req.destroy();
        resolve();
      });

      req.on('error', (err) => {
        this._reportProgressText(progress, `❌ Không thể kết nối tới máy chủ AI Provider (${targetEndpointUrl.origin}): ${err.message}`);
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }

  public dispose() {
    this._disposables.forEach(d => d.dispose());
  }
}
