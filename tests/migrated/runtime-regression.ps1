# Mocked Windows regression: no browser launch, UI action, profile or network mutation.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'runtime\host\wsl-windows\browser-runtime.ps1')
$contract = [pscustomobject]@{executable='C:\BrowserFixture\browser.exe'; profile='C:\RuntimeFixture\profile'; debugPort=9317; version='123.4.5.6'}
function Get-RuntimeConfig { $contract }
$script:launches = 0
$script:discoveryCalls = 0
$script:profileExists = $true
$script:installedVersion = $contract.version

function Assert([bool]$condition, [string]$message) { if (-not $condition) { throw $message } }
function AssertBlocked([scriptblock]$action, [string]$message) {
  $blocked = $false
  try { & $action | Out-Null } catch { $blocked = $true }
  Assert $blocked $message
}
function Fixture([int]$processId, [string]$wsId) {
  $script:processes = @([pscustomobject]@{
    ProcessId=$processId; ParentProcessId=0; ExecutablePath=$contract.executable
    CommandLine=('"' + $contract.executable + '" "--user-data-dir=' + $contract.profile + '" --remote-debugging-port=9317')
    CreationDate=[datetime]::new(2026,10,4,12,0,0).AddSeconds($processId)
  })
  $script:listeners = @([pscustomobject]@{OwningProcess=$processId})
  $script:discovery = [pscustomobject]@{Browser=('Chrome/' + $contract.version); webSocketDebuggerUrl="ws://127.0.0.1:9317/devtools/browser/$wsId"}
}
function Get-CimInstance {
  param($ClassName, $Filter)
  if (-not $Filter) { return $script:processes }
  $id = [int]($Filter -replace 'ProcessId = ', '')
  @($script:processes | Where-Object { $_.ProcessId -eq $id })
}
function Get-NetTCPConnection { param($State, $LocalPort, $ErrorAction) $script:listeners }
function Get-Item { param($LiteralPath) [pscustomobject]@{VersionInfo=[pscustomobject]@{ProductVersion=$script:installedVersion}} }
function Test-Path { param($LiteralPath, $PathType) $script:profileExists }
function Invoke-RestMethod {
  param($Uri, $TimeoutSec)
  Assert ($Uri -ceq 'http://127.0.0.1:9317/json/version') 'Discovery did not use current Windows localhost.'
  $script:discoveryCalls++
  $script:discovery
}
function Start-Process {
  param($FilePath, $ArgumentList, [switch]$PassThru)
  Assert ($FilePath -ceq $contract.executable) 'Launch substituted another browser.'
  Assert ($ArgumentList[0] -ceq ('--user-data-dir="' + $contract.profile + '"')) 'Launch did not preserve the configured profile.'
  Assert ($ArgumentList[1] -ceq '--remote-debugging-port=9317') 'Launch omitted the debugging contract.'
  $script:launches++
  Fixture 456 'fresh-process'
  [pscustomobject]@{Id=456}
}
function Start-Sleep { param($Milliseconds) }

Fixture 123 'existing-process'
Assert (Test-RuntimeProfile ([pscustomobject]@{CommandLine=('chrome --user-data-dir="' + $contract.profile + '"')})) 'Value-quoted profile argument was rejected.'
Assert (Test-RuntimeProfile $script:processes[0]) 'Whole-argument Windows profile quoting was rejected.'
Assert (-not (Test-RuntimeProfile ([pscustomobject]@{CommandLine='chrome "--user-data-dir=C:\Temp\disposable"'}))) 'Wrong profile argument was accepted.'
$existing = Ensure-Runtime
Assert (-not $existing.launched -and $script:launches -eq 0) 'Healthy instance was not reused.'
Assert ($existing.webSocketDebuggerUrl.EndsWith('/existing-process')) 'Existing process discovery is wrong.'
$script:processes = @(); $script:listeners = @()
$fresh = Ensure-Runtime
Assert ($fresh.launched -and $script:launches -eq 1) 'Fresh launch did not occur exactly once.'
Assert ($fresh.webSocketDebuggerUrl.EndsWith('/fresh-process') -and $script:discoveryCalls -ge 2) 'Fresh process reused old discovery.'
$ExpectedProcessId = $existing.process_id
$ExpectedStartedAt = $existing.started_at
$ExpectedWebSocket = $existing.webSocketDebuggerUrl
AssertBlocked { Start-RuntimeStream } 'An earlier-process endpoint was accepted.'
$script:listeners = @()
AssertBlocked { Ensure-Runtime } 'An unhealthy active profile launched another instance.'
Assert ($script:launches -eq 1) 'Conflicting launch occurred.'
Fixture 456 'fresh-process'
$script:processes[0].ExecutablePath = 'C:\OtherFixture\browser.exe'
AssertBlocked { Get-RuntimeSnapshot } 'Wrong executable was accepted by browser discovery.'
Fixture 456 'fresh-process'
$script:installedVersion = '1.0.0.0'
AssertBlocked { Ensure-Runtime } 'A version mismatch was silently accepted.'
$script:installedVersion = $contract.version
$script:profileExists = $false
AssertBlocked { Ensure-Runtime } 'Missing persistent profile was recreated.'
$script:profileExists = $true

# Duplicate root profile and occupied unrelated listener must block launch.
Fixture 456 'current'
$script:processes += [pscustomobject]@{ProcessId=789; ExecutablePath=$contract.executable; CommandLine=$script:processes[0].CommandLine; CreationDate=[datetime]::UtcNow}
AssertBlocked { Ensure-Runtime } 'Duplicate profile process was accepted.'
$script:processes = @(); $script:listeners = @([pscustomobject]@{OwningProcess=999})
AssertBlocked { Ensure-Runtime } 'Occupied port allowed a second launch.'
Assert ($script:launches -eq 1) 'Conflict started another browser.'
Write-Output 'PASS: configured reuse/launch, profile/port conflicts, version, fresh discovery, stale rejection.'
