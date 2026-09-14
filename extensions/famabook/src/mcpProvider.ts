/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook / BKIT. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const MCP_PROVIDER_ID = 'famabook-mcp-servers';

export class FamabookMcpServerDefinitionProvider implements vscode.McpServerDefinitionProvider, vscode.Disposable {
	private readonly _onDidChangeMcpServerDefinitions = new vscode.EventEmitter<void>();
	readonly onDidChangeMcpServerDefinitions = this._onDidChangeMcpServerDefinitions.event;

	private readonly _disposable: vscode.Disposable;

	constructor() {
		this._disposable = vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, this);
	}

	async provideMcpServerDefinitions(_token: vscode.CancellationToken): Promise<vscode.McpServerDefinition[]> {
		const mcpUrl = process.env.FAMABOOK_MCP_URL || 'https://mcp.famabook.com/mcp';
		const a2aUrl = process.env.FAMABOOK_A2A_URL || 'https://a2a.famabook.com';
		const mcpKey = process.env.FAMABOOK_MCP_KEY || 'bkit-mcp-2026-secret-key';

		const famabookServer = new vscode.McpHttpServerDefinition(
			'famabook',
			vscode.Uri.parse(mcpUrl),
			{
				'X-Api-Key': mcpKey,
				'Accept': 'application/json, text/event-stream',
				'User-Agent': 'Famabook-Accounting-Agent/1.0'
			},
			'2026.08.30'
		);

		const a2aServer = new vscode.McpHttpServerDefinition(
			'famabook-lien-thong',
			vscode.Uri.parse(a2aUrl),
			{
				'X-Api-Key': mcpKey,
				'Authorization': `Bearer ${mcpKey}`,
				'Accept': 'application/json',
				'User-Agent': 'Famabook-Accounting-Agent/1.0'
			},
			'1.0.0'
		);

		return [famabookServer, a2aServer];
	}

	async resolveMcpServerDefinition(server: vscode.McpServerDefinition, _token: vscode.CancellationToken): Promise<vscode.McpServerDefinition> {
		if (server instanceof vscode.McpHttpServerDefinition) {
			try {
				const session = await vscode.authentication.getSession('bkit', ['openid', 'profile', 'email'], { createIfNone: false });
				if (session && session.accessToken) {
					server.headers = {
						...server.headers,
						'Authorization': `Bearer ${session.accessToken}`
					};
				}
			} catch {
				// Continue with default configuration
			}
		}
		return server;
	}

	refresh(): void {
		this._onDidChangeMcpServerDefinitions.fire();
	}

	dispose() {
		this._disposable.dispose();
		this._onDidChangeMcpServerDefinitions.dispose();
	}
}
