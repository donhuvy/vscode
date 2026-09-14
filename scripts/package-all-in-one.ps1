param(
    [string]$DistDir = "$PSScriptRoot\..\dist-famabook",
    [string]$ZipPath = "$PSScriptRoot\..\Famabook-All-In-One.zip"
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================="
Write-Host "     famabook.com - DONG GOI TRON GOI ALL-IN-ONE (PORTABLE DESKTOP)"
Write-Host "==============================================================================="

$repoRoot = (Get-Item "$PSScriptRoot\..").FullName
$runtimeSource = "C:\Users\donhuvy\AppData\Local\BKIT_Accounting_Agents_Desktop"

if (-not (Test-Path "$runtimeSource\Code.exe")) {
    throw "Khong tim thay nguon runtime VS Code tai: $runtimeSource"
}

Write-Host ""
Write-Host "[1/7] Chuan bi thu muc phan phoi All-in-One: $DistDir..."
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

# 1. Sao chep cac file binary va thu muc runtime 110a328ea5
Write-Host ""
Write-Host "[2/7] Sao chep bo runtime VS Code 1.134.0 (110a328ea5)..."
Copy-Item -Path "$runtimeSource\Code.exe" -Destination "$DistDir\Famabook.exe" -Force
Copy-Item -Path "$runtimeSource\Code.exe" -Destination "$DistDir\Code.exe" -Force
Copy-Item -Path "$runtimeSource\110a328ea5" -Destination "$DistDir\" -Recurse -Force
Copy-Item -Path "$runtimeSource\bin" -Destination "$DistDir\" -Recurse -Force

# Manifest cho Windows Start Menu / Taskbar
$manifestContent = @'
<Application xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
		<VisualElements
				BackgroundColor="#064e3b"
				ShowNameOnSquare150x150Logo="on"
				Square150x150Logo="110a328ea5\resources\app\resources\win32\code_150x150.png"
				Square70x70Logo="110a328ea5\resources\app\resources\win32\code_70x70.png"
				ForegroundText="light"
				ShortDisplayName="famabook.com" />
</Application>
'@
[System.IO.File]::WriteAllText("$DistDir\Famabook.VisualElementsManifest.xml", $manifestContent, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$DistDir\Code.VisualElementsManifest.xml", $manifestContent, [System.Text.Encoding]::UTF8)

# 2. Thay the icon mam la xanh (leafly green f)
Write-Host ""
Write-Host "[3/7] Tich hop bo icon mam la xanh famabook..."
$appResWin32 = "$DistDir\110a328ea5\resources\app\resources\win32"
if (-not (Test-Path $appResWin32)) {
    New-Item -ItemType Directory -Path $appResWin32 -Force | Out-Null
}
Copy-Item -Path "$repoRoot\resources\win32\code.ico" -Destination "$appResWin32\code.ico" -Force
Copy-Item -Path "$repoRoot\resources\win32\code_150x150.png" -Destination "$appResWin32\code_150x150.png" -Force
Copy-Item -Path "$repoRoot\resources\win32\code_70x70.png" -Destination "$appResWin32\code_70x70.png" -Force

# 3. Tuy bien product.json ben trong resources/app
Write-Host ""
Write-Host "[4/7] Cap nhat product.json sang thuong hieu famabook.com..."
$targetProductJsonPath = "$DistDir\110a328ea5\resources\app\product.json"
$productObj = Get-Content -Raw -Encoding UTF8 $targetProductJsonPath | ConvertFrom-Json

$productObj.nameShort = "Famabook"
$productObj.nameLong = "famabook.com"
$productObj.applicationName = "famabook"
$productObj.win32NameVersion = "famabook.com"
$productObj.win32DirName = "famabook.com"
$productObj.win32AppUserModelId = "famabook.app"
$productObj.win32ShellNameShort = "famabook.com"
$productObj.win32MutexName = "famabook"
$productObj.urlProtocol = "famabook"
$productObj.dataFolderName = ".famabook"

# Them quyen xac thuc bkit OAuth2
if (-not $productObj.trustedExtensionAuthAccess) {
    $productObj | Add-Member -NotePropertyName "trustedExtensionAuthAccess" -NotePropertyValue (New-Object PSObject)
}
$productObj.trustedExtensionAuthAccess | Add-Member -NotePropertyName "bkit" -NotePropertyValue @(
    "famabook.famabook",
    "famabook.famabook-agent",
    "famabook",
    "GitHub.copilot-chat"
) -Force

$updatedJson = $productObj | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText($targetProductJsonPath, $updatedJson, [System.Text.Encoding]::UTF8)

# 4. Nhieu extension famabook vao lam built-in extension
Write-Host ""
Write-Host "[5/7] Nhap extension famabook vao built-in extensions..."
$targetExtDir = "$DistDir\110a328ea5\resources\app\extensions\famabook"
if (-not (Test-Path $targetExtDir)) {
    New-Item -ItemType Directory -Path $targetExtDir -Force | Out-Null
}
Copy-Item -Path "$repoRoot\extensions\famabook\package.json" -Destination "$targetExtDir\" -Force
Copy-Item -Path "$repoRoot\extensions\famabook\out" -Destination "$targetExtDir\" -Recurse -Force
Copy-Item -Path "$repoRoot\extensions\famabook\media" -Destination "$targetExtDir\" -Recurse -Force
if (Test-Path "$repoRoot\extensions\famabook\skills") {
    Copy-Item -Path "$repoRoot\extensions\famabook\skills" -Destination "$targetExtDir\" -Recurse -Force
}

# 5. Thiet lap che do Portable Mode va 100% Tieng Viet
Write-Host ""
Write-Host "[6/7] Thiet lap che do Portable va Tieng Viet (data/)..."
$portableUserData = "$DistDir\data\user-data\User"
if (-not (Test-Path $portableUserData)) {
    New-Item -ItemType Directory -Path $portableUserData -Force | Out-Null
}

$argvJson = @'
{
  "locale": "vi"
}
'@
[System.IO.File]::WriteAllText("$portableUserData\argv.json", $argvJson, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$DistDir\data\argv.json", $argvJson, [System.Text.Encoding]::UTF8)

$settingsJson = @'
{
  "workbench.colorTheme": "Default Dark Modern",
  "window.title": "famabook.com - Phần mềm Kế toán & Trợ lý Thông minh",
  "famabook.accountingStandard": "Thông tư 99/2025/TT-BTC",
  "famabook.autoValidateBalanceSheet": true,
  "chat.defaultModel": "famabook:famabook-ke-toan"
}
'@
[System.IO.File]::WriteAllText("$portableUserData\settings.json", $settingsJson, [System.Text.Encoding]::UTF8)

# 6. Du lieu ke toan mau & Tep khoi dong bat
$sampleDir = "$DistDir\Du-Lieu-Ke-Toan-Mau"
if (-not (Test-Path $sampleDir)) {
    New-Item -ItemType Directory -Path $sampleDir -Force | Out-Null
}

$mcpContent = @'
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
[System.IO.File]::WriteAllText("$sampleDir\.mcp.json", $mcpContent, [System.Text.Encoding]::UTF8)

$agentsMd = @'
# Quy Tắc & Hướng Dẫn Trợ Lý Kế Toán famabook.com

Bạn là Trợ lý Kế toán & Kiểm toán AI chuyên nghiệp của phần mềm **famabook.com**.

## Nguyên Tắc Hoạt Động Cho Kế Toán Viên:
1. **Giao tiếp:** 100% bằng Tiếng Việt chuẩn mực, tôn trọng, rõ ràng, dễ hiểu cho kế toán viên không chuyên kỹ thuật.
2. **Bảo mật:** Tuyệt đối không để lộ mã nguồn kỹ thuật, token, tên framework backend hoặc chi tiết hạ tầng dưới mọi hình thức.
3. **Tuân thủ Chuẩn mực:** Mọi nghiệp vụ hạch toán, kết chuyển và lập Báo cáo tài chính phải tuân thủ nghiêm ngặt **Thông tư 99/2025/TT-BTC** và định dạng XML liên thông của phần mềm **HTKK** (Tổng cục Thuế).
4. **Cân đối Kế toán:** Bảng Cân đối kế toán bắt buộc phải khớp: **Tổng cộng Tài sản (Mã số 280) = Tổng cộng Nguồn vốn (Mã số 440)**.
5. **Điều hướng Tức thời:** Luôn sử dụng công cụ điều hướng để mở nhanh phân hệ theo định dạng `/dashboard/...` (< 20ms).
'@
[System.IO.File]::WriteAllText("$sampleDir\AGENTS.md", $agentsMd, [System.Text.Encoding]::UTF8)

# Skills vao Du-Lieu-Ke-Toan-Mau
$sampleSkillsDir = "$sampleDir\.agents\skills"
foreach ($sk in @("famabook-web-agent", "thong-tu-99-bctc-htkk")) {
    $targetSk = "$sampleSkillsDir\$sk"
    if (-not (Test-Path $targetSk)) {
        New-Item -ItemType Directory -Path $targetSk -Force | Out-Null
    }
    Copy-Item -Path "$repoRoot\.agents\skills\$sk\SKILL.md" -Destination "$targetSk\SKILL.md" -Force
}

# Khoi-Dong-Famabook.bat
$batContent = @'
@echo off
chcp 65001 >nul 2>&1
title famabook.com - Phần mềm Kế toán & Trợ lý Thông minh
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ===============================================================================
echo            famabook.com - PHẦN MỀM KẾ TOÁN & TRỢ LÝ THÔNG MINH
echo       Tuân thủ Chuẩn mực Thông tư 99/2025/TT-BTC và Tổng cục Thuế
echo ===============================================================================
echo.
echo [*] Đang mở giao diện làm việc famabook.com...
echo.

start "" "%SCRIPT_DIR%Famabook.exe" --locale=vi "%SCRIPT_DIR%Du-Lieu-Ke-Toan-Mau"
exit
'@
[System.IO.File]::WriteAllText("$DistDir\Khoi-Dong-Famabook.bat", $batContent, [System.Text.Encoding]::UTF8)

# Huong dan su dung
if (Test-Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md") {
    Copy-Item -Path "$repoRoot\HDSD_PHAN_PHOI_KE_TOAN.md" -Destination "$DistDir\" -Force
}

Write-Host ""
Write-Host "[7/7] Kiem tra tinh san sang va tao file nen ZIP All-in-One..."
Write-Host "       Kiem tra Famabook.exe: $(Test-Path "$DistDir\Famabook.exe")"
Write-Host "       Kiem tra 110a328ea5\resources\app\out\main.js: $(Test-Path "$DistDir\110a328ea5\resources\app\out\main.js")"
Write-Host "       Kiem tra extensions\famabook: $(Test-Path "$DistDir\110a328ea5\resources\app\extensions\famabook\out\extension.js")"

# Tao file ZIP All-in-One
Write-Host "       Dang nen tep: $ZipPath (co the mat 1-2 phut)..."
if (Test-Path $ZipPath) {
    Remove-Item -Path $ZipPath -Force
}
Compress-Archive -Path "$DistDir\*" -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "==============================================================================="
Write-Host "              HOAN TAT DONG GOI ALL-IN-ONE THANH CONG!"
Write-Host " Thu muc ung dung: $DistDir"
Write-Host " File thuc thi:    $DistDir\Famabook.exe"
Write-Host " Tep ZIP phan phoi: $ZipPath"
Write-Host "==============================================================================="
