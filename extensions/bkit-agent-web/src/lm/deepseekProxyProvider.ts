import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class DeepSeekProxyService {
  constructor(private readonly getAccessToken: () => Promise<string | null>) {}

  public async streamChatCompletion(
    messages: ChatMessage[],
    responseStream: vscode.ChatResponseStream,
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
    let targetEndpoint: URL;
    let postPayload: string;

    if (apiKey && apiKey.trim().length > 0) {
      // 1. Direct DeepSeek OpenAI-compatible chat stream
      authHeader = `Bearer ${apiKey.trim()}`;
      const normalizedBase = aiBaseUrl.replace(/\/+$/, '');
      targetEndpoint = new URL('/chat/completions', normalizedBase);
      postPayload = JSON.stringify({
        model: 'deepseek-chat',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true
      });
    } else {
      // 2. A2A / Keycloak authenticated stream
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        responseStream.markdown(
          '⚠️ **Chưa cấu hình API Key hoặc đăng nhập BKIT**:\n' +
          '- Thiết lập `bkit.apiKey` trong Cài đặt (Settings) của VS Code, hoặc\n' +
          '- Gõ `@bkit /login` để đăng nhập qua tài khoản Keycloak.'
        );
        return;
      }
      authHeader = `Bearer ${accessToken}`;
      targetEndpoint = new URL('/message:stream', backendApiUrl);
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || 'Xin chào';
      postPayload = JSON.stringify({
        agent_name: 'accounting-agent',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: lastUserMessage }]
        }
      });
    }

    const isHttps = targetEndpoint.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = requestModule.request(
        targetEndpoint,
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
              responseStream.markdown(`❌ **Lỗi từ máy chủ AI (${res.statusCode})**: ${errorBody || res.statusMessage}`);
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
              if (!trimmed || trimmed.startsWith(':')) {
                continue;
              }

              if (trimmed === 'data: [DONE]') {
                resolve();
                return;
              }

              if (trimmed.startsWith('data: ')) {
                try {
                  const jsonStr = trimmed.substring(6);
                  const parsed = JSON.parse(jsonStr);

                  // 1. A2A format (delta)
                  if (parsed.delta) {
                    responseStream.markdown(parsed.delta);
                  }
                  // 2. OpenAI / DeepSeek format
                  else if (parsed.choices?.[0]?.delta?.content) {
                    responseStream.markdown(parsed.choices[0].delta.content);
                  }
                  // 3. Status messages
                  else if (parsed.state === 'working' && parsed.message) {
                    responseStream.progress(parsed.message);
                  }
                } catch {
                  // Ignore chunk json anomalies
                }
              }
            }
          });

          res.on('end', () => {
            resolve();
          });

          res.on('error', (err) => {
            responseStream.markdown(`\n\n❌ **Lỗi kết nối**: ${err.message}`);
            resolve();
          });
        }
      );

      token.onCancellationRequested(() => {
        req.destroy();
        resolve();
      });

      req.on('error', (err) => {
        responseStream.markdown(`❌ **Không thể kết nối đến máy chủ AI**: ${err.message}`);
        resolve();
      });

      req.write(postPayload);
      req.end();
    });
  }
}
