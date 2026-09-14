"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook / BKIT. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkitAuthenticationProvider = exports.AUTH_PROVIDER_NAME = exports.AUTH_PROVIDER_ID = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const url = __importStar(require("url"));
exports.AUTH_PROVIDER_ID = 'bkit';
exports.AUTH_PROVIDER_NAME = 'Tài khoản famabook.com';
const SECRET_KEY_SESSIONS = 'famabook.bkit.sessions';
class BkitAuthenticationProvider {
    _context;
    _onDidChangeSessions = new vscode.EventEmitter();
    onDidChangeSessions = this._onDidChangeSessions.event;
    _sessions = [];
    _disposables = [];
    constructor(_context) {
        this._context = _context;
        this._disposables.push(vscode.authentication.registerAuthenticationProvider(exports.AUTH_PROVIDER_ID, exports.AUTH_PROVIDER_NAME, this, { supportsMultipleAccounts: false }));
        this._loadSessions();
    }
    async _loadSessions() {
        try {
            const raw = await this._context.secrets.get(SECRET_KEY_SESSIONS);
            if (raw) {
                this._sessions = JSON.parse(raw);
            }
        }
        catch {
            this._sessions = [];
        }
    }
    async _saveSessions() {
        await this._context.secrets.store(SECRET_KEY_SESSIONS, JSON.stringify(this._sessions));
    }
    async getSessions(scopes) {
        await this._loadSessions();
        if (!scopes || scopes.length === 0) {
            return this._sessions.map(s => this._toAuthSession(s));
        }
        return this._sessions
            .filter(s => scopes.every(req => s.scopes.includes(req)))
            .map(s => this._toAuthSession(s));
    }
    _toAuthSession(s) {
        return {
            id: s.id,
            accessToken: s.accessToken,
            account: s.account,
            scopes: s.scopes
        };
    }
    async createSession(scopes) {
        const authUrl = process.env.FAMABOOK_AUTH_URL || 'https://auth.bkit.vn';
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
    async removeSession(sessionId) {
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
    async _startOAuthFlow(authBase, clientId, port, scopes) {
        const scopeStr = scopes.length > 0 ? scopes.join(' ') : 'openid profile email';
        const redirectUri = `http://localhost:${port}/callback`;
        const authorizeEndpoint = `${authBase}/realms/bkit/protocol/openid-connect/auth`;
        const tokenEndpoint = `${authBase}/realms/bkit/protocol/openid-connect/token`;
        const state = Math.random().toString(36).substring(2, 15);
        const loginUrl = `${authorizeEndpoint}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeStr)}&state=${encodeURIComponent(state)}`;
        return new Promise((resolve, reject) => {
            let server;
            let timeoutTimer;
            const cleanup = () => {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                }
                if (server) {
                    try {
                        server.close();
                    }
                    catch {
                        // ignore
                    }
                }
            };
            timeoutTimer = setTimeout(() => {
                cleanup();
                reject(new Error('Thời gian đăng nhập famabook.com đã hết hạn (120 giây). Vui lòng thử lại.'));
            }, 120000);
            server = http.createServer(async (req, res) => {
                try {
                    const parsed = url.parse(req.url || '', true);
                    if (parsed.pathname === '/callback' || parsed.pathname === '/') {
                        const code = parsed.query.code;
                        const returnedState = parsed.query.state;
                        if (!code || returnedState !== state) {
                            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end('<h3>Xác thực không thành công. Vui lòng thử lại.</h3>');
                            cleanup();
                            reject(new Error('Mã phản hồi xác thực không hợp lệ.'));
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
                                throw new Error(`Đăng nhập không thành công: ${tokenRes.status}`);
                            }
                            const tokenData = await tokenRes.json();
                            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(`
								<!DOCTYPE html>
								<html>
								<head><meta charset="utf-8"><title>famabook.com - Đăng nhập thành công</title>
								<style>
									body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534; }
									.card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; }
									h1 { color: #15803d; margin-bottom: 12px; }
								</style>
								</head>
								<body>
									<div class="card">
										<h1>Đăng nhập famabook.com thành công!</h1>
										<p>Kế toán viên có thể đóng tab này và bắt đầu làm việc ngay.</p>
									</div>
								</body>
								</html>
							`);
                            cleanup();
                            let accountantName = 'Kế toán viên (famabook.com)';
                            let accountId = 'famabook-accountant';
                            try {
                                const tokenParts = tokenData.access_token.split('.');
                                if (tokenParts.length >= 2) {
                                    const payloadJson = Buffer.from(tokenParts[1], 'base64').toString('utf8');
                                    const payload = JSON.parse(payloadJson);
                                    if (payload.name) {
                                        accountantName = `${payload.name} (famabook.com)`;
                                    }
                                    else if (payload.preferred_username) {
                                        accountantName = `${payload.preferred_username} (famabook.com)`;
                                    }
                                    else if (payload.email) {
                                        accountantName = `${payload.email} (famabook.com)`;
                                    }
                                    if (payload.sub) {
                                        accountId = payload.sub;
                                    }
                                }
                            }
                            catch {
                                // Giữ nguyên nhãn mặc định
                            }
                            const stored = {
                                id: 'famabook-' + Date.now(),
                                accessToken: tokenData.access_token,
                                account: {
                                    id: accountId,
                                    label: accountantName
                                },
                                scopes: scopes.length > 0 ? scopes : ['openid', 'profile', 'email']
                            };
                            resolve(stored);
                        }
                        catch (tokenErr) {
                            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(`<h3>Lỗi đăng nhập: ${tokenErr.message}</h3>`);
                            cleanup();
                            reject(tokenErr);
                        }
                    }
                }
                catch (err) {
                    cleanup();
                    reject(err);
                }
            });
            server.listen(port, () => {
                vscode.env.openExternal(vscode.Uri.parse(loginUrl));
            });
            server.on('error', (e) => {
                cleanup();
                // Fallback to manual token entry if port is in use
                vscode.window.showInputBox({
                    prompt: 'Không thể mở cổng tiếp nhận đăng nhập tự động. Kế toán viên có thể dán Mã truy cập famabook.com trực tiếp tại đây:',
                    password: true,
                    ignoreFocusOut: true
                }).then(token => {
                    if (token && token.trim()) {
                        resolve({
                            id: 'famabook-' + Date.now(),
                            accessToken: token.trim(),
                            account: {
                                id: 'famabook-accountant',
                                label: 'Kế toán viên (famabook.com)'
                            },
                            scopes: scopes
                        });
                    }
                    else {
                        reject(new Error(`Không thể khởi tạo cổng đăng nhập: ${e.message}`));
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
exports.BkitAuthenticationProvider = BkitAuthenticationProvider;
