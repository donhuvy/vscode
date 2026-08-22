@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title CÀI ĐẶT BKIT AI AGENT CHO VISUAL STUDIO CODE

echo =====================================================================
echo       BKIT CORPORATION - BỘ CÀI ĐẶT TÁC NHÂN AI & DUYỆT WEB
echo   Dành cho Người Dùng Văn phòng, Kế toán & Quản trị Doanh nghiệp
echo =====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "EXT_DIR=%ROOT_DIR%\extension"

echo [1/4] Đang kiểm tra phần mềm Visual Studio Code trên máy tính...

set "VSCODE_CMD="
where code >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "VSCODE_CMD=code"
) else (
    if exist "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd" (
        set "VSCODE_CMD=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
    ) else if exist "%ProgramFiles%\Microsoft VS Code\bin\code.cmd" (
        set "VSCODE_CMD=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
    ) else if exist "%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd" (
        set "VSCODE_CMD=%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"
    )
)

if "%VSCODE_CMD%"=="" (
    echo [!] KHÔNG TÌM THẤY VISUAL STUDIO CODE TRÊN MÁY BẠN.
    echo [*] Đang mở trình duyệt để tải Visual Studio Code chính thức...
    start https://code.visualstudio.com/Download
    echo.
    echo Vui lòng cài đặt Visual Studio Code xong rồi chạy lại tệp này.
    pause
    exit /b 1
)

echo [+] Đã tìm thấy VS Code: "!VSCODE_CMD!"
echo.

echo [2/4] Đang đồng bộ Tác nhân AI và Kỹ năng duyệt web vào máy tính của bạn...
set "USER_COPILOT_DIR=%USERPROFILE%\.copilot"
if not exist "%USER_COPILOT_DIR%\agents" mkdir "%USER_COPILOT_DIR%\agents"
if not exist "%USER_COPILOT_DIR%\skills" mkdir "%USER_COPILOT_DIR%\skills"

if exist "%ROOT_DIR%\com.github.copilot\agents\*.agent.md" (
    copy /Y "%ROOT_DIR%\com.github.copilot\agents\*.agent.md" "%USER_COPILOT_DIR%\agents\" >nul
    echo [+] Đã sao chép các Tác nhân AI (BKIT Web Browser, BKIT Accounting) thành công.
)

if exist "%ROOT_DIR%\skills" (
    xcopy /E /I /Y "%ROOT_DIR%\skills" "%USER_COPILOT_DIR%\skills" >nul
    echo [+] Đã sao chép 3 Kỹ năng nghiệp vụ (Duyệt Web, Tra cứu Thuế, Tra cứu MST) thành công.
)
echo.

echo [3/4] Đang cài đặt Tiện ích mở rộng BKIT AI Extension...
if exist "%SCRIPT_DIR%bkit-agent-web-1.0.0.vsix" (
    call "!VSCODE_CMD!" --install-extension "%SCRIPT_DIR%bkit-agent-web-1.0.0.vsix" --force
    echo [+] Đã cài đặt tiện ích BKIT AI thành công.
) else (
    echo [*] Đang chuẩn bị môi trường tiện ích mở rộng...
)
echo.

echo [4/4] Đang khởi động Visual Studio Code và kích hoạt Tác nhân BKIT...
start "" "!VSCODE_CMD!" "%ROOT_DIR%"

echo.
echo =====================================================================
echo                      CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!
echo.
echo  HƯỚNG DẪN SỬ DỤNG NHANH CHO NGƯỜI DÙNG:
echo   1. Trong VS Code vừa mở, nhìn xuống góc phải dưới màn hình và nhấn:
echo      [BKIT AI: Chưa đăng nhập]
echo   2. Đăng nhập tài khoản của bạn qua auth.bkit.vn
echo   3. Mở khung Chat (Ctrl+Alt+I hoặc phím tắt Chat) và gõ:
echo      @bkit Hãy tra cứu thông tin công ty BKIT trên web
echo =====================================================================
echo.
pause
