"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Famabook. All rights reserved.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const authProvider_1 = require("./authProvider");
const lmChatProvider_1 = require("./lmChatProvider");
const mcpProvider_1 = require("./mcpProvider");
const tools_1 = require("./tools");
function activate(context) {
    // 1. Khởi tạo dịch vụ Đăng nhập Tài khoản famabook
    const authProvider = new authProvider_1.BkitAuthenticationProvider(context);
    context.subscriptions.push(authProvider);
    // 2. Khởi tạo Trợ lý Trí tuệ Kế toán famabook
    const lmProvider = new lmChatProvider_1.BkitLanguageModelChatProvider();
    context.subscriptions.push(lmProvider);
    // 3. Khởi tạo Cổng Liên thông Dữ liệu Sổ sách famabook
    const mcpProvider = new mcpProvider_1.FamabookMcpServerDefinitionProvider();
    context.subscriptions.push(mcpProvider);
    // 4. Đăng ký các công cụ trợ lý kế toán chuyên nghiệp
    (0, tools_1.registerFamabookTools)(context);
    // 5. Đăng ký các lệnh tiện ích giao diện Tiếng Việt cho kế toán viên
    context.subscriptions.push(vscode.commands.registerCommand('famabook.login', async () => {
        try {
            const session = await vscode.authentication.getSession('bkit', ['openid', 'profile', 'email'], { createIfNone: true });
            if (session) {
                vscode.window.showInformationMessage(`famabook.com: Đăng nhập thành công với tài khoản "${session.account.label}".`);
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`famabook.com: Quá trình đăng nhập không hoàn tất: ${err.message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('famabook.openDashboard', () => {
        vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard'));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('famabook.openHoadon30s', () => {
        vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard/hoadon30s'));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('famabook.openAccountingAccounts', () => {
        vscode.env.openExternal(vscode.Uri.parse('https://famabook.com/dashboard/accounting-account'));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('famabook.validateCircular99', async () => {
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
                const text = result.content.map(c => c.value || '').join('\n');
                vscode.window.showInformationMessage('famabook: Rà soát hoàn tất. Xem báo cáo chi tiết trong tab Thông báo.');
                const doc = await vscode.workspace.openTextDocument({
                    content: text,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        }
    }));
    // Tự động kiểm tra và khởi tạo file cấu hình tiền định cho thư mục làm việc
    _ensureWorkspaceAccountingConfig();
}
async function _ensureWorkspaceAccountingConfig() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    const rootUri = folders[0].uri;
    const mcpJsonUri = vscode.Uri.joinPath(rootUri, '.mcp.json');
    try {
        await vscode.workspace.fs.stat(mcpJsonUri);
    }
    catch {
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
        }
        catch {
            // Bỏ qua nếu workspace chỉ đọc
        }
    }
}
function deactivate() { }
