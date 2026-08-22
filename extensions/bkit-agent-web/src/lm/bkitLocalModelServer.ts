import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as vscode from 'vscode';
import { BKIT_AVAILABLE_MODELS } from './bkitLanguageModelProvider';

export class BkitLocalModelServer implements vscode.Disposable {
  private _server: http.Server | null = null;
  private _port: number = 51111;
  private _isRunning: boolean = false;

  constructor(
    private readonly getAccessToken: () => Promise<string | null>,
    _context: vscode.ExtensionContext
  ) {}

  public async start(): Promise<number> {
    const config = vscode.workspace.getConfiguration('bkit');
    const enabled = config.get<boolean>('enableLocalOpenAiServer', true);
    if (!enabled) {
      return 0;
    }

    const preferredPort = config.get<number>('localServerPort', 51111);

    return new Promise((resolve) => {
      this._server = http.createServer(async (req, res) => {
        this._handleHttpRequest(req, res);
      });

      this._server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Port ${preferredPort} in use, trying auto-assigned port...`);
          this._server?.listen(0, '127.0.0.1', () => {
            const addr = this._server?.address() as any;
            this._port = addr?.port || preferredPort;
            this._isRunning = true;
            console.log(`✅ BKIT Model Provider Server started at http://127.0.0.1:${this._port}/v1`);
            resolve(this._port);
          });
        } else {
          console.error('BKIT Model Provider Server error:', err);
          resolve(0);
        }
      });

      this._server.listen(preferredPort, '127.0.0.1', () => {
        this._port = preferredPort;
        this._isRunning = true;
        console.log(`✅ BKIT Model Provider Server running at http://127.0.0.1:${this._port}/v1`);
        resolve(this._port);
      });
    });
  }

  public getPort(): number {
    return this._port;
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this._port}/v1`;
  }

  public isRunning(): boolean {
    return this._isRunning;
  }

  private async _handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS for all local tools and browser web apps
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${this._port}`);
    const pathname = reqUrl.pathname;

    // 1. Root Information
    if (pathname === '/' || pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        name: 'BKIT AI Local Model Provider',
        version: '1.0.0',
        status: 'running',
        auth: 'Direct API Key / Keycloak OIDC (auth.bkit.vn)',
        openAiEndpoint: `http://127.0.0.1:${this._port}/v1/chat/completions`,
        modelsEndpoint: `http://127.0.0.1:${this._port}/v1/models`,
        models: BKIT_AVAILABLE_MODELS.map(m => m.id)
      }, null, 2));
      return;
    }

    // 2. OpenAI Models List (/v1/models or /models)
    if (pathname === '/v1/models' || pathname === '/models') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      const modelsData = [
        ...BKIT_AVAILABLE_MODELS.map(m => ({
          id: m.id,
          object: 'model',
          created: 1716000000,
          owned_by: 'bkit',
          permission: [],
          root: m.id,
          parent: null
        })),
        { id: 'deepseek-chat', object: 'model', created: 1716000000, owned_by: 'bkit' },
        { id: 'deepseek-flash-4', object: 'model', created: 1716000000, owned_by: 'bkit' },
        { id: 'deepseek-reasoner', object: 'model', created: 1716000000, owned_by: 'bkit' }
      ];

      res.end(JSON.stringify({
        object: 'list',
        data: modelsData
      }));
      return;
    }

    // 3. OpenAI Chat Completions (/v1/chat/completions or /chat/completions)
    if (pathname === '/v1/chat/completions' || pathname === '/chat/completions') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Method Not Allowed', type: 'invalid_request_error' } }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const requestPayload = JSON.parse(body || '{}');
          await this._forwardChatCompletion(requestPayload, res);
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: `Invalid JSON payload: ${err.message}`, type: 'invalid_request_error' } }));
        }
      });
      return;
    }

    // 4. 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Path ${pathname} not found on BKIT Model Server`, type: 'invalid_request_error' } }));
  }

  private async _forwardChatCompletion(payload: any, clientRes: http.ServerResponse): Promise<void> {
    const config = vscode.workspace.getConfiguration('bkit');
    const apiKey = config.get<string>('apiKey') || process.env.DEEPSEEK_API_KEY || process.env.BKIT_AI_API_KEY || '';
    const aiBaseUrl = config.get<string>('aiBaseUrl', 'https://api.deepseek.com');
    let backendApiUrl = config.get<string>('backendApiUrl', 'https://a2a.bkit.vn');
    if (backendApiUrl.includes('a.bkit.vn')) {
      backendApiUrl = 'https://a2a.bkit.vn';
    }

    let authHeader = '';
    let targetEndpoint: URL;

    if (apiKey && apiKey.trim().length > 0) {
      authHeader = `Bearer ${apiKey.trim()}`;
      const normalizedBase = aiBaseUrl.replace(/\/+$/, '');
      targetEndpoint = new URL('/chat/completions', normalizedBase);
    } else {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        clientRes.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        clientRes.end(JSON.stringify({
          error: {
            message: 'Chưa cấu hình API Key hoặc đăng nhập BKIT. Vui lòng thiết lập "bkit.apiKey" hoặc chạy lệnh "BKIT: Đăng nhập vào hệ thống BKIT".',
            type: 'authentication_error',
            code: 'unauthorized'
          }
        }));
        return;
      }
      authHeader = `Bearer ${accessToken}`;
      targetEndpoint = new URL('/api/ai/chat/completions', backendApiUrl);
    }

    // Map model names if prefixed
    let modelName = payload.model || 'deepseek-chat';
    if (modelName === 'bkit-deepseek-flash' || modelName.includes('flash')) {
      modelName = 'deepseek-chat';
    } else if (modelName === 'bkit-deepseek-reasoner' || modelName.includes('reasoner')) {
      modelName = 'deepseek-reasoner';
    } else if (modelName === 'bkit-deepseek-chat') {
      modelName = 'deepseek-chat';
    }

    payload.model = modelName;
    const isStream = payload.stream === true;

    const postData = JSON.stringify(payload);

    const isHttps = targetEndpoint.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const forwardReq = requestModule.request(
      targetEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Accept': isStream ? 'text/event-stream' : 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (backendRes) => {
        const statusCode = backendRes.statusCode || 200;

        if (statusCode >= 400) {
          let errorData = '';
          backendRes.on('data', chunk => errorData += chunk);
          backendRes.on('end', () => {
            clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
            clientRes.end(errorData || JSON.stringify({ error: { message: `AI Server error ${statusCode}` } }));
          });
          return;
        }

        if (isStream) {
          clientRes.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });

          backendRes.pipe(clientRes);
        } else {
          clientRes.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          backendRes.pipe(clientRes);
        }
      }
    );

    forwardReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({
          error: {
            message: `Không thể kết nối đến máy chủ AI Provider (${targetEndpoint.origin}): ${err.message}`,
            type: 'api_error'
          }
        }));
      }
    });

    forwardReq.write(postData);
    forwardReq.end();
  }

  public dispose() {
    if (this._server) {
      this._server.close();
      this._server = null;
      this._isRunning = false;
    }
  }
}
