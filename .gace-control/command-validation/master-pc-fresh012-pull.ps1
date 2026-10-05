Set-Location 'F:\G-ACE-KB\repo'
$project='Catalog'
$tmp=Join-Path $env:TEMP 'gace-fresh012-pull.ps1'
$expectedBlob='b9c2988e1ce78e3e63374522b2fe1757ecf4fd2e'
$pullRc=97
Write-Output '========== GACE_RESULT_BEGIN =========='
Write-Output "PROJECT=$project"
Write-Output "PWD=$(Get-Location)"
Write-Output 'ACTION=FRESH012_MASTER_PC_OFFICIAL_PULL'
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
& scp.exe -q -o BatchMode=yes -o ConnectTimeout=15 'contabo:/home/admin1/projects/Catalog/modular-catalog/scripts/pull-modulecatalog-kb-delivery-windows.ps1' $tmp
$copyRc=$LASTEXITCODE
$blob='MISSING'
if($copyRc -eq 0 -and (Test-Path $tmp)){ $blob=(& git hash-object $tmp).Trim() }
Write-Output "SCRIPT_COPY_EXIT=$copyRc"
Write-Output "SCRIPT_BLOB=$blob"
if($copyRc -eq 0 -and $blob -eq $expectedBlob){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tmp -ServerHost 'contabo' -RemoteOutboxRoot '/home/admin1/logs/modulecatalog/outbox' -CatalogCommit '68e7d643d0e6931e646fd8895d189fb4e1ee337d' -ExpectedManifestSha256 '40ea766fd8c1d8c638fe41e76b480964f104d4b5cc4a408b2c6442e2ed6dc801' -Root 'F:\G-ACE-KB' -ConnectTimeoutSec 15
  $pullRc=$LASTEXITCODE
}
$verify='FAIL'
$error='OFFICIAL_PULL_NOT_RUN_OR_FAILED'
if($copyRc -eq 0 -and $blob -eq $expectedBlob -and $pullRc -eq 0){ $verify='FRESH012_KB_PULL_HELPER_PASS'; $error='NONE' }
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Output "PULL_EXIT=$pullRc"
Write-Output "VERIFY=$verify"
Write-Output "EXIT_CODE=$pullRc"
Write-Output "ERROR=$error"
Write-Output "PROJECT_END=$project"
Write-Output '========== GACE_RESULT_END =========='
