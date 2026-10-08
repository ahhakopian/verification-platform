param(
  [Parameter(Position=0, Mandatory=$true)][ValidateSet('windows','tree','inspect','invoke','expand')][string]$Operation,
  [string]$ConfigPath,
  [string]$WindowCriteria,
  [string]$ElementCriteria
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'browser-runtime.ps1') -ConfigPath $ConfigPath
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
function Read-Criteria([string]$json) {
  if (-not $json) { throw 'Explicit UIA criteria JSON is required.' }
  $criteria = $json | ConvertFrom-Json
  if ($criteria -isnot [pscustomobject] -or @($criteria.PSObject.Properties).Count -eq 0) { throw 'Nonempty UIA criteria object is required.' }
  foreach ($property in $criteria.PSObject.Properties) {
    if ($property.Name -notin @('name','type','class','id','handle','processId')) { throw 'Unsupported UIA criterion.' }
    if ($property.Name -in @('handle','processId')) {
      if ($property.Value -isnot [int] -and $property.Value -isnot [long]) { throw 'UIA process/handle criterion must be an integer.' }
    } elseif ($property.Value -isnot [string]) { throw 'UIA text criterion must be a string.' }
  }
  $criteria
}
function Info($element) {
  $c = $element.Current
  [pscustomobject]@{name=$c.Name; type=$c.ControlType.ProgrammaticName; class=$c.ClassName; id=$c.AutomationId
    processId=$c.ProcessId; handle=$c.NativeWindowHandle; enabled=$c.IsEnabled; offscreen=$c.IsOffscreen
    patterns=@($element.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName })}
}
function Matches($element, $criteria) {
  $info = Info $element
  foreach ($property in $criteria.PSObject.Properties) {
    if ($info.($property.Name) -cne $property.Value) { return $false }
  }
  $true
}
function Unique($items) {
  $array = @($items)
  if ($array.Count -eq 0) { throw 'UIA element not found.' }
  if ($array.Count -ne 1) { throw 'Ambiguous UIA element selection.' }
  $array[0]
}
function Descendants($element) {
  @($element.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition))
}
function InDocument($element, $window) {
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $current = $element
  while ($current -and -not [System.Windows.Automation.Automation]::Compare($current,$window)) {
    if ($current.Current.ControlType -eq [System.Windows.Automation.ControlType]::Document) { return $true }
    $current = $walker.GetParent($current)
  }
  $false
}
function RuntimeWindows($snapshot) {
  $children = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
    [System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  @($children | Where-Object {
    try {
      $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window -and
      (Get-RuntimeWindowProcess $_.Current.ProcessId).ProcessId -eq $snapshot.process_id
    } catch { $false }
  })
}
function Resolve-Element($window, $criteria) {
  Unique @(Descendants $window | Where-Object { -not (InDocument $_ $window) -and (Matches $_ $criteria) })
}
function Pattern($element, $patternId) {
  $found = $null
  if ($element.TryGetCurrentPattern($patternId, [ref]$found)) { return $found }
  $null
}
function Invoke-Semantic($element, [string]$operation) {
  if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen) { throw 'UIA element is disabled or offscreen.' }
  if ($operation -eq 'invoke') {
    $pattern = Pattern $element ([System.Windows.Automation.InvokePattern]::Pattern)
    if (-not $pattern) { throw 'Unsupported InvokePattern; no action performed.' }
    $script:NativePhase = 'action'; $script:NativeAttempted = $true
    $pattern.Invoke()
  } elseif ($operation -eq 'expand') {
    $pattern = Pattern $element ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    if (-not $pattern) { throw 'Unsupported ExpandCollapsePattern; no action performed.' }
    $script:NativePhase = 'action'; $script:NativeAttempted = $true
    $pattern.Expand()
  } else { throw 'Unsupported semantic operation.' }
}
# Function definitions are loaded by regression tests without executing desktop actions.
if ($MyInvocation.InvocationName -ne '.') {
  $script:NativePhase = 'readiness'; $script:NativeAttempted = $false
  try {
    $snapshot = Get-RuntimeSnapshot
    $script:NativePhase = 'observation'
    $windows = @(RuntimeWindows $snapshot)
    if ($Operation -eq 'windows') { $data = @($windows | ForEach-Object { Info $_ }) }
    else {
      $windowFilter = Read-Criteria $WindowCriteria
      $window = Unique @($windows | Where-Object { Matches $_ $windowFilter })
      if ($Operation -eq 'tree') { $data = @(Descendants $window | Where-Object { -not (InDocument $_ $window) } | ForEach-Object { Info $_ }) }
      else {
        $elementFilter = Read-Criteria $ElementCriteria
        $element = Resolve-Element $window $elementFilter
        $data = Info $element
        if ($Operation -in @('invoke','expand')) {
          $current = Get-RuntimeSnapshot
          if ($current.process_id -ne $snapshot.process_id -or $current.started_at -cne $snapshot.started_at -or $current.webSocketDebuggerUrl -cne $snapshot.webSocketDebuggerUrl) { throw 'Runtime changed before native action.' }
          $liveWindow = Unique @(RuntimeWindows $current | Where-Object { Matches $_ $windowFilter })
          if (-not $liveWindow.Current.IsEnabled -or $liveWindow.Current.IsOffscreen) { throw 'Selected window is disabled or offscreen.' }
          $live = Resolve-Element $liveWindow $elementFilter
          if (-not [System.Windows.Automation.Automation]::Compare($window,$liveWindow) -or
              -not [System.Windows.Automation.Automation]::Compare($element,$live)) { throw 'UIA selection changed before action.' }
          Invoke-Semantic $live $Operation
        }
      }
    }
    [pscustomobject]@{status='ok'; operation=$Operation; data=$data; phase=$script:NativePhase; attempted=$script:NativeAttempted} | ConvertTo-Json -Compress -Depth 8
  } catch {
    [pscustomobject]@{status='error'; detail=$_.Exception.Message; phase=$script:NativePhase; attempted=$script:NativeAttempted} | ConvertTo-Json -Compress
    exit 1
  }
}
