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
exports.FamabookMcpServerDefinitionProvider = exports.MCP_PROVIDER_ID = void 0;
const vscode = __importStar(require("vscode"));
exports.MCP_PROVIDER_ID = 'famabook-mcp-servers';
class FamabookMcpServerDefinitionProvider {
    _onDidChangeMcpServerDefinitions = new vscode.EventEmitter();
    onDidChangeMcpServerDefinitions = this._onDidChangeMcpServerDefinitions.event;
    _disposable;
    constructor() {
        this._disposable = vscode.lm.registerMcpServerDefinitionProvider(exports.MCP_PROVIDER_ID, this);
    }
    async provideMcpServerDefinitions(_token) {
        const mcpUrl = process.env.FAMABOOK_MCP_URL || 'https://mcp.famabook.com/mcp';
        const a2aUrl = process.env.FAMABOOK_A2A_URL || 'https://a2a.famabook.com';
        const mcpKey = process.env.FAMABOOK_MCP_KEY || 'bkit-mcp-2026-secret-key';
        const famabookServer = new vscode.McpHttpServerDefinition('famabook', vscode.Uri.parse(mcpUrl), {
            'X-Api-Key': mcpKey,
            'Accept': 'application/json, text/event-stream',
            'User-Agent': 'Famabook-Accounting-Agent/1.0'
        }, '2026.08.30');
        const a2aServer = new vscode.McpHttpServerDefinition('famabook-lien-thong', vscode.Uri.parse(a2aUrl), {
            'X-Api-Key': mcpKey,
            'Authorization': `Bearer ${mcpKey}`,
            'Accept': 'application/json',
            'User-Agent': 'Famabook-Accounting-Agent/1.0'
        }, '1.0.0');
        return [famabookServer, a2aServer];
    }
    async resolveMcpServerDefinition(server, _token) {
        if (server instanceof vscode.McpHttpServerDefinition) {
            try {
                const session = await vscode.authentication.getSession('bkit', ['openid', 'profile', 'email'], { createIfNone: false });
                if (session && session.accessToken) {
                    server.headers = {
                        ...server.headers,
                        'Authorization': `Bearer ${session.accessToken}`
                    };
                }
            }
            catch {
                // Continue with default configuration
            }
        }
        return server;
    }
    refresh() {
        this._onDidChangeMcpServerDefinitions.fire();
    }
    dispose() {
        this._disposable.dispose();
        this._onDidChangeMcpServerDefinitions.dispose();
    }
}
exports.FamabookMcpServerDefinitionProvider = FamabookMcpServerDefinitionProvider;
