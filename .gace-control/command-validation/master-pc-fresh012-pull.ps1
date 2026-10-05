Set-Location 'F:\G-ACE-KB\repo'
$project='Catalog'
$branch='feat/reusable-asset-kb-schema-20261001'
$beforeExpected='68d0007c8297f01bd82c2bbb68ae55ec2185e5ea'
$target='93230420430ecbf6f7a5c0303b01ca637da45775'
$freshCommit='68e7d643d0e6931e646fd8895d189fb4e1ee337d'
$manifestExpected='40ea766fd8c1d8c638fe41e76b480964f104d4b5cc4a408b2c6442e2ed6dc801'
$gaceRc=0
$gaceError='NONE'
Write-Output '========== GACE_RESULT_BEGIN =========='
Write-Output "PROJECT=$project"
Write-Output "PWD=$(Get-Location)"
Write-Output 'ACTION=KB_FF_ONLY_SYNC_AND_FRESH012_DEEP_HEALTH'
$currentBranch=(& git branch --show-current 2>$null | Select-Object -First 1)
$before=(& git rev-parse HEAD 2>$null | Select-Object -First 1)
$dirty=@(& git status --porcelain --untracked-files=no 2>$null)
Write-Output "BRANCH=$currentBranch"
Write-Output "BEFORE_HEAD=$before"
if($currentBranch -ne $branch){$gaceRc=2;$gaceError='KB_BRANCH_MISMATCH'}
if($gaceRc -eq 0 -and $before -ne $beforeExpected){$gaceRc=3;$gaceError='KB_HEAD_CHANGED'}
if($gaceRc -eq 0 -and $dirty.Count -ne 0){$gaceRc=4;$gaceError='KB_TRACKED_DIRTY'}
if($gaceRc -eq 0){& git fetch --no-tags origin "refs/heads/$branch"; if($LASTEXITCODE -ne 0){$gaceRc=5;$gaceError='KB_FETCH_FAILED'}}
if($gaceRc -eq 0){$remote=(& git rev-parse FETCH_HEAD 2>$null | Select-Object -First 1);Write-Output "REMOTE_HEAD=$remote";if($remote -ne $target){$gaceRc=6;$gaceError='KB_REMOTE_HEAD_NOT_EXPECTED'}}
if($gaceRc -eq 0){& git merge-base --is-ancestor $before $target; if($LASTEXITCODE -ne 0){$gaceRc=7;$gaceError='KB_FF_ONLY_PRECONDITION_FAILED'}}
if($gaceRc -eq 0){& git merge --ff-only FETCH_HEAD; if($LASTEXITCODE -ne 0){$gaceRc=8;$gaceError='KB_FF_ONLY_SYNC_FAILED'}}
$after=(& git rev-parse HEAD 2>$null | Select-Object -First 1)
Write-Output "AFTER_HEAD=$after"
if($gaceRc -eq 0 -and $after -ne $target){$gaceRc=9;$gaceError='KB_POST_SYNC_HEAD_MISMATCH'}
if($gaceRc -eq 0){& powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'F:\G-ACE-KB\repo\scripts\check-modulecatalog-kb-runtime-windows.ps1' -Root 'F:\G-ACE-KB' -Deep; $healthRc=$LASTEXITCODE; Write-Output "DEEP_HEALTH_EXIT=$healthRc"; if($healthRc -ne 0){$gaceRc=10;$gaceError='FRESH012_DEEP_HEALTH_FAILED'}}
$receiptPath="F:\G-ACE-KB\data\knowledge-intake\modulecatalog\receipts\$freshCommit.json"
$currentPath='F:\G-ACE-KB\data\knowledge-records\modulecatalog-reusable-active.json'
$archive="F:\G-ACE-KB\data\knowledge-inbox\modulecatalog\processed\$freshCommit"
$journal='F:\G-ACE-KB\data\knowledge-intake\modulecatalog\activation-transaction.json'
if($gaceRc -eq 0 -and (!(Test-Path $receiptPath) -or !(Test-Path $currentPath) -or !(Test-Path $archive) -or (Test-Path $journal))){$gaceRc=11;$gaceError='FRESH012_RUNTIME_AUTHORITY_PATH_MISMATCH'}
if($gaceRc -eq 0){$receipt=Get-Content $receiptPath -Raw|ConvertFrom-Json;$current=Get-Content $currentPath -Raw|ConvertFrom-Json;Write-Output "RECEIPT_STATUS=$($receipt.status)";Write-Output "CURRENT_STATUS=$($current.status)";Write-Output "CURRENT_COMMIT=$($current.catalogCommit)";Write-Output "CURRENT_MANIFEST=$($current.deliveryManifestSha256)";if($receipt.status -ne 'ACTIVE' -or $current.status -ne 'ACTIVE' -or $receipt.catalogCommit -ne $freshCommit -or $current.catalogCommit -ne $freshCommit -or $receipt.deliveryManifestSha256 -ne $manifestExpected -or $current.deliveryManifestSha256 -ne $manifestExpected){$gaceRc=12;$gaceError='FRESH012_RUNTIME_IDENTITY_MISMATCH'}}
$verify=if($gaceRc -eq 0){'FRESH012_KB_ACTIVE_DEEP_HEALTH_PASS'}else{'FAIL'}
Write-Output "VERIFY=$verify"
Write-Output "EXIT_CODE=$gaceRc"
Write-Output "ERROR=$gaceError"
Write-Output "PROJECT_END=$project"
Write-Output '========== GACE_RESULT_END =========='
