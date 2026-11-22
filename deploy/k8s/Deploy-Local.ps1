#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$RenderOnly,
    [switch]$SkipBuild,
    [ValidatePattern('^[a-z0-9][a-z0-9.-]{0,39}$')]
    [string]$ImageTag,
    [ValidateRange(60, 900)]
    [int]$TimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'
$KubeContext = 'docker-desktop'
$DockerContext = 'desktop-linux'
$Namespace = 'techops-learning'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$PrivateDirectory = Join-Path $PSScriptRoot '.local'
$SecretsPath = Join-Path $PrivateDirectory 'secrets.env'
$RunId = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
if (-not $ImageTag) {
    if ($SkipBuild) { throw '-SkipBuild requires the -ImageTag of a previous build.' }
    $ImageTag = 'learning-' + $RunId
}
$BootstrapJob = 'techops-bootstrap-' + $RunId

function Invoke-Kube {
    param([string[]]$Arguments, [string]$InputText)
    if ($PSBoundParameters.ContainsKey('InputText')) {
        $result = $InputText | & kubectl --context $KubeContext --namespace $Namespace @Arguments
    } else {
        $result = & kubectl --context $KubeContext --namespace $Namespace @Arguments
    }
    if ($LASTEXITCODE -ne 0) { throw "kubectl failed (exit $LASTEXITCODE). See the diagnostic above." }
    return $result
}

function Get-KubeJson {
    param([string[]]$Arguments)
    $result = @(Invoke-Kube -Arguments $Arguments) -join "`n"
    if ($result.Trim()) { return ($result | ConvertFrom-Json) }
    return $null
}

function Apply-Object {
    param([object]$Object)
    Invoke-Kube -Arguments @('apply', '-f', '-') -InputText ($Object | ConvertTo-Json -Depth 40) | Out-Host
}

function Invoke-Docker {
    param([string[]]$Arguments)
    & docker --context $DockerContext @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker failed (exit $LASTEXITCODE). See the diagnostic above." }
}

function Wait-ForJob {
    param([string]$Name)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $job = Get-KubeJson -Arguments @('get', 'job', $Name, '-o', 'json')
        if ($job.status.succeeded -ge 1) { return }
        if (@($job.status.conditions | Where-Object { $_.type -in @('Failed', 'FailureTarget') -and $_.status -eq 'True' }).Count -gt 0) {
            Invoke-Kube -Arguments @('logs', "job/$Name", '--all-containers=true', '--tail=50') | Out-Host
            throw "Job $Name failed. No database reset or automatic reseed will be attempted."
        }
        Start-Sleep -Seconds 2
    }
    Invoke-Kube -Arguments @('get', 'pods', '-o', 'wide') | Out-Host
    throw "Timed out waiting for job $Name. Inspect it with kubectl --context $KubeContext -n $Namespace describe job $Name."
}

function New-ImageCheck {
    param([string]$Component, [string]$Image, [string[]]$Command)
    $name = "techops-image-$Component-$RunId"
    Apply-Object -Object @{
        apiVersion = 'batch/v1'; kind = 'Job'
        metadata = @{ name = $name; namespace = $Namespace; labels = @{ 'app.kubernetes.io/part-of' = $Namespace } }
        spec = @{
            backoffLimit = 0; activeDeadlineSeconds = 90; ttlSecondsAfterFinished = 600
            template = @{ spec = @{
                restartPolicy = 'Never'; automountServiceAccountToken = $false
                containers = @(@{
                    name = 'image-check'; image = $Image; imagePullPolicy = 'Never'; command = $Command
                    resources = @{ requests = @{ cpu = '25m'; memory = '32Mi' }; limits = @{ cpu = '250m'; memory = '128Mi' } }
                })
            } }
        }
    }
    Wait-ForJob -Name $name
}

function New-RandomBytes {
    param([int]$Length)
    $bytes = New-Object byte[] $Length
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ,$bytes
}

function Get-SecretFingerprint {
    param([System.Collections.IDictionary]$Values)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Values['APP_KEY'] + "`n" + $Values['DB_PASSWORD'])
        return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
    } finally { $sha.Dispose() }
}

function Write-PrivateSecrets {
    param([System.Collections.IDictionary]$Values)
    if ($env:OS -ne 'Windows_NT') { throw 'This helper targets Windows PowerShell and Docker Desktop.' }
    New-Item -ItemType Directory -Path $PrivateDirectory -Force | Out-Null
    $acl = Get-Acl -LiteralPath $PrivateDirectory
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $PrivateDirectory -AclObject $acl
    $lines = foreach ($key in @('APP_KEY', 'DB_PASSWORD', 'ADMIN_PASSWORD')) { "$key=$($Values[$key])" }
    [System.IO.File]::WriteAllLines($SecretsPath, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Set-InitializationMarker {
    param([string]$Fingerprint, [string]$JobName)
    Apply-Object -Object @{
        apiVersion = 'v1'; kind = 'ConfigMap'
        metadata = @{ name = 'techops-initialized'; namespace = $Namespace; labels = @{ 'app.kubernetes.io/part-of' = $Namespace } }
        data = @{ database = 'techops_learning'; secretFingerprint = $Fingerprint; bootstrapJob = $JobName; initializedAt = (Get-Date).ToUniversalTime().ToString('o') }
    }
}

function Set-Suspended {
    param([string]$Kind, [string]$Name, [bool]$Suspended)
    # A file avoids Windows PowerShell 5.1 stripping JSON quotes from native args.
    $patchPath = Join-Path $PrivateDirectory 'suspend-patch.json'
    $patch = @{ spec = @{ suspend = $Suspended } } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($patchPath, $patch, (New-Object System.Text.UTF8Encoding($false)))
    Invoke-Kube -Arguments @('patch', $Kind, $Name, '--type=merge', '--patch-file', $patchPath) | Out-Host
}

Get-Command kubectl -ErrorAction Stop | Out-Null
$rendered = @(& kubectl kustomize $PSScriptRoot) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Kustomize rendering failed.' }
$rendered = $rendered.Replace('techops-k8s-backend:local', "techops-k8s-backend:$ImageTag")
$rendered = $rendered.Replace('techops-k8s-frontend:local', "techops-k8s-frontend:$ImageTag")
$rendered = $rendered.Replace('techops-bootstrap-local', $BootstrapJob)
if ($RenderOnly) { Write-Output $rendered; return }

Get-Command docker -ErrorAction Stop | Out-Null
$contexts = @(& kubectl config get-contexts -o name)
if ($LASTEXITCODE -ne 0 -or $contexts -notcontains $KubeContext) {
    throw 'No docker-desktop Kubernetes context exists. Open Docker Desktop > Kubernetes > Create cluster > kubeadm (single node), then rerun this helper. Do not reset an existing cluster.'
}
Invoke-Docker -Arguments @('info', '--format', '{{.ServerVersion}}') | Out-Host
$nodes = Get-KubeJson -Arguments @('get', 'nodes', '-o', 'json', '--request-timeout=15s')
if (@($nodes.items).Count -ne 1 -or $nodes.items[0].metadata.name -ne 'docker-desktop') {
    throw 'This helper supports the Docker Desktop single-node kubeadm cluster only. It will not modify a different cluster.'
}
if (-not ($nodes.items[0].status.conditions | Where-Object { $_.type -eq 'Ready' -and $_.status -eq 'True' })) {
    throw 'The Docker Desktop Kubernetes node is not Ready. Wait for it in Docker Desktop and rerun.'
}
$versions = Get-KubeJson -Arguments @('version', '-o', 'json', '--request-timeout=15s')
$clientMinor = [int]($versions.clientVersion.minor -replace '\D', '')
$serverMinor = [int]($versions.serverVersion.minor -replace '\D', '')
if ($serverMinor -lt 27 -or [math]::Abs($clientMinor - $serverMinor) -gt 1) {
    throw 'Use Kubernetes 1.27+ and a kubectl client within one minor version of the server. Update Docker Desktop/kubectl before deploying.'
}
$storage = Get-KubeJson -Arguments @('get', 'storageclass', '-o', 'json')
$defaults = @($storage.items | Where-Object {
    $_.metadata.annotations.'storageclass.kubernetes.io/is-default-class' -eq 'true' -or
    $_.metadata.annotations.'storageclass.beta.kubernetes.io/is-default-class' -eq 'true'
})
if ($defaults.Count -ne 1) { throw 'The learning cluster needs exactly one default StorageClass to provision its separate PostgreSQL PVC.' }

$existingNamespace = Get-KubeJson -Arguments @('get', 'namespace', $Namespace, '--ignore-not-found', '-o', 'json')
if ($existingNamespace -and $existingNamespace.metadata.labels.'app.kubernetes.io/part-of' -ne $Namespace) {
    throw 'The techops-learning namespace already exists without the expected ownership label. Inspect it before deployment.'
}
Apply-Object -Object @{ apiVersion = 'v1'; kind = 'Namespace'; metadata = @{ name = $Namespace; labels = @{ 'app.kubernetes.io/part-of' = $Namespace } } }

$runningBootstrap = Get-KubeJson -Arguments @('get', 'jobs', '-l', 'app.kubernetes.io/component=bootstrap', '-o', 'json')
if (@($runningBootstrap.items | Where-Object { $_.status.active -gt 0 }).Count -gt 0) {
    throw 'Another bootstrap Job is active. Wait for it or inspect its failure before deploying again.'
}

if (-not $SkipBuild) {
    Write-Host 'Building isolated, versioned learning images...'
    Invoke-Docker -Arguments @('build', '-t', "techops-k8s-backend:$ImageTag", (Join-Path $ProjectRoot 'backend')) | Out-Host
    Invoke-Docker -Arguments @('build', '--build-arg', 'VITE_API_URL=/', '-t', "techops-k8s-frontend:$ImageTag", (Join-Path $ProjectRoot 'frontend')) | Out-Host
}
foreach ($image in @("techops-k8s-backend:$ImageTag", "techops-k8s-frontend:$ImageTag")) {
    Invoke-Docker -Arguments @('image', 'inspect', $image, '--format', '{{.Id}}') | Out-Host
}
# Also prove that Kubernetes sees these local images before creating data storage.
New-ImageCheck -Component 'backend' -Image "techops-k8s-backend:$ImageTag" -Command @('php', '--ri', 'redis')
New-ImageCheck -Component 'frontend' -Image "techops-k8s-frontend:$ImageTag" -Command @('nginx', '-t')

$existingSecret = Get-KubeJson -Arguments @('get', 'secret', 'techops-secrets', '--ignore-not-found', '-o', 'json')
$marker = Get-KubeJson -Arguments @('get', 'configmap', 'techops-initialized', '--ignore-not-found', '-o', 'json')
$values = [ordered]@{}
if (Test-Path -LiteralPath $SecretsPath) {
    foreach ($line in Get-Content -LiteralPath $SecretsPath) {
        if ($line -match '^(APP_KEY|DB_PASSWORD|ADMIN_PASSWORD)=(.+)$') { $values[$Matches[1]] = $Matches[2] }
    }
} elseif ($existingSecret) {
    foreach ($key in @('APP_KEY', 'DB_PASSWORD', 'ADMIN_PASSWORD')) {
        $values[$key] = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($existingSecret.data.$key))
    }
    Write-PrivateSecrets -Values $values
} else {
    $existingPvc = Get-KubeJson -Arguments @('get', 'pvc', 'techops-postgres-data', '--ignore-not-found', '-o', 'json')
    if ($marker -or $existingPvc) { throw 'Persistent learning state exists but its secrets are missing. Restore the original secrets; automatic credential rotation is refused.' }
    $values['APP_KEY'] = 'base64:' + [Convert]::ToBase64String((New-RandomBytes -Length 32))
    $values['DB_PASSWORD'] = [BitConverter]::ToString((New-RandomBytes -Length 24)).Replace('-', '').ToLowerInvariant()
    $values['ADMIN_PASSWORD'] = [BitConverter]::ToString((New-RandomBytes -Length 16)).Replace('-', '').ToLowerInvariant()
    Write-PrivateSecrets -Values $values
}
foreach ($key in @('APP_KEY', 'DB_PASSWORD', 'ADMIN_PASSWORD')) {
    if (-not $values[$key]) { throw "The private secrets file is missing $key. No new credentials were generated." }
    if ($existingSecret) {
        $clusterValue = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($existingSecret.data.$key))
        if ($clusterValue -cne $values[$key]) { throw 'Local and cluster secrets differ. Restore matching originals; automatic rotation is refused.' }
    }
}
$fingerprint = Get-SecretFingerprint -Values $values
if ($marker -and ($marker.data.database -ne 'techops_learning' -or $marker.data.secretFingerprint -ne $fingerprint)) {
    throw 'Initialization marker does not match the learning database credentials. Refusing to continue.'
}
# Recover the marker if the helper was interrupted after a successful first seed.
if (-not $marker) {
    $previous = @($runningBootstrap.items | Where-Object {
        $_.status.succeeded -ge 1 -and $_.metadata.annotations.'techops.io/initial-seed' -eq 'true' -and
        $_.metadata.annotations.'techops.io/secret-fingerprint' -eq $fingerprint
    }) | Select-Object -First 1
    if ($previous) {
        Set-InitializationMarker -Fingerprint $fingerprint -JobName $previous.metadata.name
        $marker = Get-KubeJson -Arguments @('get', 'configmap', 'techops-initialized', '-o', 'json')
    }
}

Write-Host 'Validating the rendered resources against the local API server...'
Invoke-Kube -Arguments @('apply', '--dry-run=server', '-f', '-') -InputText $rendered | Out-Host
Apply-Object -Object @{ apiVersion = 'v1'; kind = 'Secret'; type = 'Opaque'; metadata = @{ name = 'techops-secrets'; namespace = $Namespace }; stringData = $values }

$currentCron = Get-KubeJson -Arguments @('get', 'cronjob', 'scheduler', '--ignore-not-found', '-o', 'json')
if ($currentCron) {
    Set-Suspended -Kind 'cronjob' -Name 'scheduler' -Suspended $true
    foreach ($activeJob in $currentCron.status.active) { Wait-ForJob -Name $activeJob.name }
}
# The manifest keeps application replicas at zero and the new bootstrap Job suspended.
Invoke-Kube -Arguments @('apply', '-f', '-') -InputText $rendered | Out-Host
Invoke-Kube -Arguments @('wait', '--for=jsonpath={.status.phase}=Bound', 'pvc/techops-postgres-data', "--timeout=$($TimeoutSeconds)s") | Out-Host
Invoke-Kube -Arguments @('rollout', 'status', 'statefulset/postgres', "--timeout=$($TimeoutSeconds)s") | Out-Host
Invoke-Kube -Arguments @('rollout', 'status', 'deployment/redis', "--timeout=$($TimeoutSeconds)s") | Out-Host

$seed = if ($marker) { 'false' } else { 'true' }
Apply-Object -Object @{ apiVersion = 'v1'; kind = 'ConfigMap'; metadata = @{ name = 'techops-bootstrap-mode'; namespace = $Namespace }; data = @{ SEED_INITIAL_DATA = $seed } }
Invoke-Kube -Arguments @('annotate', 'job', $BootstrapJob, "techops.io/initial-seed=$seed", "techops.io/secret-fingerprint=$fingerprint", '--overwrite') | Out-Host
Set-Suspended -Kind 'job' -Name $BootstrapJob -Suspended $false
Wait-ForJob -Name $BootstrapJob
Invoke-Kube -Arguments @('logs', "job/$BootstrapJob", '--tail=30') | Out-Host
if (-not $marker) { Set-InitializationMarker -Fingerprint $fingerprint -JobName $BootstrapJob }

Invoke-Kube -Arguments @('scale', 'deployment/backend', 'deployment/frontend', '--replicas=1') | Out-Host
Invoke-Kube -Arguments @('rollout', 'status', 'deployment/backend', "--timeout=$($TimeoutSeconds)s") | Out-Host
Invoke-Kube -Arguments @('rollout', 'status', 'deployment/frontend', "--timeout=$($TimeoutSeconds)s") | Out-Host
Set-Suspended -Kind 'cronjob' -Name 'scheduler' -Suspended $false

$deploymentInfo = @{ imageTag = $ImageTag; bootstrapJob = $BootstrapJob; context = $KubeContext; namespace = $Namespace; url = 'http://127.0.0.1:8080' }
[System.IO.File]::WriteAllText((Join-Path $PrivateDirectory 'last-deployment.json'), ($deploymentInfo | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "`nLearning deployment ready. Admin email: admin@techops.local"
Write-Host "Read ADMIN_PASSWORD privately from: $SecretsPath"
Write-Host 'Run this in a terminal and keep it open:'
Write-Host 'kubectl --context docker-desktop -n techops-learning port-forward --address 127.0.0.1 service/frontend 8080:80'
Write-Host 'Then open http://127.0.0.1:8080. No Windows database or Compose volume was modified.'
