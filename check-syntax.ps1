Write-Host "Checking for common syntax issues..." -ForegroundColor Yellow
Write-Host ""

# Check for unmatched braces
$content = Get-Content "src\components\NeonPitRoguelikeV3.jsx" -Raw
$openBraces = ($content.ToCharArray() | Where-Object { $_ -eq '{' }).Count
$closeBraces = ($content.ToCharArray() | Where-Object { $_ -eq '}' }).Count
$openParens = ($content.ToCharArray() | Where-Object { $_ -eq '(' }).Count
$closeParens = ($content.ToCharArray() | Where-Object { $_ -eq ')' }).Count

Write-Host "Braces: { = $openBraces, } = $closeBraces" -ForegroundColor $(if ($openBraces -eq $closeBraces) { "Green" } else { "Red" })
Write-Host "Parentheses: ( = $openParens, ) = $closeParens" -ForegroundColor $(if ($openParens -eq $closeParens) { "Green" } else { "Red" })

# Check for common issues
if (Select-String -Path "src\components\NeonPitRoguelikeV3.jsx" -Pattern "127\.0\.0\.1:7242") {
    Write-Host "WARNING: Found debug telemetry calls!" -ForegroundColor Red
} else {
    Write-Host "No debug telemetry calls found" -ForegroundColor Green
}

Write-Host ""
Write-Host "File size: $((Get-Item 'src\components\NeonPitRoguelikeV3.jsx').Length) bytes"
Write-Host "Line count: $((Get-Content 'src\components\NeonPitRoguelikeV3.jsx').Count) lines"
