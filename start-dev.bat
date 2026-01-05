@echo off
echo ========================================
echo   Neon Pit Roguelike - Live Preview
echo ========================================
echo.
echo Starting development server...
echo.
echo IMPORTANT: Make sure you've run 'npm install' first!
echo (If you haven't, close this window and run: npm install)
echo.
echo The game will open automatically in your browser.
echo.
echo To view in Cursor's browser:
echo   1. Press Ctrl+Shift+P
echo   2. Type "Simple Browser: Show"
echo   3. Enter: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server.
echo.
pause
call npm run dev
