/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const LM_VENDOR_ID = 'famabook';

// Internal backend credentials (hidden from end-user UI)
const DEFAULT_API_BASE_URL = 'https://model.bkit.vn/v1';
const DEFAULT_API_SECRET_KEY = 'sk-bkit_deepseek_super_key_2026';

interface ChatModelDefinition extends vscode.LanguageModelChatInformation {
	readonly modelName: string;
}

const AVAILABLE_MODELS: ChatModelDefinition[] = [
	{
		id: 'famabook-ke-toan',
		name: 'famabook Trí tuệ Kế toán & Nghiệp vụ',
		family: 'famabook-accounting',
		tooltip: 'Trợ lý nghiệp vụ chuyên sâu về kế toán doanh nghiệp, tự động định khoản Nợ/Có, xử lý chứng từ hóa đơn, bán hàng, mua hàng và kho.',
		version: '1.0',
		modelName: 'deepseek-chat',
		capabilities: {
			toolCalling: true,
			imageInput: false
		},
		maxInputTokens: 64000,
		maxOutputTokens: 8192
	},
	{
		id: 'famabook-kiem-toan',
		name: 'famabook Chuyên gia Kiểm toán & Đối soát Thuế (TT 99)',
		family: 'famabook-audit',
		tooltip: 'Trợ lý tư duy phân tích chuyên sâu cho kế toán trưởng: rà soát Báo cáo tài chính theo Thông tư 99/2025/TT-BTC, lập quyết toán thuế, phát hiện sai lệch số liệu.',
		version: '1.0',
		modelName: 'deepseek-reasoner',
		capabilities: {
			toolCalling: true,
			imageInput: false
		},
		maxInputTokens: 64000,
		maxOutputTokens: 8192
	},
	{
		id: 'famabook-doc-chung-tu',
		name: 'famabook Trợ lý Đọc hiểu Chứng từ & Hóa đơn',
		family: 'famabook-ocr',
		tooltip: 'Trợ lý nhận diện và đọc hiểu tự động nội dung hóa đơn điện tử, sao kê ngân hàng, hợp đồng kinh tế và hình ảnh chứng từ đính kèm.',
		version: '1.0',
		modelName: 'gpt-4o',
		capabilities: {
			toolCalling: true,
			imageInput: true
		},
		maxInputTokens: 128000,
		maxOutputTokens: 8192
	},
	{
		id: 'famabook-tra-cuu-nhanh',
		name: 'famabook Trợ lý Tra cứu Nhanh Danh mục',
		family: 'famabook-lookup',
		tooltip: 'Trợ lý tra cứu nhanh mục lục ngân sách, hệ thống tài khoản kế toán, văn bản quy phạm pháp luật và danh mục vật tư hàng hóa.',
		version: '1.0',
		modelName: 'gemini-2.0-flash',
		capabilities: {
			toolCalling: true,
			imageInput: true
		},
		maxInputTokens: 128000,
		maxOutputTokens: 8192
	}
];

export class BkitLanguageModelChatProvider implements vscode.LanguageModelChatProvider, vscode.Disposable {
	private readonly _onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();
	readonly onDidChangeLanguageModelChatInformation = this._onDidChangeLanguageModelChatInformation.event;

	private readonly _disposable: vscode.Disposable;

	constructor() {
		this._disposable = vscode.lm.registerLanguageModelChatProvider(LM_VENDOR_ID, this);
	}

	async provideLanguageModelChatInformation(
		_options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatInformation[]> {
		return AVAILABLE_MODELS;
	}

	async provideTokenCount(
		_model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken
	): Promise<number> {
		if (typeof text === 'string') {
			return Math.ceil(text.length / 3.8);
		}
		let len = 0;
		for (const part of text.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				len += part.value.length;
			}
		}
		return Math.ceil(len / 3.8);
	}

	async provideLanguageModelChatResponse(
		model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken
	): Promise<void> {
		const baseUrl = process.env.FAMABOOK_API_URL || DEFAULT_API_BASE_URL;
		const apiKey = process.env.FAMABOOK_API_KEY || DEFAULT_API_SECRET_KEY;

		const targetModelDef = AVAILABLE_MODELS.find(m => m.id === model.id);
		const backendModelName = targetModelDef ? targetModelDef.modelName : (model.id || 'deepseek-chat');

		const formattedMessages = this._formatMessages(messages);
		const formattedTools = this._formatTools(options.tools);

		const requestPayload: Record<string, any> = {
			model: backendModelName,
			messages: formattedMessages,
			stream: true
		};

		if (formattedTools && formattedTools.length > 0) {
			requestPayload.tools = formattedTools;
			requestPayload.tool_choice = 'auto';
		}

		const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
		const abortController = new AbortController();

		const cancellationListener = token.onCancellationRequested(() => {
			abortController.abort();
		});

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestPayload),
				signal: abortController.signal
			});

			if (!res.ok) {
				const errText = await res.text();
				throw new Error(`famabook.com: Không thể kết nối trợ lý (${res.status}): ${errText}`);
			}

			if (!res.body) {
				throw new Error('famabook.com: Máy chủ phản hồi trống');
			}

			await this._streamSse(res.body, progress);
		} finally {
			cancellationListener.dispose();
		}
	}

	private _formatMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): any[] {
		const result: any[] = [];

		for (const msg of messages) {
			let role = 'user';
			if (msg.role === vscode.LanguageModelChatMessageRole.Assistant) {
				role = 'assistant';
			} else if (msg.role === vscode.LanguageModelChatMessageRole.User) {
				role = 'user';
			}

			let textContent = '';
			const toolCalls: any[] = [];
			const toolResults: any[] = [];

			for (const part of msg.content) {
				if (part instanceof vscode.LanguageModelTextPart) {
					textContent += part.value;
				} else if (part instanceof vscode.LanguageModelToolCallPart) {
					toolCalls.push({
						id: part.callId,
						type: 'function',
						function: {
							name: part.name,
							arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input)
						}
					});
				} else if (part instanceof vscode.LanguageModelToolResultPart) {
					let resultStr = '';
					for (const sub of part.content) {
						if (sub instanceof vscode.LanguageModelTextPart) {
							resultStr += sub.value;
						} else if (typeof sub === 'string') {
							resultStr += sub;
						} else {
							resultStr += JSON.stringify(sub);
						}
					}
					toolResults.push({
						role: 'tool',
						tool_call_id: part.callId,
						content: resultStr
					});
				}
			}

			if (toolResults.length > 0) {
				for (const tr of toolResults) {
					result.push(tr);
				}
			} else {
				const item: any = { role, content: textContent };
				if (toolCalls.length > 0) {
					item.tool_calls = toolCalls;
				}
				result.push(item);
			}
		}

		return result;
	}

	private _formatTools(tools: readonly vscode.LanguageModelChatTool[] | undefined): any[] | undefined {
		if (!tools || tools.length === 0) {
			return undefined;
		}

		return tools.map(t => ({
			type: 'function',
			function: {
				name: t.name,
				description: t.description,
				parameters: t.inputSchema || { type: 'object', properties: {} }
			}
		}));
	}

	private async _streamSse(
		stream: ReadableStream<Uint8Array>,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		const pendingToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
		let inThinkingBlock = false;

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith(':')) {
					continue;
				}
				if (trimmed === 'data: [DONE]') {
					break;
				}
				if (trimmed.startsWith('data: ')) {
					const jsonStr = trimmed.slice(6);
					try {
						const chunk = JSON.parse(jsonStr);
						const choice = chunk.choices?.[0];
						if (!choice) {
							continue;
						}

						const delta = choice.delta;
						if (!delta) {
							continue;
						}

						// Handle thinking/reasoning for DeepSeek R1
						if (delta.reasoning_content) {
							if (!inThinkingBlock) {
								inThinkingBlock = true;
								progress.report(new vscode.LanguageModelTextPart('> **[famabook - Đang phân tích sổ sách & nghiệp vụ kế toán]:**\n> '));
							}
							const formattedReasoning = delta.reasoning_content.replace(/\n/g, '\n> ');
							progress.report(new vscode.LanguageModelTextPart(formattedReasoning));
						}

						// Handle content text
						if (delta.content) {
							if (inThinkingBlock) {
								inThinkingBlock = false;
								progress.report(new vscode.LanguageModelTextPart('\n\n---\n\n'));
							}
							progress.report(new vscode.LanguageModelTextPart(delta.content));
						}

						// Handle tool_calls
						if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
							for (const tc of delta.tool_calls) {
								const idx = tc.index ?? 0;
								let existing = pendingToolCalls.get(idx);
								if (!existing) {
									existing = { id: tc.id || `call_${Date.now()}_${idx}`, name: tc.function?.name || '', args: '' };
									pendingToolCalls.set(idx, existing);
								}
								if (tc.id) {
									existing.id = tc.id;
								}
								if (tc.function?.name) {
									existing.name = tc.function.name;
								}
								if (tc.function?.arguments) {
									existing.args += tc.function.arguments;
								}
							}
						}

						// Check finish_reason
						if (choice.finish_reason === 'tool_calls' || (choice.finish_reason && pendingToolCalls.size > 0)) {
							for (const [_idx, call] of pendingToolCalls.entries()) {
								let parsedArgs = {};
								try {
									parsedArgs = call.args ? JSON.parse(call.args) : {};
								} catch {
									parsedArgs = { raw: call.args };
								}
								progress.report(new vscode.LanguageModelToolCallPart(call.id, call.name, parsedArgs));
							}
							pendingToolCalls.clear();
						}
					} catch {
						// Non-fatal chunk parse error
					}
				}
			}
		}

		if (pendingToolCalls.size > 0) {
			for (const [_idx, call] of pendingToolCalls.entries()) {
				let parsedArgs = {};
				try {
					parsedArgs = call.args ? JSON.parse(call.args) : {};
				} catch {
					parsedArgs = { raw: call.args };
				}
				progress.report(new vscode.LanguageModelToolCallPart(call.id, call.name, parsedArgs));
			}
			pendingToolCalls.clear();
		}
	}

	dispose() {
		this._disposable.dispose();
		this._onDidChangeLanguageModelChatInformation.dispose();
	}
}
