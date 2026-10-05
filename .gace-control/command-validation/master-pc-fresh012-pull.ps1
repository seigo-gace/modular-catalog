Set-Location 'F:\G-ACE-KB\repo'
$project='Catalog'
$commit='68e7d643d0e6931e646fd8895d189fb4e1ee337d'
$processing=Join-Path 'F:\G-ACE-KB\data\knowledge-inbox\modulecatalog\processing' $commit
$receipt=Join-Path 'F:\G-ACE-KB\data\knowledge-intake\modulecatalog\receipts' ($commit+'.json')
$current='F:\G-ACE-KB\data\knowledge-records\modulecatalog-reusable-active.json'
$journal='F:\G-ACE-KB\data\knowledge-intake\modulecatalog\activation-transaction.json'
$stdout=$null
$stderr=$null
if(Test-Path $processing){ $stdout=Get-ChildItem $processing -Filter 'kb-receiver-*.stdout.log' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; $stderr=Get-ChildItem $processing -Filter 'kb-receiver-*.stderr.log' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 }
$procs=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'receive-modulecatalog-kbdata-windows|activate-modulecatalog-accepted-windows|mcp-vector-search' })
Write-Output '========== GACE_RESULT_BEGIN =========='
Write-Output "PROJECT=$project"
Write-Output "PWD=$(Get-Location)"
Write-Output 'ACTION=FRESH012_MASTER_PC_READ_ONLY_STALL_DIAGNOSTIC'
Write-Output "PROCESSING_EXISTS=$(Test-Path $processing)"
Write-Output "RECEIPT_EXISTS=$(Test-Path $receipt)"
Write-Output "CURRENT_EXISTS=$(Test-Path $current)"
Write-Output "JOURNAL_EXISTS=$(Test-Path $journal)"
Write-Output "PROCESS_COUNT=$($procs.Count)"
foreach($p in $procs){ Write-Output "PROCESS=$($p.ProcessId)|$($p.Name)|$($p.CommandLine)" }
if($stdout){ Write-Output "STDOUT_FILE=$($stdout.FullName)"; Write-Output "STDOUT_LASTWRITE=$($stdout.LastWriteTime.ToString('o'))"; Write-Output '----- RECEIVER_STDOUT_TAIL_BEGIN -----'; Get-Content $stdout.FullName -Tail 40; Write-Output '----- RECEIVER_STDOUT_TAIL_END -----' } else { Write-Output 'STDOUT_FILE=NONE' }
if($stderr){ Write-Output "STDERR_FILE=$($stderr.FullName)"; Write-Output "STDERR_LASTWRITE=$($stderr.LastWriteTime.ToString('o'))"; Write-Output '----- RECEIVER_STDERR_TAIL_BEGIN -----'; Get-Content $stderr.FullName -Tail 40; Write-Output '----- RECEIVER_STDERR_TAIL_END -----' } else { Write-Output 'STDERR_FILE=NONE' }
Write-Output 'VERIFY=READ_ONLY_STALL_EVIDENCE_COLLECTED'
Write-Output 'EXIT_CODE=0'
Write-Output 'ERROR=NONE'
Write-Output "PROJECT_END=$project"
Write-Output '========== GACE_RESULT_END =========='
