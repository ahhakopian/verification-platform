# Controlled Windows identities only: no Chrome, network, launch or profile access.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'runtime\host\wsl-windows\browser-runtime.ps1')
function Assert([bool]$ok, [string]$message) { if (-not $ok) { throw $message } }
$script:fullScans=0; $script:configReads=0; $script:targetReads=0
function Fixture {
 $script:config=[pscustomobject]@{executable='C:\Fixture\chrome.exe'; profile='C:\Fixture\profile'; debugPort=9317; version='123.4.5.6'}
 $script:process=[pscustomobject]@{ProcessId=123; ExecutablePath=$config.executable; CommandLine='chrome "--user-data-dir=C:\Fixture\profile" --remote-debugging-port=9317'; CreationDate=[datetime]::new(2026,10,4,12,0,0,[DateTimeKind]::Utc)}
 $script:listeners=@([pscustomobject]@{OwningProcess=123})
 $script:discovery=[pscustomobject]@{Browser='Chrome/123.4.5.6'; webSocketDebuggerUrl='ws://127.0.0.1:9317/devtools/browser/current'}
 $script:profileExists=$true; $script:version=$config.version; $script:duplicate=$false; $script:changeDuringDiscovery=$false; $script:targetReads=0
}
function Get-RuntimeConfig { $script:configReads++; $script:config }
function Test-Path { param($LiteralPath,$PathType) $script:profileExists }
function Get-Item { param($LiteralPath) [pscustomobject]@{VersionInfo=[pscustomobject]@{ProductVersion=$script:version}} }
function Get-NetTCPConnection { param($State,$LocalPort,$ErrorAction) $script:listeners }
function Get-CimInstance {
 param($ClassName,$Filter)
 if (-not $Filter) {
  $script:fullScans++
  if($script:process){$script:process | Select-Object *}
  if($script:duplicate){[pscustomobject]@{ProcessId=456; CommandLine=$script:process.CommandLine}}
 } else {
  Assert ($Filter -ceq 'ProcessId = 123') 'Unexpected process selection during targeted revalidation.'
  $script:targetReads++
  if($script:changeDuringDiscovery -and $script:targetReads -eq 2){$script:process.CreationDate=$script:process.CreationDate.AddSeconds(1)}
  if($script:process){$script:process | Select-Object *}
 }
}
function Invoke-RestMethod {
 param($Uri,$TimeoutSec)
 Assert ($Uri -ceq "http://127.0.0.1:$($script:config.debugPort)/json/version" -and $TimeoutSec -eq 5) 'Discovery endpoint/timeout changed.'
 $script:discovery
}
function Start-Process { throw 'Launch is forbidden in this test.' }
function ExpectBlocked([scriptblock]$mutation) {
 Fixture
 & $mutation
 $before=$script:fullScans; $blocked=$false
 try {Get-RuntimeSnapshot -Revalidate | Out-Null} catch {$blocked=$true}
 Assert $blocked ('Changed identity was accepted: ' + $mutation.ToString())
 Assert ($script:fullScans -eq $before) 'Rejected revalidation performed a full profile scan.'
}
$writer=[System.IO.StringWriter]::new(); $stderr=[Console]::Error
try {
 [Console]::SetError($writer)
 Fixture
 $established=Get-RuntimeSnapshot
 Assert ($script:fullScans -eq 1 -and $script:configReads -eq 1) 'Selection must scan profiles once and reuse that invocation config.'
 $ExpectedProcessId=$established.process_id; $ExpectedStartedAt=$established.started_at; $ExpectedWebSocket=$established.webSocketDebuggerUrl
 $ExpectedBinary=$established.binary; $ExpectedProfile=$established.profile; $ExpectedVersion=$established.version
 for($i=0;$i -lt 3;$i++){
  $script:targetReads=0
  $current=Get-RuntimeSnapshot -Revalidate
  Assert ($current.webSocketDebuggerUrl -ceq $ExpectedWebSocket -and $script:targetReads -eq 2) 'Targeted incarnation continuity was not checked before/after discovery.'
 }
 Assert ($script:fullScans -eq 1) 'Revalidation repeated full profile enumeration.'
 $script:transportDiagnosticCount=0
 ExpectBlocked {$script:config.executable='C:\Other\chrome.exe'}
 ExpectBlocked {$script:config.profile='C:\Other\profile'}
 ExpectBlocked {$script:config.debugPort=9320}
 ExpectBlocked {$script:version='other'}
 ExpectBlocked {$script:profileExists=$false}
 ExpectBlocked {$script:listeners=@()}
 ExpectBlocked {$script:listeners=@([pscustomobject]@{OwningProcess=456})}
 ExpectBlocked {$script:listeners+=([pscustomobject]@{OwningProcess=456})}
 ExpectBlocked {$script:process=$null}
 ExpectBlocked {$script:process.ExecutablePath='C:\Other\chrome.exe'}
 ExpectBlocked {$script:process.CommandLine='chrome --user-data-dir=C:\Other\profile --remote-debugging-port=9317'}
 ExpectBlocked {$script:process.CommandLine='chrome --user-data-dir=C:\Fixture\profile --remote-debugging-port=9320'}
 ExpectBlocked {$script:process.CommandLine+=' --headless'}
 ExpectBlocked {$script:process.CreationDate=$script:process.CreationDate.AddSeconds(1)}
 ExpectBlocked {$script:discovery.Browser='Chrome/other'}
 ExpectBlocked {$script:discovery.webSocketDebuggerUrl='ws://127.0.0.1:9317/devtools/browser/changed'}
 ExpectBlocked {$script:discovery.webSocketDebuggerUrl='ws://192.0.2.1:9317/devtools/browser/current'}
 ExpectBlocked {$script:changeDuringDiscovery=$true}
 Fixture; $script:duplicate=$true; $blocked=$false
 try {Get-RuntimeSnapshot | Out-Null} catch {$blocked=$true}
 Assert $blocked 'Full selection accepted duplicate profile roots.'
 # Exercise the actual relay entry with an inert byte-stream implementation.
 # Its pre-connect guard must use targeted revalidation, never full selection.
 Add-Type 'public static class BrowserStream { public static int Port; public static void Run(int port) { Port=port; } }'
 function Add-Type { param($TypeDefinition) }
 Fixture; $before=$script:fullScans
 Start-RuntimeStream
 Assert ($script:fullScans -eq $before -and [BrowserStream]::Port -eq 9317) 'Relay did not reuse the narrowly validated endpoint.'
 [BrowserStream]::Port=0; $script:process.CreationDate=$script:process.CreationDate.AddSeconds(1); $blocked=$false
 try {Start-RuntimeStream} catch {$blocked=$true}
 Assert ($blocked -and [BrowserStream]::Port -eq 0) 'Relay connected before rejecting a changed incarnation.'
} finally {[Console]::SetError($stderr)}
Assert ($writer.ToString().Contains('powershell-windows-revalidation') -and $writer.ToString().Contains('duration_ms')) 'Revalidation diagnostics were lost.'
'PASS: full selection, scan/config-read counts, targeted continuity, 18 mismatch cases, selection ambiguity and phase diagnostics; all Windows/browser operations mocked.'
