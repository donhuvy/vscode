import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL, URLSearchParams } from 'url';

export interface BkitSession extends vscode.AuthenticationSession {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
  readonly userProfile?: {
    sub: string;
    email?: string;
    name?: string;
    preferred_username?: string;
  };
}

/**
 * Enterprise Public PKCE Authentication Provider for BKIT (auth.bkit.vn)
 * Conforms to OAuth 2.0 PKCE (RFC 7636) & Native Apps (RFC 8252) standards.
 * ZERO Hardcoded Secrets - 100% Secure for Distribution to End-Users.
 */
export class BkitAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
  public static readonly AUTH_TYPE = 'bkit-auth';
  private static readonly SECRET_KEY = 'bkit.auth.session';

  public static readonly ISSUER_URL = 'https://auth.bkit.vn/realms/bkit';
  public static readonly CLIENT_ID = 'agent'; // Public Client with PKCE S256 (Zero Secret)

  private _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  public readonly onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

  private _session: BkitSession | null = null;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this._disposables.push(
      vscode.authentication.registerAuthenticationProvider(
        BkitAuthProvider.AUTH_TYPE,
        'BKIT Account (auth.bkit.vn)',
        this,
        { supportsMultipleAccounts: false }
      )
    );
  }

  public async initialize(): Promise<void> {
    const rawSecret = await this.context.secrets.get(BkitAuthProvider.SECRET_KEY);
    if (rawSecret) {
      try {
        const parsed = JSON.parse(rawSecret);
        this._session = parsed;
        // Check if token needs refresh
        if (this._session && this._session.expiresAt && Date.now() > this._session.expiresAt - 60000) {
          if (this._session.refreshToken) {
            await this.refreshAccessToken();
          }
        }
      } catch {
        await this.context.secrets.delete(BkitAuthProvider.SECRET_KEY);
      }
    }
  }

  public async getSessions(_scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
    if (!this._session) {
      return [];
    }
    // Auto-refresh token if near expiration
    if (this._session.expiresAt && Date.now() > this._session.expiresAt - 60000 && this._session.refreshToken) {
      await this.refreshAccessToken();
    }
    return [this._session];
  }

  public async createSession(_scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const tokenResult = await this._loginViaPkceLoopback();
    const username = tokenResult.userProfile?.name || tokenResult.userProfile?.preferred_username || tokenResult.userProfile?.email || 'Tài khoản BKIT';

    const newSession: BkitSession = {
      id: crypto.randomUUID(),
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt: tokenResult.expiresIn ? Date.now() + tokenResult.expiresIn * 1000 : undefined,
      userProfile: tokenResult.userProfile,
      account: {
        id: tokenResult.userProfile?.sub || 'bkit-user',
        label: username
      },
      scopes: ['openid', 'profile', 'email']
    };

    this._session = newSession;
    await this.context.secrets.store(BkitAuthProvider.SECRET_KEY, JSON.stringify(newSession));

    this._onDidChangeSessions.fire({
      added: [newSession],
      removed: [],
      changed: []
    });

    vscode.window.showInformationMessage(`✅ Đăng nhập BKIT thành công: ${username}`);
    return newSession;
  }

  public async removeSession(sessionId: string): Promise<void> {
    if (this._session && this._session.id === sessionId) {
      const removed = this._session;
      this._session = null;
      await this.context.secrets.delete(BkitAuthProvider.SECRET_KEY);

      this._onDidChangeSessions.fire({
        added: [],
        removed: [removed],
        changed: []
      });

      vscode.window.showInformationMessage('👋 Đã đăng xuất khỏi tài khoản BKIT.');
    }
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this._session) {
      return null;
    }
    if (this._session.expiresAt && Date.now() > this._session.expiresAt - 60000 && this._session.refreshToken) {
      await this.refreshAccessToken();
    }
    return this._session?.accessToken || null;
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this._session || !this._session.refreshToken) {
      return;
    }

    try {
      const tokenEndpoint = `${BkitAuthProvider.ISSUER_URL}/protocol/openid-connect/token`;
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: BkitAuthProvider.CLIENT_ID,
        refresh_token: this._session.refreshToken
      });

      const response = await this._httpPost(tokenEndpoint, params.toString(), 'application/x-www-form-urlencoded');
      const data = JSON.parse(response);

      if (data.access_token) {
        this._session = {
          ...this._session,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || this._session.refreshToken,
          expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
        };
        await this.context.secrets.store(BkitAuthProvider.SECRET_KEY, JSON.stringify(this._session));
      }
    } catch (err) {
      console.error('Không thể làm mới token BKIT:', err);
    }
  }

  // 1-Click Browser PKCE Login with local loopback callback server
  private async _loginViaPkceLoopback(): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; userProfile?: any }> {
    return new Promise(async (resolve, reject) => {
      // 1. Generate PKCE code verifier & challenge
      const codeVerifier = this._base64UrlEncode(crypto.randomBytes(32));
      const codeChallenge = this._base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
      const state = this._base64UrlEncode(crypto.randomBytes(16));

      // 2. Start local HTTP callback server on free port
      const server = http.createServer();
      server.listen(0, '127.0.0.1', async () => {
        const address = server.address() as any;
        const port = address.port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const authUrl = new URL(`${BkitAuthProvider.ISSUER_URL}/protocol/openid-connect/auth`);
        authUrl.searchParams.set('client_id', BkitAuthProvider.CLIENT_ID);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'openid profile email');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('state', state);

        server.on('request', async (req, res) => {
          try {
            const reqUrl = new URL(req.url || '', `http://127.0.0.1:${port}`);
            if (reqUrl.pathname === '/callback') {
              const code = reqUrl.searchParams.get('code');
              const returnedState = reqUrl.searchParams.get('state');

              if (!code || returnedState !== state) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h2>❌ Đăng nhập thất bại hoặc State không khớp. Vui lòng thử lại.</h2>');
                server.close();
                reject(new Error('State không khớp hoặc mã xác thực không hợp lệ.'));
                return;
              }

              // Exchange authorization code for tokens (PKCE - Zero Secret)
              const tokenEndpoint = `${BkitAuthProvider.ISSUER_URL}/protocol/openid-connect/token`;
              const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: BkitAuthProvider.CLIENT_ID,
                code: code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
              });

              const tokenRes = await this._httpPost(tokenEndpoint, params.toString(), 'application/x-www-form-urlencoded');
              const tokenData = JSON.parse(tokenRes);

              // Get Userinfo
              let userProfile: any = null;
              try {
                const userinfoRes = await this._httpGet(
                  `${BkitAuthProvider.ISSUER_URL}/protocol/openid-connect/userinfo`,
                  tokenData.access_token
                );
                userProfile = JSON.parse(userinfoRes);
              } catch {}

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <html>
                  <head>
                    <title>BKIT AI - Đăng nhập Thành công</title>
                    <style>
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #0f172a; text-align: center; padding-top: 80px; }
                      .card { background: #ffffff; border-radius: 12px; padding: 40px; max-width: 480px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
                      h1 { color: #0284c7; margin-bottom: 12px; }
                      p { color: #475569; font-size: 16px; }
                    </style>
                  </head>
                  <body>
                    <div class="card">
                      <h1>✅ Đăng nhập Thành công!</h1>
                      <p>Chào mừng <strong>${userProfile?.name || userProfile?.preferred_username || 'Quý khách'}</strong> đến với BKIT Accounting Agents Desktop.</p>
                      <p>Bạn có thể đóng tab này và quay lại phần mềm để tiếp tục làm việc.</p>
                    </div>
                  </body>
                </html>
              `);

              server.close();
              resolve({
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                userProfile: userProfile
              });
            }
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h2>❌ Lỗi xử lý: ${err.message}</h2>`);
            server.close();
            reject(err);
          }
        });

        // Open browser
        await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));
      });

      // Timeout after 3 minutes if no response
      setTimeout(() => {
        try { server.close(); } catch {}
        reject(new Error('Hết thời gian chờ đăng nhập (Timeout 3 phút).'));
      }, 180000);
    });
  }

  private _base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private _httpPost(targetUrl: string, body: string, contentType: string): Promise<string> {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.request(
        parsed,
        {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(body)
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private _httpGet(targetUrl: string, bearerToken: string): Promise<string> {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.request(
        parsed,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Accept': 'application/json'
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
  }
}
