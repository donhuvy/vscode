param(
    [string]$OutputDir = "$PSScriptRoot\..\dist-famabook"
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================="
Write-Host "         famabook.com - TIEN TRINH DONG GOI PHAN MEM KE TOAN"
Write-Host "==============================================================================="

$repoRoot = (Get-Item "$PSScriptRoot\..").FullName

# 1. Tim trinh bien dich TypeScript
Write-Host ""
Write-Host "[1/5] Kiem tra trinh bien dich TypeScript..."
$tscPath = "$repoRoot\node_modules\typescript\bin\tsc"
if (-not (Test-Path $tscPath)) {
    $tscPath = "E:\source_code\acc10\frontend\node_modules\typescript\bin\tsc"
}
if (-not (Test-Path $tscPath)) {
    $cmd = Get-Command tsc -ErrorAction SilentlyContinue
    if ($cmd) {
        $tscPath = $cmd.Source
    }
}
if (-not (Test-Path $tscPath)) {
    throw "Khong tim thay trinh bien dich TypeScript."
}
Write-Host "       Da tim thay tsc tai: $tscPath"

# 2. Bien dich extensions/famabook
Write-Host ""
Write-Host "[2/5] Bien dich extensions/famabook..."
$famabookTsConfig = "$repoRoot\extensions\famabook\tsconfig.json"
& node $tscPath -p $famabookTsConfig
if ($LASTEXITCODE -ne 0) {
    throw "Bien dich extensions/famabook that bai voi ma loi $LASTEXITCODE."
}
Write-Host "       Bien dich extensions/famabook thanh cong (out/ da san sang)."

# 3. Kiem tra Logo va Bieu tuong Leafly Green f
Write-Host ""
Write-Host "[3/5] Kiem tra tai nguyen bieu tuong famabook..."
$icons = @(
    "$repoRoot\resources\win32\code.ico",
    "$repoRoot\resources\win32\code_150x150.png",
    "$repoRoot\resources\win32\code_70x70.png",
    "$repoRoot\resources\server\favicon.ico",
    "$repoRoot\resources\server\code-192.png",
    "$repoRoot\resources\server\code-512.png",
    "$repoRoot\resources\linux\code.png",
    "$repoRoot\extensions\famabook\media\logo.png",
    "$repoRoot\extensions\famabook\media\logo.svg"
)

foreach ($item in $icons) {
    if (Test-Path $item) {
        Write-Host "       [OK] $item"
    } else {
        Write-Warning "       [THIEU] $item"
    }
}

# 4. Tao thu muc dong goi cho ke toan vien
Write-Host ""
Write-Host "[4/5] Tao thu muc dong goi: $OutputDir..."
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Copy-Item -Path "$repoRoot\Khoi-Dong-Famabook.bat" -Destination "$OutputDir\" -Force
if (Test-Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md") {
    Copy-Item -Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md" -Destination "$OutputDir\" -Force
}

# Sao chep extension famabook vao goi phan phoi
$distExtDir = "$OutputDir\extensions\famabook"
if (-not (Test-Path $distExtDir)) {
    New-Item -ItemType Directory -Path $distExtDir -Force | Out-Null
}
Copy-Item -Path "$repoRoot\extensions\famabook\package.json" -Destination "$distExtDir\" -Force
Copy-Item -Path "$repoRoot\extensions\famabook\out" -Destination "$distExtDir\" -Recurse -Force
Copy-Item -Path "$repoRoot\extensions\famabook\media" -Destination "$distExtDir\" -Recurse -Force
if (Test-Path "$repoRoot\extensions\famabook\skills") {
    Copy-Item -Path "$repoRoot\extensions\famabook\skills" -Destination "$distExtDir\" -Recurse -Force
}

# 5. Thiet lap moi truong lam viec ke toan mau
Write-Host ""
Write-Host "[5/5] Thiet lap thu muc lam viec ke toan tien dinh..."
$sampleDir = "$OutputDir\Du-Lieu-Ke-Toan-Mau"
if (-not (Test-Path $sampleDir)) {
    New-Item -ItemType Directory -Path $sampleDir -Force | Out-Null
}

# .mcp.json tien cau hinh
$mcpConfigContent = @'
{
  "mcpServers": {
    "famabook": {
      "type": "http",
      "url": "https://mcp.famabook.com/mcp",
      "oauth": {
        "clientId": "mcp",
        "callbackPort": 8080,
        "authServerMetadataUrl": "https://auth.bkit.vn/realms/bkit/.well-known/openid-configuration"
      },
      "autoApprove": [
        "search_system_menu",
        "list_entities",
        "get_entity_schema",
        "get_records",
        "get_record_by_id",
        "search_records",
        "count_records",
        "view_financial_dashboard",
        "render_accounting_analytics",
        "render_partner_bar_chart",
        "export_entity_to_excel",
        "generate_catalog_excel_template",
        "get_application_downloads"
      ]
    },
    "famabook-lien-thong": {
      "type": "http",
      "url": "https://a2a.famabook.com",
      "headers": {
        "X-Api-Key": "bkit-mcp-2026-secret-key"
      }
    }
  }
}
'@
[System.IO.File]::WriteAllText("$sampleDir\.mcp.json", $mcpConfigContent, [System.Text.Encoding]::UTF8)

# Cai dat Agent Skills vao thu muc mau va thu muc he thong
$sampleSkillsDir = "$sampleDir\.agents\skills"
$globalSkillsDir = "$OutputDir\.agents\skills"
foreach ($dir in @($sampleSkillsDir, $globalSkillsDir)) {
    if (-not (Test-Path "$dir\famabook-web-agent")) {
        New-Item -ItemType Directory -Path "$dir\famabook-web-agent" -Force | Out-Null
    }
    if (-not (Test-Path "$dir\thong-tu-99-bctc-htkk")) {
        New-Item -ItemType Directory -Path "$dir\thong-tu-99-bctc-htkk" -Force | Out-Null
    }
    Copy-Item -Path "$repoRoot\.agents\skills\famabook-web-agent\SKILL.md" -Destination "$dir\famabook-web-agent\SKILL.md" -Force
    Copy-Item -Path "$repoRoot\.agents\skills\thong-tu-99-bctc-htkk\SKILL.md" -Destination "$dir\thong-tu-99-bctc-htkk\SKILL.md" -Force
}

# Huong dan Agent bang Tieng Viet
$agentsMdContent = @'
# Quy Tắc & Hướng Dẫn Trợ Lý Kế Toán famabook.com

Bạn là Trợ lý Kế toán & Kiểm toán AI chuyên nghiệp của phần mềm **famabook.com**.

## Nguyên Tắc Hoạt Động Cho Kế Toán Viên:
1. **Giao tiếp:** 100% bằng Tiếng Việt chuẩn mực, tôn trọng, rõ ràng, dễ hiểu cho kế toán viên không chuyên kỹ thuật.
2. **Bảo mật:** Tuyệt đối không để lộ mã nguồn kỹ thuật, token, tên framework backend hoặc chi tiết hạ tầng dưới mọi hình thức.
3. **Tuân thủ Chuẩn mực:** Mọi nghiệp vụ hạch toán, kết chuyển và lập Báo cáo tài chính phải tuân thủ nghiêm ngặt **Thông tư 99/2025/TT-BTC** và định dạng XML liên thông của phần mềm **HTKK** (Tổng cục Thuế).
4. **Cân đối Kế toán:** Bảng Cân đối kế toán bắt buộc phải khớp: **Tổng cộng Tài sản (Mã số 280) = Tổng cộng Nguồn vốn (Mã số 440)**.
5. **Điều hướng Tức thời:** Luôn sử dụng công cụ điều hướng để mở nhanh phân hệ theo định dạng `/dashboard/...` (< 20ms).
'@
[System.IO.File]::WriteAllText("$sampleDir\AGENTS.md", $agentsMdContent, [System.Text.Encoding]::UTF8)

# So Nhat ky chung mau
$nhatKyChungContent = @'
# SỔ NHẬT KÝ CHUNG DOANH NGHIỆP (MẪU S03a-DN - THÔNG TƯ 99/2025/TT-BTC)

| Ngày ghi sổ | Chứng từ Số | Ngày chứng từ | Diễn giải nghiệp vụ | TK Nợ | TK Có | Số tiền (VND) |
| :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| 01/09/2026 | PT001 | 01/09/2026 | Rút tiền gửi ngân hàng nhập quỹ tiền mặt | 1111 | 1121 | 50.000.000 |
| 02/09/2026 | HDB001 | 02/09/2026 | Doanh thu bán hàng hóa phát hành e-invoice 30s | 131 | 5111 | 100.000.000 |
| 02/09/2026 | HDB001 | 02/09/2026 | Thuế GTGT đầu ra phải nộp (10%) | 131 | 3331 | 10.000.000 |
| 02/09/2026 | PX001 | 02/09/2026 | Giá vốn xuất kho lô hàng HDB001 | 632 | 1561 | 70.000.000 |
| 05/09/2026 | HDM001 | 05/09/2026 | Mua nguyên vật liệu nhập kho thanh toán chuyển khoản | 152 | 1121 | 30.000.000 |
| 05/09/2026 | HDM001 | 05/09/2026 | Thuế GTGT đầu vào được khấu trừ (10%) | 1331 | 1121 | 3.000.000 |
'@
[System.IO.File]::WriteAllText("$sampleDir\So-Nhat-Ky-Chung.md", $nhatKyChungContent, [System.Text.Encoding]::UTF8)

# Cau hinh argv.json ngon ngu Tieng Viet
$argvContent = @'
{
  "locale": "vi"
}
'@
[System.IO.File]::WriteAllText("$OutputDir\argv.json", $argvContent, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "==============================================================================="
Write-Host "                  DONG GOI HOAN TAT THANH CONG!"
Write-Host " Goi phan phoi tai: $OutputDir"
Write-Host " Ke toan vien khoi dong bang: Khoi-Dong-Famabook.bat"
Write-Host "==============================================================================="
