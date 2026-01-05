Write-Host "Starting local server..." -ForegroundColor Green
Write-Host ""

# Check if port 8000 is available
$port = 8000
$listener = $null

try {
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Host "Server started on http://localhost:$port" -ForegroundColor Green
    Write-Host ""
    Write-Host "Open your browser and go to: http://localhost:$port" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath
        if ($localPath -eq "/") {
            $localPath = "/index.html"
        }
        
        $filePath = Join-Path $PSScriptRoot $localPath.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = "text/html"
            if ($filePath -like "*.js" -or $filePath -like "*.jsx") {
                $response.ContentType = "application/javascript"
            } elseif ($filePath -like "*.css") {
                $response.ContentType = "text/css"
            }
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.Close()
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Install Python and run: python -m http.server 8000" -ForegroundColor Yellow
} finally {
    if ($listener) {
        $listener.Stop()
    }
}
