$baseUrl = "https://simulado-api.simulado-ata-mf.workers.dev"
$adminKey = "simulasupport2025"

# Get quizzes
$quizzes = Invoke-RestMethod -Uri "$baseUrl/api/quizzes?admin_key=$adminKey"
$quizId = $quizzes.quizzes[0].id
Write-Host "=== Quiz ID: $quizId ==="

# Try to start quiz
$body = @{ quizId = $quizId } | ConvertTo-Json
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/quiz/start?admin_key=$adminKey" `
        -Method POST -ContentType "application/json" -Body $body
    Write-Host "=== SUCCESS ==="
    $result | ConvertTo-Json -Depth 3
} catch {
    Write-Host "=== ERROR ==="
    $errorBody = $_.ErrorDetails.Message
    if (-not $errorBody) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
    }
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Body: $errorBody"
}
