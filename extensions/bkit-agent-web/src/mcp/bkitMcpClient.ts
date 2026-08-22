import * as https from 'https';
import { URL } from 'url';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class BkitMcpClient {
  private static readonly MCP_ENDPOINT = 'https://mcp.bkit.vn/mcp';

  constructor(private readonly getAccessToken: () => Promise<string | null>) {}

  public async listTools(): Promise<McpTool[]> {
    const token = await this.getAccessToken();
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {}
    };

    const res = await this._sendJsonRpc(payload, token);
    return res.result?.tools || [];
  }

  public async callTool(name: string, args: Record<string, any> = {}): Promise<McpToolCallResult> {
    const token = await this.getAccessToken();
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: name,
        arguments: args
      }
    };

    const res = await this._sendJsonRpc(payload, token);
    if (res.error) {
      throw new Error(`MCP Error (${res.error.code}): ${res.error.message}`);
    }

    return res.result || { content: [{ type: 'text', text: JSON.stringify(res) }] };
  }

  // Intelligent matching: matches user query to the best BKIT MCP Tool
  public async handleUserQuery(userQuery: string): Promise<string | null> {
    const q = userQuery.toLowerCase().trim();

    try {
      // 1. Hàng hóa / Vật tư / Kho
      if (q.includes('hàng hóa') || q.includes('vật tư') || q.includes('sản phẩm') || q.includes('kho')) {
        const res = await this.callTool('get_records', { entityName: 'InventoryItem', limit: 20 });
        return this._formatMcpOutput('Danh sách Hàng hóa & Vật tư (InventoryItem)', res);
      }

      // 2. Danh mục tài khoản kế toán (TT99/TT200)
      if (q.includes('tài khoản') || q.includes('định khoản') || q.includes('hệ thống tk')) {
        const res = await this.callTool('get_records', { entityName: 'AccountingAccount', limit: 20 });
        return this._formatMcpOutput('Hệ thống Tài khoản Kế toán (AccountingAccount)', res);
      }

      // 3. Khách hàng / Nhà cung cấp / Đối tác
      if (q.includes('khách hàng') || q.includes('nhà cung cấp') || q.includes('đối tác') || q.includes('bạn hàng')) {
        const res = await this.callTool('get_records', { entityName: 'Partner', limit: 20 });
        return this._formatMcpOutput('Danh sách Khách hàng & Nhà cung cấp (Partner)', res);
      }

      // 4. Hóa đơn bán / Doanh thu
      if (q.includes('hóa đơn bán') || q.includes('doanh thu') || q.includes('bán hàng')) {
        const res = await this.callTool('get_records', { entityName: 'SalesInvoice', limit: 10 });
        return this._formatMcpOutput('Danh sách Hóa đơn Bán hàng (SalesInvoice)', res);
      }

      // 5. Hóa đơn mua / Chi phí
      if (q.includes('hóa đơn mua') || q.includes('mua hàng') || q.includes('chi phí')) {
        const res = await this.callTool('get_records', { entityName: 'PurchaseInvoice', limit: 10 });
        return this._formatMcpOutput('Danh sách Hóa đơn Mua hàng (PurchaseInvoice)', res);
      }

      // 6. Tài sản cố định / CCDC
      if (q.includes('tài sản') || q.includes('tscđ') || q.includes('khấu hao')) {
        const res = await this.callTool('get_records', { entityName: 'FixedAsset', limit: 10 });
        return this._formatMcpOutput('Danh mục Tài sản Cố định (FixedAsset)', res);
      }

      // 7. Danh sách 256 bảng thực thể
      if (q.includes('danh sách bảng') || q.includes('thực thể') || q.includes('các bảng') || q.includes('entity')) {
        const res = await this.callTool('list_entities', {});
        return this._formatMcpOutput('Danh mục 256 Bảng Thực thể Kế toán', res);
      }

      // 8. Tra cứu Menu hệ thống / Mẫu biểu TT99
      if (q.includes('menu') || q.includes('mẫu biểu') || q.includes('báo cáo tài chính') || q.includes('b01') || q.includes('b02')) {
        const res = await this.callTool('search_system_menu', { query: userQuery });
        return this._formatMcpOutput('Tra cứu Menu & Mẫu biểu Báo cáo', res);
      }

      // 9. Dashboard tài chính
      if (q.includes('dashboard') || q.includes('tổng quan tài chính') || q.includes('tổng kết')) {
        const res = await this.callTool('view_financial_dashboard', {});
        return this._formatMcpOutput('Dashboard Tổng quan Tài chính BKIT', res);
      }

      // 10. Link tải phần mềm thuế
      if (q.includes('tải') || q.includes('htkk') || q.includes('phần mềm thuế') || q.includes('itaxviewer')) {
        const res = await this.callTool('get_application_downloads', {});
        return this._formatMcpOutput('Danh sách Tải Phần mềm Thuế & Chữ ký số', res);
      }

      // Default: Search across records
      const searchRes = await this.callTool('search_records', { query: userQuery, limit: 10 });
      return this._formatMcpOutput(`Kết quả tra cứu CSDL cho "${userQuery}"`, searchRes);
    } catch (err: any) {
      return `❌ **Lỗi gọi BKIT MCP Server (https://mcp.bkit.vn/mcp)**: ${err.message}`;
    }
  }

  private _formatMcpOutput(title: string, result: McpToolCallResult): string {
    const rawText = result.content?.map(c => c.text).join('\n') || '';
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.data && Array.isArray(parsed.data)) {
        if (parsed.data.length === 0) {
          return `### 📊 ${title}\n\n*Hiện tại chưa có bản ghi nào trong bảng dữ liệu này trên hệ thống ERP.* (Tổng số: \`${parsed.totalCount || 0}\` bản ghi).`;
        }

        // Format as Markdown table
        const firstItem = parsed.data[0];
        const headers = Object.keys(firstItem).slice(0, 7); // Show first 7 columns for clean layout
        let table = `### 📊 ${title} (Tổng số: ${parsed.totalCount || parsed.data.length} bản ghi)\n\n`;
        table += `| ${headers.join(' | ')} |\n`;
        table += `| ${headers.map(() => '---').join(' | ')} |\n`;

        for (const row of parsed.data) {
          const vals = headers.map(h => {
            const v = row[h];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return String(v).replace(/\|/g, '\\|');
          });
          table += `| ${vals.join(' | ')} |\n`;
        }

        return table;
      }

      // If generic JSON object
      return `### 📊 ${title}\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      return `### 📊 ${title}\n\n${rawText}`;
    }
  }

  private _sendJsonRpc(payload: any, token: string | null): Promise<any> {
    const postData = JSON.stringify(payload);
    const parsed = new URL(BkitMcpClient.MCP_ENDPOINT);

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(postData).toString()
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = https.request(
        parsed,
        {
          method: 'POST',
          headers: headers
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              return;
            }

            // Handle SSE format: "event: message\ndata: {...}"
            if (data.includes('data: ')) {
              const lines = data.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.substring(6));
                    resolve(json);
                    return;
                  } catch {}
                }
              }
            }

            // Standard JSON
            try {
              resolve(JSON.parse(data));
            } catch (err: any) {
              reject(new Error(`Không thể phân tích phản hồi MCP: ${err.message}`));
            }
          });
          res.on('error', reject);
        }
      );

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
}
