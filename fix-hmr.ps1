Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fixing HMR / Auto-Reload Issues" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all Node processes
Write-Host "Step 1: Stopping all Node processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -eq "node"} | ForEach-Object {
    Write-Host "  Stopping process $($_.Id)..." -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "  ✓ All Node processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Clear Vite cache
Write-Host "Step 2: Clearing Vite cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Vite cache cleared" -ForegroundColor Green
} else {
    Write-Host "  ✓ No cache to clear" -ForegroundColor Green
}
Write-Host ""

# Step 3: Clear browser cache hint
Write-Host "Step 3: Next steps..." -ForegroundColor Yellow
Write-Host "  • Close all browser tabs with localhost:3000" -ForegroundColor White
Write-Host "  • The dev server will start in a moment" -ForegroundColor White
Write-Host "  • Open a NEW browser tab to http://localhost:3000" -ForegroundColor White
Write-Host "  • Press Ctrl+Shift+R to hard refresh if needed" -ForegroundColor White
Write-Host ""

# Step 4: Start dev server
Write-Host "Step 4: Starting fresh dev server..." -ForegroundColor Yellow
Write-Host ""
Start-Sleep -Seconds 1

npm run dev
