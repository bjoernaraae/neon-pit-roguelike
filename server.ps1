# Simple HTTP Server for Neon Pit Roguelike
$port = 8000
$url = "http://localhost:$port/"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Neon Pit Roguelike - Local Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server on: $url" -ForegroundColor Green
Write-Host ""
Write-Host "Open your browser and go to:" -ForegroundColor Yellow
Write-Host "  $url" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Create HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "✓ Server is running!" -ForegroundColor Green
    Write-Host ""
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Get the requested file path
        $localPath = $request.Url.LocalPath
        
        # Get the script directory (where server.ps1 is located)
        # Try multiple methods to get the correct directory
        $scriptDir = $null
        if ($PSScriptRoot) {
            $scriptDir = $PSScriptRoot
        } elseif ($MyInvocation.MyCommand.Path) {
            $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        } else {
            $scriptDir = $PWD.Path
        }
        
        # Ensure we have an absolute path
        if (-not [System.IO.Path]::IsPathRooted($scriptDir)) {
            $scriptDir = [System.IO.Path]::GetFullPath($scriptDir)
        }
        
        # Handle root path
        if ($localPath -eq "/" -or $localPath -eq "") {
            $localPath = "/index.html"
        }
        
        # Convert URL path to file system path
        $relativePath = $localPath.TrimStart('/')
        # Handle both forward and backslashes - normalize to Windows backslashes
        $relativePath = $relativePath.Replace('/', '\')
        
        $filePath = Join-Path $scriptDir $relativePath
        # Normalize the path to handle spaces and special characters
        try {
            $filePath = [System.IO.Path]::GetFullPath($filePath)
        } catch {
            $filePath = Join-Path $scriptDir $relativePath
        }
        
        # Security: Ensure the file is within the script directory
        $scriptDirFull = [System.IO.Path]::GetFullPath($scriptDir)
        if (-not $filePath.StartsWith($scriptDirFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $forbidden = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
            $response.ContentLength64 = $forbidden.Length
            $response.OutputStream.Write($forbidden, 0, $forbidden.Length)
            $response.Close()
            Write-Host "[$($request.HttpMethod)] $localPath → 403 Forbidden" -ForegroundColor Red
            continue
        }
        
        # Debug output
        Write-Host "[$($request.HttpMethod)] $localPath" -ForegroundColor Gray
        Write-Host "  → $filePath" -ForegroundColor DarkGray
        Write-Host "  → Exists: $(Test-Path $filePath)" -ForegroundColor DarkGray
        
        if (Test-Path $filePath -PathType Leaf) {
            # Read file content
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Set content type
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".js" { "application/javascript; charset=utf-8" }
                ".jsx" { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".css" { "text/css; charset=utf-8" }
                ".png" { "image/png" }
                ".jpg" { "image/jpeg" }
                ".svg" { "image/svg+xml" }
                default { "application/octet-stream" }
            }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.StatusCode = 200
            
            # Write response
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            # File not found
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
            Write-Host "  → 404 Not Found" -ForegroundColor Red
        }
        
        $response.Close()
    }
} catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure port $port is not already in use." -ForegroundColor Yellow
} finally {
    if ($listener) {
        $listener.Stop()
        Write-Host ""
        Write-Host "Server stopped." -ForegroundColor Yellow
    }
}
