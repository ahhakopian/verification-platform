# Runtime config parsing with synthetic external JSON; no browser/desktop action.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'runtime\host\wsl-windows\browser-runtime.ps1')
function Assert([bool]$condition,[string]$message) { if (-not $condition) { throw $message } }
function AssertBlocked([scriptblock]$action,[string]$message) {
  $blocked=$false; try { & $action | Out-Null } catch { $blocked=$true }
  Assert $blocked $message
}
$ConfigPath = [System.IO.Path]::GetTempFileName()
try {
  $valid = @{executable='D:\Fixture\runtime.exe'; profile='D:\Fixture\profile'; debugPort=9321}
  $valid | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath
  $config = Get-RuntimeConfig
  Assert ($config.executable -ceq $valid.executable -and $config.profile -ceq $valid.profile -and $config.debugPort -eq 9321) 'External runtime config not preserved.'
  Assert (-not $config.PSObject.Properties['version']) 'Version constraint was added implicitly.'
  foreach ($invalid in @(
    @{}, @{executable='relative.exe'; profile=$valid.profile; debugPort=9321},
    @{executable=$valid.executable; profile=$valid.profile; debugPort=$true},
    @{executable=$valid.executable; profile=$valid.profile; debugPort=0},
    @{executable=$valid.executable; profile=$valid.profile; debugPort=9321; version=''}
  )) {
    $invalid | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath
    AssertBlocked { Get-RuntimeConfig } 'Invalid external config accepted.'
  }
} finally { [System.IO.File]::Delete($ConfigPath) }
Write-Output 'PASS: external runtime config parsing, required values, optional version and invalid-input rejection.'
