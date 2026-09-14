/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook / BKIT. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';

export const AUTH_PROVIDER_ID = 'bkit';
export const AUTH_PROVIDER_NAME = 'BKIT Auth';
const SECRET_KEY_SESSIONS = 'famabook.bkit.sessions';

interface StoredSession {
	id: string;
	accessToken: string;
	account: {
		label: string;
		id: string;
	};
	scopes: string[];
}

export class BkitAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private _sessions: StoredSession[] = [];
	private readonly _disposables: vscode.Disposable[] = [];

	constructor(private readonly _context: vscode.ExtensionContext) {
		this._disposables.push(
			vscode.authentication.registerAuthenticationProvider(
				AUTH_PROVIDER_ID,
				AUTH_PROVIDER_NAME,
				this,
				{ supportsMultipleAccounts: false }
			)
		);
		this._loadSessions();
	}

	private async _loadSessions(): Promise<void> {
		try {
			const raw = await this._context.secrets.get(SECRET_KEY_SESSIONS);
			if (raw) {
				this._sessions = JSON.parse(raw);
			}
		} catch {
			this._sessions = [];
		}
	}

	private async _saveSessions(): Promise<void> {
		await this._context.secrets.store(SECRET_KEY_SESSIONS, JSON.stringify(this._sessions));
	}

	async getSessions(scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
		await this._loadSessions();
		if (!scopes || scopes.length === 0) {
			return this._sessions.map(s => this._toAuthSession(s));
		}
		return this._sessions
			.filter(s => scopes.every(req => s.scopes.includes(req)))
			.map(s => this._toAuthSession(s));
	}

	private _toAuthSession(s: StoredSession): vscode.AuthenticationSession {
		return {
			id: s.id,
			accessToken: s.accessToken,
			account: s.account,
			scopes: s.scopes
		};
	}

	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		const config = vscode.workspace.getConfiguration('famabook');
		const authUrl = config.get<string>('authUrl', 'https://auth.bkit.vn');
		const clientId = 'mcp';
		const callbackPort = 8080;

		const session = await this._startOAuthFlow(authUrl, clientId, callbackPort, Array.from(scopes));
		this._sessions = [session];
		await this._saveSessions();

		this._onDidChangeSessions.fire({
			added: [this._toAuthSession(session)],
			removed: [],
			changed: []
		});

		return this._toAuthSession(session);
	}

	async removeSession(sessionId: string): Promise<void> {
		const idx = this._sessions.findIndex(s => s.id === sessionId);
		if (idx >= 0) {
			const removed = this._sessions.splice(idx, 1);
			await this._saveSessions();
			this._onDidChangeSessions.fire({
				added: [],
				removed: removed.map(s => this._toAuthSession(s)),
				changed: []
			});
		}
	}

	private async _startOAuthFlow(authBase: string, clientId: string, port: number, scopes: string[]): Promise<StoredSession> {
		const scopeStr = scopes.length > 0 ? scopes.join(' ') : 'openid profile email';
		const redirectUri = `http://localhost:${port}/callback`;
		const authorizeEndpoint = `${authBase}/realms/bkit/protocol/openid-connect/auth`;
		const tokenEndpoint = `${authBase}/realms/bkit/protocol/openid-connect/token`;

		const state = Math.random().toString(36).substring(2, 15);
		const loginUrl = `${authorizeEndpoint}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeStr)}&state=${encodeURIComponent(state)}`;

		return new Promise<StoredSession>((resolve, reject) => {
			let server: http.Server | undefined;
			let timeoutTimer: NodeJS.Timeout | undefined;

			const cleanup = () => {
				if (timeoutTimer) {
					clearTimeout(timeoutTimer);
				}
				if (server) {
					try {
						server.close();
					} catch {
						// ignore
					}
				}
			};

			timeoutTimer = setTimeout(() => {
				cleanup();
				reject(new Error('BKIT authentication timed out (120s).'));
			}, 120000);

			server = http.createServer(async (req, res) => {
				try {
					const parsed = url.parse(req.url || '', true);
					if (parsed.pathname === '/callback' || parsed.pathname === '/') {
						const code = parsed.query.code as string;
						const returnedState = parsed.query.state as string;

						if (!code || returnedState !== state) {
							res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
							res.end('<h3>Xác thực không thành công. Vui lòng thử lại.</h3>');
							cleanup();
							reject(new Error('Invalid OAuth response or state mismatch.'));
							return;
						}

						// Trade code for token
						const body = new URLSearchParams({
							grant_type: 'authorization_code',
							client_id: clientId,
							code: code,
							redirect_uri: redirectUri
						});

						try {
							const tokenRes = await fetch(tokenEndpoint, {
								method: 'POST',
								headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
								body: body.toString()
							});

							if (!tokenRes.ok) {
								const errText = await tokenRes.text();
								throw new Error(`Token request failed: ${tokenRes.status} ${errText}`);
							}

							const tokenData = await tokenRes.json() as { access_token: string; id_token?: string; refresh_token?: string };

							res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
							res.end(`
								<!DOCTYPE html>
								<html>
								<head><meta charset="utf-8"><title>famabook.com Đăng nhập thành công</title>
								<style>
									body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534; }
									.card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; }
									h1 { color: #15803d; margin-bottom: 12px; }
								</style>
								</head>
								<body>
									<div class="card">
										<h1>Đăng nhập BKIT / famabook.com thành công!</h1>
										<p>Bạn có thể đóng tab này và quay lại Visual Studio Code Agents.</p>
									</div>
								</body>
								</html>
							`);

							cleanup();

							const stored: StoredSession = {
								id: 'bkit-' + Date.now(),
								accessToken: tokenData.access_token,
								account: {
									id: 'bkit-user',
									label: 'Kế toán viên (famabook.com)'
								},
								scopes: scopes.length > 0 ? scopes : ['openid', 'profile', 'email']
							};

							resolve(stored);
						} catch (tokenErr: any) {
							res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
							res.end(`<h3>Lỗi trao đổi token: ${tokenErr.message}</h3>`);
							cleanup();
							reject(tokenErr);
						}
					}
				} catch (err: any) {
					cleanup();
					reject(err);
				}
			});

			server.listen(port, () => {
				vscode.env.openExternal(vscode.Uri.parse(loginUrl));
			});

			server.on('error', (e: any) => {
				cleanup();
				// Fallback to manual token entry if port is in use
				vscode.window.showInputBox({
					prompt: 'Không thể mở cổng 8080 cho OAuth callback. Bạn có thể dán Access Token BKIT trực tiếp tại đây:',
					password: true,
					ignoreFocusOut: true
				}).then(token => {
					if (token && token.trim()) {
						resolve({
							id: 'bkit-' + Date.now(),
							accessToken: token.trim(),
							account: {
								id: 'bkit-user',
								label: 'Kế toán viên BKIT'
							},
							scopes: scopes
						});
					} else {
						reject(new Error(`Failed to start loopback server on port ${port}: ${e.message}`));
					}
				});
			});
		});
	}

	dispose() {
		for (const d of this._disposables) {
			d.dispose();
		}
		this._onDidChangeSessions.dispose();
	}
}
