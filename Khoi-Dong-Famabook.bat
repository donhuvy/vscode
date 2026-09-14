@echo off
chcp 65001 > nul
title famabook.com - Phần mềm Kế toán & Trợ lý Thông minh

echo ===============================================================================
echo            famabook.com - PHẦN MỀM KẾ TOÁN & TRỢ LÝ THÔNG MINH
echo       Tuân thủ Chuẩn mực Thông tư 99/2025/TT-BTC và Tổng cục Thuế
echo ===============================================================================
echo.
echo [*] Đang khởi động hệ thống trợ lý kế toán famabook.com...
echo [*] Tự động kết nối cơ sở dữ liệu sổ sách và máy chủ hóa đơn điện tử...
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "TARGET_DIR=%SCRIPT_DIR%Du-Lieu-Ke-Toan-Mau"
if not exist "%TARGET_DIR%" set "TARGET_DIR=%SCRIPT_DIR%"

if exist "%SCRIPT_DIR%Famabook.exe" (
    start "" "%SCRIPT_DIR%Famabook.exe" --locale=vi "%TARGET_DIR%"
    exit /b 0
)

if exist "%SCRIPT_DIR%..\Famabook.exe" (
    start "" "%SCRIPT_DIR%..\Famabook.exe" --locale=vi "%TARGET_DIR%"
    exit /b 0
)

if exist "%SCRIPT_DIR%.build\electron\Famabook.exe" (
    start "" "%SCRIPT_DIR%.build\electron\Famabook.exe" --locale=vi "%TARGET_DIR%"
    exit /b 0
)

if exist "%SCRIPT_DIR%..\scripts\code.bat" (
    call "%SCRIPT_DIR%..\scripts\code.bat" --locale=vi "%TARGET_DIR%"
    exit /b 0
)

if exist "%SCRIPT_DIR%scripts\code.bat" (
    call "%SCRIPT_DIR%scripts\code.bat" --locale=vi "%TARGET_DIR%"
    exit /b 0
)

where code >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Khởi chạy Visual Studio Code Agents với cấu hình famabook.com...
    call code --locale=vi "%TARGET_DIR%"
    exit /b 0
)

echo [!] Không tìm thấy tệp thực thi Famabook.exe hoặc VS Code. Vui lòng liên hệ quản trị hệ thống famabook.com.
pause
