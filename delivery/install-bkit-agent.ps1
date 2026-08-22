# PowerShell Installer for BKIT AI Agent & Web Browser
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "      BKIT CORPORATION - BỘ CÀI ĐẶT TÁC NHÂN AI & DUYỆT WEB        " -ForegroundColor Yellow
Write-Host "   Dành cho Người Dùng Văn phòng, Kế toán & Quản trị Doanh nghiệp   " -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# 1. Detect VS Code
Write-Host "[1/4] Đang kiểm tra Visual Studio Code..." -ForegroundColor Green
$CodeCmd = Get-Command code -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue

if (-not $CodeCmd) {
    $PotentialPaths = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
        "${env:ProgramFiles(x86)}\Microsoft VS Code\bin\code.cmd"
    )
    foreach ($p in $PotentialPaths) {
        if (Test-Path $p) {
            $CodeCmd = $p
            break
        }
    }
}

if (-not $CodeCmd) {
    Write-Host "[!] Không tìm thấy Visual Studio Code. Đang mở trang tải..." -ForegroundColor Red
    Start-Process "https://code.visualstudio.com/Download"
    Read-Host "Vui lòng hoàn tất cài đặt VS Code rồi nhấn Enter để tiếp tục..."
    exit 1
}

Write-Host "[+] Tìm thấy VS Code tại: $CodeCmd" -ForegroundColor Gray

# 2. Sync Agent Customizations
Write-Host "[2/4] Đang cấu hình Tác nhân AI và Kỹ năng duyệt web..." -ForegroundColor Green
$UserCopilotDir = Join-Path $env:USERPROFILE ".copilot"
$AgentsDir = Join-Path $UserCopilotDir "agents"
$SkillsDir = Join-Path $UserCopilotDir "skills"

New-Item -ItemType Directory -Force -Path $AgentsDir | Out-Null
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

$SourceAgents = Join-Path $RootDir "com.github.copilot\agents\*.agent.md"
if (Test-Path $SourceAgents) {
    Copy-Item -Path $SourceAgents -Destination $AgentsDir -Force
    Write-Host "[+] Đã cài đặt 2 Tác nhân AI: BKIT Web Browser & BKIT Accounting." -ForegroundColor Gray
}

$SourceSkills = Join-Path $RootDir "skills\*"
if (Test-Path (Join-Path $RootDir "skills")) {
    Copy-Item -Path $SourceSkills -Destination $SkillsDir -Recurse -Force
    Write-Host "[+] Đã cài đặt 3 Kỹ năng: Duyệt Web, Tra cứu Thuế, Xác minh MST." -ForegroundColor Gray
}

# 3. Configure VS Code Settings
Write-Host "[3/4] Đang tối ưu hóa cấu hình cho trải nghiệm duyệt web & Model Provider..." -ForegroundColor Green
$BackendAppSettingsPath = Join-Path (Join-Path $RootDir "backend") "appsettings.json"
$ConfiguredApiKey = ""
$ConfiguredAiUrl = "https://api.deepseek.com"
if (Test-Path $BackendAppSettingsPath) {
    try {
        $backendJson = Get-Content -Raw -Path $BackendAppSettingsPath -Encoding UTF8 | ConvertFrom-Json
        if ($backendJson.AiServer.ApiKey) {
            $ConfiguredApiKey = $backendJson.AiServer.ApiKey
        }
        if ($backendJson.AiServer.BaseUrl) {
            $ConfiguredAiUrl = $backendJson.AiServer.BaseUrl
        }
    } catch {}
}

$VscodeSettingsPath = Join-Path $env:APPDATA "Code\User\settings.json"
if (Test-Path $VscodeSettingsPath) {
    try {
        $settingsContent = Get-Content -Raw -Path $VscodeSettingsPath -Encoding UTF8 | ConvertFrom-Json
        $settingsContent | Add-Member -NotePropertyName "workbench.colorTheme" -NotePropertyValue "Light 2026" -Force
        $settingsContent | Add-Member -NotePropertyName "workbench.preferredLightColorTheme" -NotePropertyValue "Light 2026" -Force
        $settingsContent | Add-Member -NotePropertyName "window.autoDetectColorScheme" -NotePropertyValue $false -Force
        $settingsContent | Add-Member -NotePropertyName "workbench.startupEditor" -NotePropertyValue "none" -Force
        $settingsContent | Add-Member -NotePropertyName "workbench.welcomePage.experimentalOnboarding" -NotePropertyValue $false -Force
        $settingsContent | Add-Member -NotePropertyName "workbench.browser.enableChatTools" -NotePropertyValue $true -Force
        $settingsContent | Add-Member -NotePropertyName "chat.plugins.enabled" -NotePropertyValue $true -Force
        $settingsContent | Add-Member -NotePropertyName "bkit.apiKey" -NotePropertyValue $ConfiguredApiKey -Force
        $settingsContent | Add-Member -NotePropertyName "bkit.aiBaseUrl" -NotePropertyValue $ConfiguredAiUrl -Force
        $settingsContent | Add-Member -NotePropertyName "bkit.authUrl" -NotePropertyValue "https://auth.bkit.vn" -Force
        $settingsContent | Add-Member -NotePropertyName "bkit.backendApiUrl" -NotePropertyValue "https://a2a.bkit.vn" -Force
        $settingsContent | Add-Member -NotePropertyName "bkit.model" -NotePropertyValue "deepseek-chat" -Force
        
        $settingsContent | ConvertTo-Json -Depth 10 | Set-Content -Path $VscodeSettingsPath -Encoding UTF8
        Write-Host "[+] Đã bật chế độ Browser Tools & Kết nối Model Provider (vendor: 'bkit')." -ForegroundColor Gray
    } catch {
        Write-Host "[!] Bỏ qua cập nhật file settings.json do định dạng riêng." -ForegroundColor Yellow
    }
}

# Install Extensions
$BkitVsix = Join-Path $ScriptDir "bkit-agent-web-1.0.0.vsix"
if (Test-Path $BkitVsix) {
    & $CodeCmd --install-extension $BkitVsix --force | Out-Null
    Write-Host "[+] Đã cài đặt tiện ích: BKIT AI Agent & Web Browser." -ForegroundColor Gray
}

$DeepSeekVsix = Join-Path $ScriptDir "deepseek-v4-for-copilot.vsix"
if (Test-Path $DeepSeekVsix) {
    & $CodeCmd --install-extension $DeepSeekVsix --force | Out-Null
    Write-Host "[+] Đã cài đặt tiện ích: Vizards.deepseek-v4-for-copilot." -ForegroundColor Gray
}

# 4. Launch VS Code
Write-Host "[4/4] Đang khởi động Visual Studio Code..." -ForegroundColor Green
Start-Process $CodeCmd -ArgumentList "`"$RootDir`""

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "               CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!                          " -ForegroundColor Green
Write-Host " 1. Nhấn vào biểu tượng [BKIT AI: Chưa đăng nhập] góc phải dưới     " -ForegroundColor White
Write-Host " 2. Đăng nhập qua tài khoản auth.bkit.vn                            " -ForegroundColor White
Write-Host " 3. Mở Chat và sử dụng lệnh: @bkit /web <địa chỉ web cần tra cứu>   " -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
