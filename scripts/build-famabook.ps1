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
Write-Host "[1/4] Kiem tra trinh bien dich TypeScript..."
$tscPath = "E:\source_code\acc10\frontend\node_modules\typescript\bin\tsc"
if (-not (Test-Path $tscPath)) {
    $tscPath = "$repoRoot\node_modules\typescript\bin\tsc"
}
if (-not (Test-Path $tscPath)) {
    throw "Khong tim thay trinh bien dich TypeScript."
}
Write-Host "       Da tim thay tsc tai: $tscPath"

# 2. Bien dich extensions/famabook
Write-Host ""
Write-Host "[2/4] Bien dich extensions/famabook..."
$famabookTsConfig = "$repoRoot\extensions\famabook\tsconfig.json"
& node $tscPath -p $famabookTsConfig
if ($LASTEXITCODE -ne 0) {
    throw "Bien dich extensions/famabook that bai voi ma loi $LASTEXITCODE."
}
Write-Host "       Bien dich extensions/famabook thanh cong (out/ da san sang)."

# 3. Kiem tra Logo va Bieu tuong Leafly Green f
Write-Host ""
Write-Host "[3/4] Kiem tra tai nguyen bieu tuong famabook..."
$icons = @(
    "$repoRoot\resources\win32\code.ico",
    "$repoRoot\resources\win32\code_150x150.png",
    "$repoRoot\resources\win32\code_70x70.png",
    "$repoRoot\resources\server\favicon.ico",
    "$repoRoot\resources\server\code-192.png",
    "$repoRoot\resources\server\code-512.png",
    "$repoRoot\resources\linux\code.png"
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
Write-Host "[4/4] Tao thu muc dong goi: $OutputDir..."
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Copy-Item -Path "$repoRoot\Khoi-Dong-Famabook.bat" -Destination "$OutputDir\" -Force
if (Test-Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md") {
    Copy-Item -Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md" -Destination "$OutputDir\" -Force
}

$sampleDir = "$OutputDir\Du-Lieu-Ke-Toan-Mau"
if (-not (Test-Path $sampleDir)) {
    New-Item -ItemType Directory -Path $sampleDir -Force | Out-Null
}

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
    }
  }
}
'@

[System.IO.File]::WriteAllText("$sampleDir\.mcp.json", $mcpConfigContent, [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "==============================================================================="
Write-Host "                  DONG GOI HOAN TAT THANH CONG!"
Write-Host " Goi phan phoi tai: $OutputDir"
Write-Host " Ke toan vien khoi dong bang: Khoi-Dong-Famabook.bat"
Write-Host "==============================================================================="
