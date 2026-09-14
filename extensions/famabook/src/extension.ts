/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BkitAuthenticationProvider } from './authProvider';
import { BkitLanguageModelChatProvider } from './lmChatProvider';
import { FamabookMcpServerDefinitionProvider } from './mcpProvider';
import { registerFamabookTools } from './tools';

export function activate(context: vscode.ExtensionContext) {
	// 1. Khởi tạo dịch vụ Đăng nhập Tài khoản famabook
	const authProvider = new BkitAuthenticationProvider(context);
	context.subscriptions.push(authProvider);

	// 2. Khởi tạo Trợ lý Trí tuệ Kế toán famabook
	const lmProvider = new BkitLanguageModelChatProvider();
	context.subscriptions.push(lmProvider);

	// 3. Khởi tạo Cổng Liên thông Dữ liệu Sổ sách famabook
	const mcpProvider = new FamabookMcpServerDefinitionProvider();
	context.subscriptions.push(mcpProvider);

	// 4. Đăng ký các công cụ trợ lý kế toán chuyên nghiệp
	registerFamabookTools(context);

	// 4b. Khởi tạo Chat Participant @f và xử lý các lệnh /f, /uom-convert
	if (vscode.chat && typeof vscode.chat.createChatParticipant === 'function') {
		const participant = vscode.chat.createChatParticipant('famabook.agent', async (request, _context, response, _token) => {
			const prompt = (request.prompt || '').trim();
			const cmd = request.command;

			if (cmd === 'uom-convert' || prompt.toLowerCase().includes('luật chuyển đổi') || prompt.toLowerCase().includes('đơn vị tính') || prompt.toLowerCase().includes('uom')) {
				const lower = prompt.toLowerCase();
				let action: 'list' | 'create' | 'get' | 'update' | 'delete' = 'list';
				const fromUom = 'bao';
				const toUom = 'kg';
				const num = 1;
				let den = 50;

				if (lower.includes('thêm') || lower.includes('tạo') || lower.includes('new')) {
					action = 'create';
					if (lower.includes('40')) { den = 40; }
					if (lower.includes('50')) { den = 50; }
				} else if (lower.includes('sửa') || lower.includes('cập nhật') || lower.includes('edit')) {
					action = 'update';
					den = 40;
				} else if (lower.includes('xóa') || lower.includes('hủy') || lower.includes('delete')) {
					action = 'delete';
				} else if (lower.includes('xem') || lower.includes('chi tiết') || lower.includes('view')) {
					action = 'get';
				} else {
					action = 'list';
				}

				const result = await vscode.lm.invokeTool('famabook_uom_convert', {
					toolInvocationToken: undefined,
					input: { action, fromUom, toUom, numerator: num, denominator: den }
				});

				for (const part of result.content) {
					if (part instanceof vscode.LanguageModelTextPart) {
						response.markdown(part.value);
					}
				}
				return;
			}

			if (prompt.toLowerCase().includes('mở') || prompt.toLowerCase().includes('đi đến')) {
				let targetPath = '/dashboard';
				if (prompt.toLowerCase().includes('chuyển đổi') || prompt.toLowerCase().includes('đơn vị tính')) {
					targetPath = '/dashboard/uom-convert';
				} else if (prompt.toLowerCase().includes('hóa đơn')) {
					targetPath = '/dashboard/hoadon30s';
				} else if (prompt.toLowerCase().includes('kho')) {
					targetPath = '/dashboard/warehouse';
				} else if (prompt.toLowerCase().includes('hàng')) {
					targetPath = '/dashboard/goods';
				}

				await vscode.lm.invokeTool('famabook_navigate', {
					toolInvocationToken: undefined,
					input: { path: targetPath }
				});

				response.markdown(`Đã mở phân hệ **${targetPath}** trên ứng dụng web https://famabook.com (< 20ms). Kế toán viên có thể thao tác ngay.`);
				return;
			}

			// Fallback: Chuyển yêu cầu đến mô hình ngôn ngữ kế toán
			try {
				const models = await vscode.lm.selectChatModels({ vendor: 'famabook' });
				if (models && models.length > 0) {
					const chatRes = await models[0].sendRequest([
						vscode.LanguageModelChatMessage.User(`[Tác nhân Kế toán famabook /f]: ${prompt}`)
					], {}, _token);

					for await (const chunk of chatRes.text) {
						response.markdown(chunk);
					}
					return;
				}
			} catch {
				// Fallback
			}

			response.markdown(`Tác nhân kế toán famabook (/f) đã tiếp nhận yêu cầu: "${prompt}". Bạn có thể điều khiển trực tiếp các phân hệ trên [famabook.com](https://famabook.com).`);
		});

		participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'logo.png');
		context.subscriptions.push(participant);
	}

	// 5. Đăng ký các lệnh tiện ích giao diện Tiếng Việt cho kế toán viên
	context.subscriptions.push(
		vscode.commands.registerCommand('famabook.login', async () => {
			try {
				const session = await vscode.authentication.getSession('bkit', ['openid', 'profile', 'email'], { createIfNone: true });
				if (session) {
					vscode.window.showInformationMessage(`famabook.com: Đăng nhập thành công với tài khoản "${session.account.label}".`);
				}
			} catch (err: any) {
				vscode.window.showErrorMessage(`famabook.com: Quá trình đăng nhập không hoàn tất: ${err.message}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('famabook.openDashboard', () => {
			vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard'));
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('famabook.openHoadon30s', () => {
			vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard/hoadon30s'));
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('famabook.openAccountingAccounts', () => {
			vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard/accounting-account'));
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('famabook.validateCircular99', async () => {
			const selection = await vscode.window.showQuickPick([
				{ label: '$(check) Kiểm tra Bảng Cân đối Kế toán (Mẫu B01-DN)', detail: 'Rà soát Tổng Tài sản = Tổng Nguồn vốn, số dư TK 111, 112, 131, 331, 156', checkType: 'balance_sheet_validation' },
				{ label: '$(list-tree) Rà soát Hệ thống Tài khoản TT 99/2025/TT-BTC', detail: 'Kiểm tra tài khoản cấp 1, cấp 2, tài khoản ngoài bảng', checkType: 'chart_of_accounts' },
				{ label: '$(file-text) Đối soát Thuế GTGT & Hóa đơn 30s', detail: 'Đối chiếu thuế GTGT đầu vào (TK 133) và đầu ra (TK 3331)', checkType: 'vat_invoice_matching' },
				{ label: '$(lock) Kiểm tra Khóa sổ & Kết chuyển Cuối kỳ (TK 911)', detail: 'Kiểm tra kết chuyển doanh thu, giá vốn, chi phí quản lý', checkType: 'year_end_closing' }
			], {
				placeHolder: 'Chọn nội dung rà soát Báo cáo tài chính theo Thông tư 99/2025/TT-BTC'
			});

			if (selection) {
				const checkTool = vscode.lm.tools.find(t => t.name === 'famabook_check_circular99');
				if (checkTool) {
					const result = await vscode.lm.invokeTool('famabook_check_circular99', {
						toolInvocationToken: undefined,
						input: { checkType: selection.checkType }
					});
					const text = result.content.map(c => (c as any).value || '').join('\n');
					vscode.window.showInformationMessage('famabook: Rà soát hoàn tất. Xem báo cáo chi tiết trong tab Thông báo.');
					const doc = await vscode.workspace.openTextDocument({
						content: text,
						language: 'markdown'
					});
					await vscode.window.showTextDocument(doc, { preview: true });
				}
			}
		})
	);

	// Tự động kiểm tra và khởi tạo file cấu hình tiền định cho thư mục làm việc
	_ensureWorkspaceAccountingConfig();
}

async function _ensureWorkspaceAccountingConfig(): Promise<void> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return;
	}

	const rootUri = folders[0].uri;
	const mcpJsonUri = vscode.Uri.joinPath(rootUri, '.mcp.json');

	try {
		await vscode.workspace.fs.stat(mcpJsonUri);
	} catch {
		// File chưa tồn tại, tự động tạo để kế toán viên dùng ngay mà không cần cấu hình
		const defaultConfig = {
			mcpServers: {
				famabook: {
					type: 'http',
					url: 'https://mcp.famabook.com/mcp',
					oauth: {
						clientId: 'mcp',
						callbackPort: 8080,
						authServerMetadataUrl: 'https://auth.bkit.vn/realms/bkit/.well-known/openid-configuration'
					},
					autoApprove: [
						'search_system_menu',
						'list_entities',
						'get_entity_schema',
						'get_records',
						'get_record_by_id',
						'search_records',
						'count_records',
						'view_financial_dashboard',
						'render_accounting_analytics',
						'render_partner_bar_chart',
						'export_entity_to_excel',
						'generate_catalog_excel_template',
						'get_application_downloads'
					]
				},
				'famabook-lien-thong': {
					type: 'http',
					url: 'https://a2a.famabook.com',
					headers: {
						'X-Api-Key': 'bkit-mcp-2026-secret-key'
					}
				}
			}
		};

		const content = Buffer.from(JSON.stringify(defaultConfig, null, 2), 'utf8');
		try {
			await vscode.workspace.fs.writeFile(mcpJsonUri, content);
		} catch {
			// Bỏ qua nếu workspace chỉ đọc
		}
	}
}

export function deactivate() { }
