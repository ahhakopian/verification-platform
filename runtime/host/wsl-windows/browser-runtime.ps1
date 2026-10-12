param(
  [ValidateSet('inspect','ensure','relay','baseline','revalidate')][Alias('Operation')][string]$RuntimeOperation = 'inspect',
  [string]$ConfigPath,
  [int]$ExpectedProcessId,
  [string]$ExpectedStartedAt,
  [string]$ExpectedWebSocket,
  [string]$ExpectedBinary,
  [string]$ExpectedProfile,
  [string]$ExpectedVersion
)
$ErrorActionPreference = 'Stop'
$script:transportDiagnosticCount = 0
$script:transportDiagnosticPhase = 'powershell-startup'
function Write-TransportDiagnostic([string]$Phase, [string]$Event, $DurationMs = $null, [string]$Detail = '') {
  if ($script:transportDiagnosticCount -ge 64) { return }
  $script:transportDiagnosticCount++
  try {
    $record = @{diagnostic='chrome-transport'; source='powershell'; pid=$PID; timestamp=[DateTime]::UtcNow.ToString('o'); phase=$Phase; event=$Event}
    if ($null -ne $DurationMs) { $record.duration_ms = $DurationMs }
    if ($Detail) { $record.detail = $Detail.Substring(0, [Math]::Min(4096, $Detail.Length)) }
    [Console]::Error.WriteLine(($record | ConvertTo-Json -Compress))
  } catch { } # Diagnostics never change transport outcomes.
}
function Start-TransportPhase([string]$Phase) {
  $script:transportDiagnosticPhase = $Phase
  Write-TransportDiagnostic $Phase 'start'
  $script:transportDiagnosticClock = [System.Diagnostics.Stopwatch]::StartNew()
  $script:transportDiagnosticClock
}
function Stop-TransportPhase([string]$Phase, $Clock) {
  Write-TransportDiagnostic $Phase 'end' ([Math]::Round($Clock.Elapsed.TotalMilliseconds, 3))
}
function Get-RuntimeConfig {
  if (-not $ConfigPath) { throw 'Explicit runtime ConfigPath is required.' }
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  foreach ($key in @('executable','profile')) {
    $value = [string]$config.$key
    if (-not $value -or $value -match '["\r\n]' -or $value -notmatch '^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+\\)') { throw "Explicit absolute Windows $key is required." }
  }
  if ($config.debugPort -isnot [int] -or $config.debugPort -lt 1 -or $config.debugPort -gt 65535) { throw 'Explicit debugPort in 1..65535 is required.' }
  if ($config.PSObject.Properties['version'] -and ($config.version -isnot [string] -or -not $config.version)) { throw 'Optional exact version must be a nonempty string.' }
  $config
}
function Test-RuntimeProfile($process, $config = (Get-RuntimeConfig)) {
  $match = [regex]::Match([string]$process.CommandLine, '(?:^|\s)(?:"--user-data-dir=([^"]+)"|--user-data-dir="([^"]+)"|--user-data-dir=(\S+))(?=\s|$)')
  $value = @($match.Groups | Select-Object -Skip 1 | Where-Object { $_.Success } | Select-Object -ExpandProperty Value -First 1)
  $match.Success -and $value.Count -eq 1 -and $value[0] -ieq $config.profile
}
function Get-RuntimeWindowProcess([int]$WindowProcessId, $config = (Get-RuntimeConfig)) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $WindowProcessId"
  $seen = @{}
  while ($process -and $process.ExecutablePath -ieq $config.executable -and $process.CommandLine -match '(?:^|\s)--type=') {
    if ($seen.ContainsKey([int]$process.ProcessId)) { throw 'Process parent cycle.' }
    $seen[[int]$process.ProcessId] = $true
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)"
  }
  if (-not $process -or $process.ExecutablePath -ine $config.executable -or -not (Test-RuntimeProfile $process $config)) { throw 'Configured browser/process/profile is unproved.' }
  if ($config.version -and (Get-Item -LiteralPath $config.executable).VersionInfo.ProductVersion -cne $config.version) { throw 'Browser version constraint failed.' }
  if ($process.CommandLine -match '(?:^|\s)--headless(?:[=\s]|$)') { throw 'Headed browser is required.' }
  $process
}
function Get-RuntimeSnapshot([switch]$Revalidate) {
  $inspectionPhase = if ($Revalidate) { 'powershell-windows-revalidation' } else { 'powershell-windows-inspection' }
  $inspectionClock = Start-TransportPhase $inspectionPhase
  $config = Get-RuntimeConfig
  if ($Revalidate -and ($ExpectedProcessId -le 0 -or -not $ExpectedStartedAt -or -not $ExpectedWebSocket -or
      $ExpectedBinary -ine $config.executable -or $ExpectedProfile -ine $config.profile -or -not $ExpectedVersion)) {
    throw 'Established runtime identity is missing or configured runtime changed.'
  }
  if (-not (Test-Path -LiteralPath $config.profile -PathType Container)) { throw 'Persistent profile is missing; do not recreate it.' }
  $version = (Get-Item -LiteralPath $config.executable).VersionInfo.ProductVersion
  if (-not $version -or ($config.version -and $version -cne $config.version)) { throw 'Browser version constraint failed.' }
  if ($Revalidate -and $version -cne $ExpectedVersion) { throw 'Established browser version changed.' }
  $phaseClock = Start-TransportPhase 'windows-listener-inspection'
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $config.debugPort -ErrorAction SilentlyContinue)
  Stop-TransportPhase 'windows-listener-inspection' $phaseClock
  $owners = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($owners.Count -ne 1) { throw 'Debugging listener is absent or ambiguous.' }
  $phaseClock = Start-TransportPhase 'windows-process-inspection'
  if ($Revalidate -and $owners[0] -ne $ExpectedProcessId) { throw 'Established debug listener owner changed.' }
  $process = Get-RuntimeWindowProcess $owners[0] $config
  Stop-TransportPhase 'windows-process-inspection' $phaseClock
  $portPattern = '(?:^|\s)--remote-debugging-port=' + $config.debugPort + '(?:\s|$)'
  if ($process.ProcessId -ne $owners[0] -or $process.CommandLine -notmatch $portPattern) { throw 'Debug port is not owned by the intended browser root.' }
  if ($Revalidate) {
    if ($process.CreationDate.ToUniversalTime().ToString('o') -cne $ExpectedStartedAt) { throw 'Established browser process incarnation changed.' }
  } else {
    # Profile uniqueness selects the runtime once. Later checks prove that exact
    # root process/profile/listener/UUID, rather than selecting another runtime.
    $phaseClock = Start-TransportPhase 'windows-profile-inspection'
    $profiles = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -notmatch '(?:^|\s)--type=' -and (Test-RuntimeProfile $_ $config) })
    Stop-TransportPhase 'windows-profile-inspection' $phaseClock
    if ($profiles.Count -ne 1 -or $profiles[0].ProcessId -ne $process.ProcessId) { throw 'Conflicting process uses the configured profile.' }
  }
  $phaseClock = Start-TransportPhase 'windows-json-version'
  $discovery = Invoke-RestMethod -Uri "http://127.0.0.1:$($config.debugPort)/json/version" -TimeoutSec 5
  Stop-TransportPhase 'windows-json-version' $phaseClock
  $ws = [uri]$discovery.webSocketDebuggerUrl
  if ($discovery.Browser -cne "Chrome/$version" -or $ws.Scheme -cne 'ws' -or $ws.Host -notin @('127.0.0.1','localhost','[::1]') -or
      $ws.Port -ne $config.debugPort -or $ws.AbsolutePath -notmatch '^/devtools/browser/[^/]+$' -or $ws.Query -or $ws.Fragment) { throw 'Fresh browser discovery is invalid.' }
  if ($Revalidate -and $discovery.webSocketDebuggerUrl -cne $ExpectedWebSocket) { throw 'Established browser WebSocket identity changed.' }
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
  if (-not $current -or $current.CreationDate -ne $process.CreationDate) { throw 'Browser process changed during discovery.' }
  Stop-TransportPhase $inspectionPhase $inspectionClock
  [pscustomobject]@{status='ok'; binary=$config.executable; version=$version; profile=$config.profile
    process_id=[int]$process.ProcessId; started_at=$process.CreationDate.ToUniversalTime().ToString('o'); webSocketDebuggerUrl=$discovery.webSocketDebuggerUrl}
}
function Get-ClosedBaselineState {
  $config = Get-RuntimeConfig
  if (-not (Test-Path -LiteralPath $config.profile -PathType Container)) { throw 'Persistent profile is missing; do not recreate it.' }
  $version = (Get-Item -LiteralPath $config.executable).VersionInfo.ProductVersion
  if (-not $version -or ($config.version -and $version -cne $config.version)) { throw 'Browser version constraint failed.' }
  $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  # Inaccessible candidate processes cannot establish absence. Never kill them.
  $name = [System.IO.Path]::GetFileName($config.executable)
  $unknown = @($processes | Where-Object {
    (($_.Name -ieq $name -or $_.ExecutablePath -ieq $config.executable) -and
      (-not $_.ExecutablePath -or -not $_.CommandLine)) -or
    ($_.ExecutablePath -ieq $config.executable -and $_.CommandLine -notmatch '(?:^|\s)--type=' -and
      $_.CommandLine -notmatch '(?:^|\s)(?:"--user-data-dir=[^"]+"|--user-data-dir="[^"]+"|--user-data-dir=\S+)(?=\s|$)')
  })
  if ($unknown.Count) { throw 'Configured browser process state is inaccessible or ambiguous.' }
  $profiles = @($processes | Where-Object { $_.CommandLine -notmatch '(?:^|\s)--type=' -and (Test-RuntimeProfile $_) })
  # Query all connections so query failure is not mistaken for an empty port result.
  $listeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $_.State -eq 'Listen' -and $_.LocalPort -eq $config.debugPort })
  if ($profiles.Count -eq 0 -and $listeners.Count -eq 0) {
    return [pscustomobject]@{status='ok'; state='STOPPED'; binary=$config.executable; profile=$config.profile; version=$version; profileProcessCount=0; listenerCount=0}
  }
  $owners = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($profiles.Count -ne 1 -or $owners.Count -ne 1) { throw 'Configured browser/profile/listener baseline is ambiguous or unhealthy.' }
  $snapshot = Get-RuntimeSnapshot
  if ($snapshot.process_id -ne $profiles[0].ProcessId -or $snapshot.process_id -ne $owners[0]) { throw 'Baseline process/listener identity changed.' }
  $snapshot | Add-Member -NotePropertyName state -NotePropertyValue 'RUNNING'
  $snapshot
}
function Ensure-Runtime {
  $mutex = [System.Threading.Mutex]::new($false, 'Local\BrowserVerificationLaunch')
  if (-not $mutex.WaitOne(10000)) { $mutex.Dispose(); throw 'Another verifier launch is in progress.' }
  try {
    $config = Get-RuntimeConfig
    if (-not (Test-Path -LiteralPath $config.profile -PathType Container)) { throw 'Persistent profile is missing; do not recreate it.' }
    $version = (Get-Item -LiteralPath $config.executable).VersionInfo.ProductVersion
    if (-not $version -or ($config.version -and $version -cne $config.version)) { throw 'Browser version constraint failed.' }
    $active = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -notmatch '(?:^|\s)--type=' -and (Test-RuntimeProfile $_) })
    if ($active.Count -gt 0) {
      $snapshot = Get-RuntimeSnapshot
      $snapshot | Add-Member -NotePropertyName launched -NotePropertyValue $false
      return $snapshot
    }
    if (@(Get-NetTCPConnection -State Listen -LocalPort $config.debugPort -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Debug port is occupied.' }
    $child = Start-Process -FilePath $config.executable -ArgumentList @(
      ('--user-data-dir="' + $config.profile + '"'), ('--remote-debugging-port=' + $config.debugPort)
    ) -PassThru
    $lastError = 'Browser did not start.'
    for ($attempt=0; $attempt -lt 20; $attempt++) {
      try {
        $snapshot = Get-RuntimeSnapshot
        if ($snapshot.process_id -ne $child.Id) { throw 'A different process acquired the listener.' }
        $snapshot | Add-Member -NotePropertyName launched -NotePropertyValue $true
        return $snapshot
      } catch { $lastError = $_.Exception.Message }
      Start-Sleep -Milliseconds 500
    }
    throw $lastError
  } finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
function Start-RuntimeStream {
  $snapshot = Get-RuntimeSnapshot -Revalidate
  if ($snapshot.process_id -ne $ExpectedProcessId -or $snapshot.started_at -cne $ExpectedStartedAt -or $snapshot.webSocketDebuggerUrl -cne $ExpectedWebSocket) { throw 'Process/discovery changed; fresh setup is required.' }
  $initializationClock = Start-TransportPhase 'relay-initialization'
  Add-Type @'
using System;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading.Tasks;
public static class BrowserStream {
  private static void Diagnostic(string phase, string state, Stopwatch clock) {
    try {
      Console.Error.WriteLine("{\"diagnostic\":\"chrome-transport\",\"source\":\"relay\",\"pid\":" + Process.GetCurrentProcess().Id +
        ",\"timestamp\":\"" + DateTime.UtcNow.ToString("o") + "\",\"phase\":\"" + phase + "\",\"event\":\"" + state +
        "\",\"duration_ms\":" + clock.Elapsed.TotalMilliseconds.ToString("F3", System.Globalization.CultureInfo.InvariantCulture) + "}");
    } catch { }
  }
  public static void Run(int port) {
    var clock = Stopwatch.StartNew();
    Diagnostic("chrome-tcp-connect", "start", clock);
    try { using (var client = new TcpClient("127.0.0.1", port)) {
      Diagnostic("chrome-tcp-connect", "end", clock);
      var network = client.GetStream();
      var upstream = Console.OpenStandardInput().CopyToAsync(network);
      var downstream = network.CopyToAsync(Console.OpenStandardOutput());
      Task.WaitAny(upstream, downstream);
    } } catch { Diagnostic("chrome-tcp-connect", "error", clock); throw; }
  }
}
'@
  Stop-TransportPhase 'relay-initialization' $initializationClock
  [BrowserStream]::Run(([uri]$snapshot.webSocketDebuggerUrl).Port)
}
if ($MyInvocation.InvocationName -ne '.') {
  try {
    if ($RuntimeOperation -eq 'relay') { Start-RuntimeStream }
    else {
      $snapshot = if ($RuntimeOperation -eq 'baseline') { Get-ClosedBaselineState } elseif ($RuntimeOperation -eq 'ensure') { Ensure-Runtime } elseif ($RuntimeOperation -eq 'revalidate') { Get-RuntimeSnapshot -Revalidate } else { Get-RuntimeSnapshot }
      $snapshot | ConvertTo-Json -Compress
    }
  } catch {
    $duration = if ($script:transportDiagnosticClock) { [Math]::Round($script:transportDiagnosticClock.Elapsed.TotalMilliseconds, 3) } else { $null }
    Write-TransportDiagnostic $script:transportDiagnosticPhase 'error' $duration ($_.Exception.ToString())
    if ($RuntimeOperation -eq 'relay') { [Console]::Error.WriteLine($_.Exception.Message) }
    else { [pscustomobject]@{status='BLOCKED'; detail=$_.Exception.Message} | ConvertTo-Json -Compress }
    exit 1
  }
}
