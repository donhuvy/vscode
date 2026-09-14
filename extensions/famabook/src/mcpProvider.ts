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
		const config = vscode.workspace.getConfiguration('famabook');
		const mcpUrl = config.get<string>('mcpUrl', 'https://mcp.famabook.com/mcp');
		const a2aUrl = config.get<string>('a2aUrl', 'https://a2a.famabook.com');
		const a2aKey = config.get<string>('a2aKey', 'bkit-a2a-2026-secret-key');

		const famabookServer = new vscode.McpHttpServerDefinition(
			'famabook',
			vscode.Uri.parse(mcpUrl),
			{
				'Accept': 'application/json, text/event-stream',
				'User-Agent': 'Famabook-VSCode-Agent/1.0'
			},
			'2026.08.30'
		);

		const a2aServer = new vscode.McpHttpServerDefinition(
			'a2a',
			vscode.Uri.parse(a2aUrl),
			{
				'Authorization': `Bearer ${a2aKey}`,
				'Accept': 'application/json',
				'User-Agent': 'Famabook-A2A-Agent/1.0'
			},
			'1.0.0'
		);

		return [famabookServer, a2aServer];
	}

	async resolveMcpServerDefinition(server: vscode.McpServerDefinition, _token: vscode.CancellationToken): Promise<vscode.McpServerDefinition> {
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
