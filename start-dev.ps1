Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Neon Pit Roguelike - Live Preview" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Make sure you've run 'npm install' first!" -ForegroundColor Yellow
Write-Host "(If you haven't, close this and run: npm install)" -ForegroundColor Yellow
Write-Host ""
Write-Host "The game will open automatically in your browser." -ForegroundColor Green
Write-Host ""
Write-Host "To view in Cursor's browser:" -ForegroundColor Cyan
Write-Host "  1. Press Ctrl+Shift+P" -ForegroundColor White
Write-Host "  2. Type 'Simple Browser: Show'" -ForegroundColor White
Write-Host "  3. Enter: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host ""

npm run dev
