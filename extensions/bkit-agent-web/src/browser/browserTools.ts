import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export class BrowserTools {
  public static async fetchWebPage(targetUrl: string): Promise<string> {
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const requestModule = isHttps ? https : http;

      return await new Promise((resolve, reject) => {
        const req = requestModule.get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 BKIT-Agent/1.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              // Follow redirect
              BrowserTools.fetchWebPage(res.headers.location).then(resolve).catch(reject);
              return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              // Basic HTML text extraction
              const textContent = BrowserTools._extractReadableText(data);
              resolve(textContent);
            });
            res.on('error', reject);
          }
        );

        req.on('error', reject);
        req.setTimeout(15000, () => {
          req.destroy();
          reject(new Error('Hết thời gian tải trang (Timeout 15s).'));
        });
      });
    } catch (err: any) {
      return `Không thể tải trang web: ${err.message}`;
    }
  }

  public static async openInIntegratedBrowser(url: string): Promise<void> {
    const validUrl = url.startsWith('http') ? url : `https://${url}`;
    await vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(validUrl));
  }

  private static _extractReadableText(html: string): string {
    // Remove script and style tags
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Replace breaks and paragraphs with newlines
    clean = clean.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
    clean = clean.replace(/<br\s*[\/]?>/gi, '\n');
    // Strip remaining tags
    clean = clean.replace(/<[^>]+>/g, ' ');
    // Decode basic entities
    clean = clean.replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    // Normalize spaces
    clean = clean.replace(/[ \t]+/g, ' ');
    clean = clean.replace(/\n\s*\n/g, '\n\n').trim();
    // Truncate to reasonable context length
    return clean.slice(0, 15000);
  }
}
