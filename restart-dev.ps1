Write-Host "Stopping any running Vite servers..." -ForegroundColor Yellow

# Kill any node processes that might be running Vite
Get-Process | Where-Object {$_.ProcessName -eq "node"} | ForEach-Object {
    $port = (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 3000}).LocalPort
    if ($port -eq 3000) {
        Write-Host "Stopping process $($_.Id) on port 3000..." -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

Write-Host "Clearing Vite cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Starting fresh Vite dev server..." -ForegroundColor Green
Write-Host ""

npm run dev
