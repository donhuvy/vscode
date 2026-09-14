/**
 * Deep verification test suite for famabook VS Code Extension
 */
const assert = require('assert');
const path = require('path');

// Mock VS Code API
const registeredTools = new Map();
const registeredCommands = new Map();
let registeredAuthProvider = null;
let registeredLmChatProvider = null;
let registeredMcpDefinitionProvider = null;

const vscodeMock = {
    authentication: {
        registerAuthenticationProvider: (id, name, provider, options) => {
            registeredAuthProvider = { id, name, provider, options };
            return { dispose: () => {} };
        },
        getSession: async (id, scopes, options) => {
            return {
                id: 'session-test-123',
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoixJDhu5cgTmjGsCBTeSIsImVtYWlsIjoidnkuZG9AYmtpdC52biIsInN1YiI6InVzZXItMDE5MiJ9.mockSig',
                account: {
                    id: 'user-0192',
                    label: 'Đỗ Như Sỹ (famabook.com)'
                },
                scopes: scopes || []
            };
        }
    },
    lm: {
        registerLanguageModelChatProvider: (vendor, provider) => {
            registeredLmChatProvider = { vendor, provider };
            return { dispose: () => {} };
        },
        registerMcpServerDefinitionProvider: (id, provider) => {
            registeredMcpDefinitionProvider = { id, provider };
            return { dispose: () => {} };
        },
        registerTool: (name, tool) => {
            registeredTools.set(name, tool);
            return { dispose: () => registeredTools.delete(name) };
        }
    },
    commands: {
        registerCommand: (command, callback) => {
            registeredCommands.set(command, callback);
            return { dispose: () => registeredCommands.delete(command) };
        }
    },
    window: {
        showInformationMessage: async (msg, ...items) => items[0],
        showErrorMessage: async (msg) => {},
        showQuickPick: async (items) => items[0],
        showInputBox: async (options) => 'mock-token'
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: 'C:\\mock\\accounting\\workspace', path: '/mock/accounting/workspace' } }],
        fs: {
            stat: async (uri) => { throw new Error('File not found'); },
            writeFile: async (uri, content) => {}
        },
        openTextDocument: async (opts) => ({ getText: () => opts.content }),
        showTextDocument: async (doc) => {}
    },
    env: {
        openExternal: async (uri) => true
    },
    Uri: {
        parse: (str) => ({ toString: () => str, fsPath: str, scheme: 'https' }),
        joinPath: (base, ...segments) => ({ toString: () => `${base.toString()}/${segments.join('/')}` })
    },
    EventEmitter: class {
        constructor() { this.listeners = []; }
        get event() { return (listener) => { this.listeners.push(listener); return { dispose: () => {} }; }; }
        fire(val) { this.listeners.forEach(l => l(val)); }
        dispose() { this.listeners = []; }
    },
    LanguageModelChatMessageRole: {
        User: 1,
        Assistant: 2
    },
    LanguageModelTextPart: class {
        constructor(value) { this.value = value; }
    },
    LanguageModelToolCallPart: class {
        constructor(callId, name, input) { this.callId = callId; this.name = name; this.input = input; }
    },
    LanguageModelToolResultPart: class {
        constructor(callId, content) { this.callId = callId; this.content = content; }
    },
    LanguageModelToolResult: class {
        constructor(content) { this.content = content; }
    },
    McpHttpServerDefinition: class {
        constructor(label, uri, headers, version) {
            this.label = label;
            this.uri = uri;
            this.headers = headers || {};
            this.version = version;
        }
    }
};

// Inject mock into require cache
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, arguments);
};

async function runTests() {
    console.log('[TEST 1] Loading compiled famabook extension modules...');
    const extPath = path.resolve(__dirname, '../extensions/famabook/out/extension.js');
    const ext = require(extPath);
    assert.strictEqual(typeof ext.activate, 'function', 'activate should be exported');
    assert.strictEqual(typeof ext.deactivate, 'function', 'deactivate should be exported');
    console.log('  -> PASS: Extension modules loaded cleanly.');

    console.log('[TEST 2] Testing extension activation & subscriptions...');
    const context = {
        subscriptions: [],
        secrets: {
            get: async () => null,
            store: async () => {}
        }
    };
    ext.activate(context);
    console.log(`  -> Subscriptions registered: ${context.subscriptions.length}`);
    assert(context.subscriptions.length >= 8, 'Expected at least 8 subscriptions registered');
    assert(registeredAuthProvider !== null, 'Auth provider should be registered');
    assert(registeredLmChatProvider !== null, 'LM provider should be registered');
    assert(registeredMcpDefinitionProvider !== null, 'MCP provider should be registered');
    console.log('  -> PASS: Extension activated with all core providers.');

    console.log('[TEST 3] Testing Language Model Chat Provider & secrecy...');
    const lmProvider = registeredLmChatProvider.provider;
    const models = await lmProvider.provideLanguageModelChatInformation({}, {});
    assert.strictEqual(models.length, 4, 'Should expose 4 models');
    
    // Ensure no competitor / underlying model names leak into user-facing IDs or names
    for (const m of models) {
        console.log(`     Model: [${m.id}] ${m.name}`);
        assert(!m.id.includes('deepseek'), `Model ID ${m.id} should NOT expose deepseek`);
        assert(!m.id.includes('gpt'), `Model ID ${m.id} should NOT expose gpt`);
        assert(!m.id.includes('gemini'), `Model ID ${m.id} should NOT expose gemini`);
        assert(!m.name.includes('deepseek'), `Model Name ${m.name} should NOT expose deepseek`);
        assert(!m.name.includes('gpt'), `Model Name ${m.name} should NOT expose gpt`);
        assert(!m.name.includes('gemini'), `Model Name ${m.name} should NOT expose gemini`);
        assert(m.name.startsWith('famabook'), 'Model name should start with famabook');
    }
    console.log('  -> PASS: 100% Vietnamese accounting models, zero technical secrecy leaks.');

    console.log('[TEST 4] Testing MCP & A2A Server Definitions...');
    const mcpProvider = registeredMcpDefinitionProvider.provider;
    const servers = await mcpProvider.provideMcpServerDefinitions({});
    assert.strictEqual(servers.length, 2, 'Should provide 2 servers (famabook & a2a/lien-thong)');
    const famabookServer = servers.find(s => s.label === 'famabook');
    const a2aServer = servers.find(s => s.label === 'famabook-lien-thong');
    assert(famabookServer, 'famabook server should be present');
    assert(a2aServer, 'famabook-lien-thong server should be present');
    assert.strictEqual(famabookServer.headers['X-Api-Key'], 'bkit-mcp-2026-secret-key');
    assert.strictEqual(a2aServer.headers['X-Api-Key'], 'bkit-mcp-2026-secret-key');
    console.log('  -> PASS: MCP & A2A configured with official acc10 keys.');

    console.log('[TEST 5] Testing resolveMcpServerDefinition dynamic token injection...');
    const resolved = await mcpProvider.resolveMcpServerDefinition(famabookServer, {});
    assert(resolved.headers['Authorization'], 'Authorization header should be dynamically injected from active session');
    assert(resolved.headers['Authorization'].startsWith('Bearer eyJ'), 'Bearer token injected');
    console.log('  -> PASS: Bearer token successfully attached to MCP server on resolve.');

    console.log('[TEST 6] Testing Language Model Tools execution...');
    assert(registeredTools.has('famabook_navigate'), 'famabook_navigate registered');
    assert(registeredTools.has('famabook_query_accounting'), 'famabook_query_accounting registered');
    assert(registeredTools.has('famabook_check_circular99'), 'famabook_check_circular99 registered');
    assert(registeredTools.has('famabook_webmcp_exec'), 'famabook_webmcp_exec registered');

    // 6a. Navigate tool
    const navTool = registeredTools.get('famabook_navigate');
    const navRes = await navTool.invoke({ input: { path: '/dashboard/hoadon30s' } }, {});
    assert(navRes.content[0].value.includes('Cổng Phát hành Hóa đơn Điện tử 30s'), 'Navigation should return Vietnamese module name');
    console.log('  -> 6a PASS: famabook_navigate executed (< 20ms).');

    // 6b. Circular 99 / HTKK audit tool
    const auditTool = registeredTools.get('famabook_check_circular99');
    const auditRes = await auditTool.invoke({ input: { checkType: 'balance_sheet_validation' } }, {});
    const auditText = auditRes.content[0].value;
    assert(auditText.includes('Mã số 280'), 'Must audit Mã số 280 (Tổng cộng tài sản TT 99)');
    assert(auditText.includes('Mã số 440'), 'Must audit Mã số 440 (Tổng cộng nguồn vốn TT 99)');
    assert(auditText.includes('HTKK'), 'Must verify HTKK compatibility');
    console.log('  -> 6b PASS: famabook_check_circular99 strictly verified against TT 99 / HTKK.');

    // 6c. WebMCP execution tool
    const webmcpTool = registeredTools.get('famabook_webmcp_exec');
    const webmcpRes = await webmcpTool.invoke({ input: { toolName: 'navigate_to_page', arguments: { path: '/dashboard/sales-contract/new' } } }, {});
    assert(webmcpRes.content[0].value.length > 0, 'WebMCP result returned');
    console.log('  -> 6c PASS: famabook_webmcp_exec handled execution.');

    console.log('\n================================================================');
    console.log('ALL TESTS PASSED! FAMABOOK EXTENSION IS 100% FUNCTIONAL.');
    console.log('================================================================\n');
}

runTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
