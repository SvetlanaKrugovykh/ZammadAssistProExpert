@echo off
echo Testing Monitoring Notification System
echo =====================================

cd /d "d:\01_Project_JS_NodeJS\!!!_003_ZammadAssistProExpert\src\server\temp"

echo.
echo Test 1: Check last 5 minutes for INTERNET issues
node testMonitoring.js 5 INTERNET

echo.
echo Test 2: Check last 30 minutes for INTERNET issues  
node testMonitoring.js 30 INTERNET

echo.
echo Test 3: Check last 5 minutes for VIDEO issues
node testMonitoring.js 5 VIDEO

pause