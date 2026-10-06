param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[A-Za-z0-9._@:-]+$')]
    [string]$ServerHost,

    [Parameter(Mandatory=$true)]
    [ValidatePattern('^/[A-Za-z0-9._/-]+$')]
    [string]$RemoteOutboxRoot,

    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$CatalogCommit,

    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$ExpectedManifestSha256,

    [string]$Root = 'F:\G-ACE-KB',
    [string]$SshExe = 'ssh.exe',
    [string]$ScpExe = 'scp.exe',
    [int]$SshPort = 0,
    [int]$ConnectTimeoutSec = 15
)

$ErrorActionPreference = 'Stop'
$CatalogCommit = $CatalogCommit.ToLowerInvariant()
$ExpectedManifestSha256 = $ExpectedManifestSha256.ToLowerInvariant()
$RemoteOutboxRoot = $RemoteOutboxRoot.TrimEnd('/')
$FinalizationBranch = 'feat/reusable-knowledge-factory-v1-20261002'
$RemoteCatalogRepo = '/home/admin1/projects/Catalog/modular-catalog'

if (($RemoteOutboxRoot -split '/') -contains '..' -or ($RemoteOutboxRoot -split '/') -contains '.') {
    throw "MODULECATALOG_REMOTE_OUTBOX_PATH_UNSAFE=$RemoteOutboxRoot"
}
if ($SshPort -lt 0 -or $SshPort -gt 65535) { throw "MODULECATALOG_SSH_PORT_INVALID=$SshPort" }
if ($ConnectTimeoutSec -lt 1 -or $ConnectTimeoutSec -gt 120) { throw "MODULECATALOG_SSH_TIMEOUT_INVALID=$ConnectTimeoutSec" }

$SshCommand = Get-Command $SshExe -ErrorAction SilentlyContinue
$ScpCommand = Get-Command $ScpExe -ErrorAction SilentlyContinue
if ($null -eq $SshCommand) { throw "MODULECATALOG_SSH_NOT_FOUND=$SshExe" }
if ($null -eq $ScpCommand) { throw "MODULECATALOG_SCP_NOT_FOUND=$ScpExe" }

$Repo = Join-Path $Root 'repo'
$InboxBase = Join-Path $Root 'data\knowledge-inbox\modulecatalog'
$ReadyRoot = Join-Path $InboxBase 'ready'
$ProcessingRoot = Join-Path $InboxBase 'processing'
$ProcessedRoot = Join-Path $InboxBase 'processed'
$FailedRoot = Join-Path $InboxBase 'failed'
$Processor = Join-Path $Repo 'scripts\process-modulecatalog-inbox-windows.ps1'
$Health = Join-Path $Repo 'scripts\check-modulecatalog-kb-runtime-windows.ps1'
$ReceiptPath = Join-Path $Root "data\knowledge-intake\modulecatalog\receipts\$CatalogCommit.json"
$CurrentPath = Join-Path $Root 'data\knowledge-records\modulecatalog-reusable-active.json'
$ProcessedDelivery = Join-Path $ProcessedRoot $CatalogCommit
$FinalReady = Join-Path $ReadyRoot $CatalogCommit

foreach ($path in @($Root,$Repo,$InboxBase,$ReadyRoot,$ProcessingRoot,$ProcessedRoot,$FailedRoot,$Processor,$Health)) {
    if (-not (Test-Path $path)) { throw "MODULECATALOG_REQUIRED_PATH_MISSING=$path" }
}

function Get-FileSha256Lower {
    param([Parameter(Mandatory=$true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Assert-ManifestContract {
    param([Parameter(Mandatory=$true)][string]$ManifestPath)
    if (-not (Test-Path $ManifestPath)) { throw "MODULECATALOG_MANIFEST_MISSING=$ManifestPath" }
    $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
    if ([int]$manifest.schema_version -ne 1) { throw 'MODULECATALOG_MANIFEST_SCHEMA_UNSUPPORTED' }
    if ([string]$manifest.format -ne 'gace.reusable-asset.v1') { throw 'MODULECATALOG_MANIFEST_FORMAT_UNSUPPORTED' }
    if ([string]$manifest.catalog.repository -ne 'seigo-gace/modular-catalog') { throw "MODULECATALOG_MANIFEST_REPOSITORY_MISMATCH=$($manifest.catalog.repository)" }
    if ([string]$manifest.catalog.commit -ne $CatalogCommit) { throw "MODULECATALOG_MANIFEST_COMMIT_MISMATCH=$($manifest.catalog.commit)" }
    $assets = @($manifest.assets)
    if ([int]$manifest.assetCount -ne $assets.Count -or $assets.Count -lt 1) { throw 'MODULECATALOG_MANIFEST_ASSET_COUNT_INVALID' }
    return $manifest
}

function Assert-ActiveIdentity {
    param([Parameter(Mandatory=$true)][string]$ExpectedManifestSha256)
    if (-not (Test-Path $ReceiptPath)) { throw "MODULECATALOG_ACTIVE_RECEIPT_MISSING=$ReceiptPath" }
    if (-not (Test-Path $CurrentPath)) { throw "MODULECATALOG_CURRENT_MARKER_MISSING=$CurrentPath" }
    $receipt = Get-Content $ReceiptPath -Raw | ConvertFrom-Json
    $current = Get-Content $CurrentPath -Raw | ConvertFrom-Json
    foreach ($item in @($receipt,$current)) {
        if ([string]$item.status -ne 'ACTIVE') { throw "MODULECATALOG_ACTIVE_STATUS_MISMATCH=$($item.status)" }
        if ([string]$item.catalogCommit -ne $CatalogCommit) { throw "MODULECATALOG_ACTIVE_COMMIT_MISMATCH=$($item.catalogCommit)" }
        if ([string]$item.deliveryManifestSha256 -ne $ExpectedManifestSha256) { throw "MODULECATALOG_ACTIVE_MANIFEST_MISMATCH=$($item.deliveryManifestSha256)" }
    }
}

function Invoke-DeepHealth {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Health -Root $Root -Deep
    if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_DEEP_HEALTH_FAILED=$LASTEXITCODE" }
}

function Invoke-InboxProcessor {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Processor -Root $Root
    if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_INBOX_PROCESSOR_FAILED=$LASTEXITCODE" }
}

$remoteDelivery = "$RemoteOutboxRoot/$CatalogCommit"
$remoteManifest = "$remoteDelivery/manifest.json"
$sshArgs = @('-o','BatchMode=yes','-o',"ConnectTimeout=$ConnectTimeoutSec")
$scpArgs = @('-o','BatchMode=yes','-o',"ConnectTimeout=$ConnectTimeoutSec")
if ($SshPort -gt 0) {
    $sshArgs += @('-p',[string]$SshPort)
    $scpArgs += @('-P',[string]$SshPort)
}

# Final delivery freshness gate: a previously approved/sealed snapshot becomes stale
# as soon as the authoritative Catalog finalization branch advances. Refuse transport
# before any KB-side idempotent/resume path or SCP can consume stale data.
$remoteSourceHeadOutput = & $SshExe @sshArgs $ServerHost "git -C $RemoteCatalogRepo rev-parse HEAD"
if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_REMOTE_SOURCE_HEAD_READ_FAILED=$LASTEXITCODE" }
$remoteSourceHead = (($remoteSourceHeadOutput | Out-String).Trim()).ToLowerInvariant()
if ($remoteSourceHead -notmatch '^[0-9a-f]{40}$') { throw "MODULECATALOG_REMOTE_SOURCE_HEAD_INVALID=$remoteSourceHead" }
$remoteSourceBranchOutput = & $SshExe @sshArgs $ServerHost "git -C $RemoteCatalogRepo branch --show-current"
if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_REMOTE_SOURCE_BRANCH_READ_FAILED=$LASTEXITCODE" }
$remoteSourceBranch = (($remoteSourceBranchOutput | Out-String).Trim())
if ($remoteSourceBranch -ne $FinalizationBranch) { throw "MODULECATALOG_REMOTE_SOURCE_BRANCH_MISMATCH expected=$FinalizationBranch actual=$remoteSourceBranch" }
if ($remoteSourceHead -ne $CatalogCommit) { throw "MODULECATALOG_STALE_FINAL_DELIVERY expected_current=$remoteSourceHead requested=$CatalogCommit" }

$remoteHashOutput = & $SshExe @sshArgs $ServerHost "sha256sum -- $remoteManifest"
if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_REMOTE_MANIFEST_READ_FAILED=$LASTEXITCODE" }
$remoteHashText = (($remoteHashOutput | Out-String).Trim() -split '\s+')[0].ToLowerInvariant()
if ($remoteHashText -notmatch '^[0-9a-f]{64}$') { throw "MODULECATALOG_REMOTE_MANIFEST_HASH_INVALID=$remoteHashText" }
if ($remoteHashText -ne $ExpectedManifestSha256) {
    throw "MODULECATALOG_REMOTE_MANIFEST_APPROVAL_MISMATCH expected=$ExpectedManifestSha256 actual=$remoteHashText"
}

# Fast idempotent path: the exact delivery is already the active/current KB and its
# processed archive exists. No transport or reactivation is performed.
if (Test-Path $ProcessedDelivery) {
    $processedManifest = Join-Path $ProcessedDelivery 'manifest.json'
    [void](Assert-ManifestContract -ManifestPath $processedManifest)
    $processedHash = Get-FileSha256Lower -Path $processedManifest
    if ($processedHash -ne $ExpectedManifestSha256) { throw 'MODULECATALOG_PROCESSED_DELIVERY_IDENTITY_CONFLICT' }
    Assert-ActiveIdentity -ExpectedManifestSha256 $ExpectedManifestSha256
    Invoke-DeepHealth
    Write-Host "GACE_MODULECATALOG_PULL=PASS IDEMPOTENT=YES STATUS=ACTIVE COMMIT=$CatalogCommit MANIFEST=$ExpectedManifestSha256 ARCHIVE=$ProcessedDelivery"
    return
}

$processingDirs = @(Get-ChildItem $ProcessingRoot -Directory)
if ($processingDirs.Count -gt 0) {
    if ($processingDirs.Count -eq 1 -and $processingDirs[0].Name -eq $CatalogCommit) {
        $processingManifest = Join-Path $processingDirs[0].FullName 'manifest.json'
        [void](Assert-ManifestContract -ManifestPath $processingManifest)
        if ((Get-FileSha256Lower -Path $processingManifest) -ne $ExpectedManifestSha256) { throw 'MODULECATALOG_PROCESSING_DELIVERY_IDENTITY_CONFLICT' }
        Invoke-InboxProcessor
        if (-not (Test-Path $ProcessedDelivery)) { throw "MODULECATALOG_PROCESSED_ARCHIVE_MISSING=$ProcessedDelivery" }
        Assert-ActiveIdentity -ExpectedManifestSha256 $ExpectedManifestSha256
        Invoke-DeepHealth
        Write-Host "GACE_MODULECATALOG_PULL=PASS RESUMED=YES STATUS=ACTIVE COMMIT=$CatalogCommit MANIFEST=$ExpectedManifestSha256 ARCHIVE=$ProcessedDelivery"
        return
    }
    $names = ($processingDirs | ForEach-Object { $_.Name }) -join ','
    throw "MODULECATALOG_RECEIVER_BUSY=$names"
}

$readyDirs = @(Get-ChildItem $ReadyRoot -Directory)
$otherReady = @($readyDirs | Where-Object { $_.Name -ne $CatalogCommit })
if ($otherReady.Count -gt 0) {
    $names = ($otherReady | ForEach-Object { $_.Name }) -join ','
    throw "MODULECATALOG_READY_OCCUPIED=$names"
}
if (Test-Path $FinalReady) {
    $readyManifest = Join-Path $FinalReady 'manifest.json'
    [void](Assert-ManifestContract -ManifestPath $readyManifest)
    if ((Get-FileSha256Lower -Path $readyManifest) -ne $ExpectedManifestSha256) { throw 'MODULECATALOG_READY_DELIVERY_IDENTITY_CONFLICT' }
    Invoke-InboxProcessor
    if (-not (Test-Path $ProcessedDelivery)) { throw "MODULECATALOG_PROCESSED_ARCHIVE_MISSING=$ProcessedDelivery" }
    Assert-ActiveIdentity -ExpectedManifestSha256 $ExpectedManifestSha256
    Invoke-DeepHealth
    Write-Host "GACE_MODULECATALOG_PULL=PASS RESUMED_READY=YES STATUS=ACTIVE COMMIT=$CatalogCommit MANIFEST=$ExpectedManifestSha256 ARCHIVE=$ProcessedDelivery"
    return
}

$tempParent = Join-Path $InboxBase ('.pull-' + $CatalogCommit.Substring(0,12) + '-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempParent | Out-Null
try {
    & $ScpExe @scpArgs -r "$ServerHost`:$remoteDelivery" $tempParent
    if ($LASTEXITCODE -ne 0) { throw "MODULECATALOG_SCP_FAILED=$LASTEXITCODE" }

    $localDelivery = Join-Path $tempParent $CatalogCommit
    $localManifest = Join-Path $localDelivery 'manifest.json'
    [void](Assert-ManifestContract -ManifestPath $localManifest)
    $localHash = Get-FileSha256Lower -Path $localManifest
    if ($localHash -ne $ExpectedManifestSha256) {
        throw "MODULECATALOG_TRANSFER_MANIFEST_MISMATCH expected=$ExpectedManifestSha256 local=$localHash"
    }

    # Final publish is a same-filesystem directory rename. The KB never sees the
    # partially transferred directory under ready/.
    Move-Item -Path $localDelivery -Destination $FinalReady
    if ((Get-FileSha256Lower -Path (Join-Path $FinalReady 'manifest.json')) -ne $ExpectedManifestSha256) {
        throw 'MODULECATALOG_READY_READBACK_MISMATCH'
    }
}
finally {
    Remove-Item $tempParent -Recurse -Force -ErrorAction SilentlyContinue
}

Invoke-InboxProcessor
if (-not (Test-Path $ProcessedDelivery)) { throw "MODULECATALOG_PROCESSED_ARCHIVE_MISSING=$ProcessedDelivery" }
Assert-ActiveIdentity -ExpectedManifestSha256 $ExpectedManifestSha256
Invoke-DeepHealth
Write-Host "GACE_MODULECATALOG_PULL=PASS STATUS=ACTIVE COMMIT=$CatalogCommit MANIFEST=$ExpectedManifestSha256 ARCHIVE=$ProcessedDelivery"
