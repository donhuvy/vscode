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