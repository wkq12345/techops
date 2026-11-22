#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$RestartDatabase,
    [switch]$Redeploy
)

$ErrorActionPreference = 'Stop'
$Context = 'docker-desktop'
$Namespace = 'techops-learning'
$PrivateDirectory = Join-Path $PSScriptRoot '.local'
$SecretsPath = Join-Path $PrivateDirectory 'secrets.env'
$Url = 'http://127.0.0.1:8080'

function Invoke-Kube {
    param([string[]]$Arguments)
    $result = & kubectl --context $Context --namespace $Namespace @Arguments
    if ($LASTEXITCODE -ne 0) { throw "kubectl failed (exit $LASTEXITCODE)." }
    return $result
}

function Get-KubeJson {
    param([string[]]$Arguments)
    return ((@(Invoke-Kube -Arguments $Arguments) -join "`n") | ConvertFrom-Json)
}

function Get-StateSnapshot {
    $sql = "SELECT md5(COALESCE((SELECT string_agg(row_to_json(p)::text, '|' ORDER BY id) FROM products p), '')) || ':' || (SELECT count(*) FROM users)::text || ':' || (SELECT count(*) FROM migrations)::text;"
    $identity = @(Invoke-Kube -Arguments @('exec', 'statefulset/postgres', '--', 'psql', '-U', 'techops_learning', '-d', 'techops_learning', '-Atc', $sql)) -join ''
    $secret = Get-KubeJson -Arguments @('get', 'secret', 'techops-secrets', '-o', 'json')
    $marker = Get-KubeJson -Arguments @('get', 'configmap', 'techops-initialized', '-o', 'json')
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $secretJson = $secret.data | ConvertTo-Json -Compress
        $fingerprint = [BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($secretJson)))
    } finally { $sha.Dispose() }
    return @{ data = $identity.Trim(); credentials = $fingerprint; marker = ($marker.data | ConvertTo-Json -Compress) }
}

function Assert-Snapshot {
    param([hashtable]$Before, [string]$Action)
    $after = Get-StateSnapshot
    foreach ($key in @('data', 'credentials', 'marker')) {
        if ($Before[$key] -cne $after[$key]) { throw "$Action changed the $key snapshot. Inspect the learning deployment; no reset was attempted." }
    }
    Write-Host "$Action preserved data, credentials, and the initial-seed marker."
}

function Get-CsrfHeaders {
    param([Microsoft.PowerShell.Commands.WebRequestSession]$Session)
    $cookie = $Session.Cookies.GetCookies([uri]$Url) | Where-Object { $_.Name -eq 'XSRF-TOKEN' } | Select-Object -First 1
    if (-not $cookie) { throw 'The proxy did not return an XSRF-TOKEN cookie.' }
    return @{ Accept = 'application/json'; Origin = $Url; Referer = "$Url/login"; 'X-XSRF-TOKEN' = [uri]::UnescapeDataString($cookie.Value) }
}

if (-not (Test-Path -LiteralPath $SecretsPath)) { throw 'Run Deploy-Local.ps1 successfully first so the private learning credentials exist.' }
$namespaceObject = Get-KubeJson -Arguments @('get', 'namespace', $Namespace, '-o', 'json')
if ($namespaceObject.metadata.labels.'app.kubernetes.io/part-of' -ne $Namespace) { throw 'Unexpected namespace ownership; verification refused.' }
foreach ($target in @('statefulset/postgres', 'deployment/backend', 'deployment/frontend', 'deployment/redis')) {
    Invoke-Kube -Arguments @('rollout', 'status', $target, '--timeout=300s') | Out-Host
}
$baseline = Get-StateSnapshot

if ($RestartDatabase) {
    Invoke-Kube -Arguments @('rollout', 'restart', 'statefulset/postgres') | Out-Host
    Invoke-Kube -Arguments @('rollout', 'status', 'statefulset/postgres', '--timeout=300s') | Out-Host
    Assert-Snapshot -Before $baseline -Action 'PostgreSQL pod replacement'
}
if ($Redeploy) {
    $previous = Get-Content (Join-Path $PrivateDirectory 'last-deployment.json') -Raw | ConvertFrom-Json
    & (Join-Path $PSScriptRoot 'Deploy-Local.ps1') -SkipBuild -ImageTag $previous.imageTag
    Assert-Snapshot -Before $baseline -Action 'Redeployment'
}

# Own this port-forward process; never stop a server/forward started by the user.
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), 8080)
try { $listener.Start() } catch { throw 'Port 8080 is occupied. Close the learning port-forward terminal before running Test-Local.ps1.' } finally { $listener.Stop() }
$runId = [guid]::NewGuid().ToString('N')
$outputLog = Join-Path $PrivateDirectory "port-forward-$runId.out.log"
$errorLog = Join-Path $PrivateDirectory "port-forward-$runId.err.log"
$kubectl = (Get-Command kubectl -ErrorAction Stop).Source
$forward = Start-Process -FilePath $kubectl -ArgumentList @('--context', $Context, '-n', $Namespace, 'port-forward', '--address', '127.0.0.1', 'service/frontend', '8080:80') -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($forward.HasExited) { throw "Port-forward exited; inspect $errorLog." }
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "$Url/up" -TimeoutSec 2
            if ($health.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "The backend proxy did not become reachable; inspect $errorLog." }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $SecretsPath) {
        if ($line -match '^(APP_KEY|DB_PASSWORD|ADMIN_PASSWORD)=(.+)$') { $values[$Matches[1]] = $Matches[2] }
    }
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-WebRequest -UseBasicParsing -Uri "$Url/sanctum/csrf-cookie" -WebSession $session -Headers @{ Accept = 'application/json'; Origin = $Url; Referer = "$Url/login" } | Out-Null
    $headers = Get-CsrfHeaders -Session $session
    $payload = @{ email = 'admin@techops.local'; password = $values.ADMIN_PASSWORD; remember = $false } | ConvertTo-Json
    $login = Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/v1/auth/login" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body $payload
    if ($login.StatusCode -ne 200) { throw 'Sign-in through the proxy failed.' }
    foreach ($attempt in 1..2) {
        $user = Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/v1/auth/user" -WebSession $session -Headers @{ Accept = 'application/json'; Origin = $Url }
        if (($user.Content | ConvertFrom-Json).data.email -ne 'admin@techops.local') { throw 'Authenticated session did not persist across requests.' }
    }
    $page = Invoke-WebRequest -UseBasicParsing -Uri "$Url/dashboard"
    if ($page.Content -notmatch '<div id="root">') { throw 'SPA deep-link fallback failed.' }
    $headers = Get-CsrfHeaders -Session $session
    Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/v1/auth/logout" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body '{}' | Out-Null
    $logoutRejected = $false
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/v1/auth/user" -WebSession $session -Headers @{ Accept = 'application/json'; Origin = $Url } | Out-Null
    } catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $logoutRejected = $true } else { throw }
    }
    if (-not $logoutRejected) { throw 'The session remained authenticated after logout.' }
    Write-Host 'HTTP health, CSRF, sign-in, repeated session reads, SPA routing, and logout passed.'
} finally {
    if (-not $forward.HasExited) { Stop-Process -Id $forward.Id }
}

Invoke-Kube -Arguments @('exec', 'deployment/backend', '--', 'php', 'artisan', 'tinker', '--execute=dump(config(''database.redis.client''), \Illuminate\Support\Facades\Redis::connection(''cache'')->ping());') | Out-Host
Invoke-Kube -Arguments @('exec', 'deployment/backend', '--', 'php', 'artisan', 'schedule:list') | Out-Host
Invoke-Kube -Arguments @('get', 'cronjob', 'scheduler') | Out-Host
Write-Host 'Verification finished. No business workflow records were created. The temporary port-forward has stopped.'
