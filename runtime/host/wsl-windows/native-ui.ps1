param(
  [Parameter(Position=0, Mandatory=$true)][ValidateSet('windows','tree','inspect','invoke','expand','menu-bind','menu-focus','menu-tree','menu-next','menu-invoke','menu-expand')][string]$Operation,
  [string]$ConfigPath,
  [string]$WindowCriteria,
  [string]$ElementCriteria,
  [string]$MenuRequest
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
    processId=$c.ProcessId; handle=$c.NativeWindowHandle; enabled=$c.IsEnabled; offscreen=$c.IsOffscreen; keyboardFocusable=$c.IsKeyboardFocusable
    runtimeId=@($element.GetRuntimeId()); patterns=@($element.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName })}
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
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeMenuWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
}
'@
function Get-MenuForegroundHandle { [NativeMenuWindow]::GetForegroundWindow().ToInt64() }
function Test-MenuWindowMinimized([long]$handle) { [NativeMenuWindow]::IsIconic([IntPtr]$handle) }
function Restore-MenuWindow([long]$handle) { [NativeMenuWindow]::ShowWindow([IntPtr]$handle, 9) }
function Request-MenuForeground([long]$handle) { [NativeMenuWindow]::SetForegroundWindow([IntPtr]$handle) }
function Owned-WindowHandle([long]$handle, [long]$source) {
  if (-not $handle -or -not $source) { return $false }
  $seen = @{}
  while ($handle) {
    if ($handle -eq $source) { return $true }
    if ($seen.ContainsKey($handle)) { return $false }
    $seen[$handle] = $true
    $handle = [NativeMenuWindow]::GetWindow([IntPtr]$handle, 4).ToInt64()
  }
  $false
}
function Menu-Ancestry($element, $window) {
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $current = $element
  $ancestry = @()
  while ($current -and -not [System.Windows.Automation.Automation]::Compare($current, [System.Windows.Automation.AutomationElement]::RootElement)) {
    $ancestry += Info $current
    if ([System.Windows.Automation.Automation]::Compare($current, $window)) { break }
    $current = $walker.GetParent($current)
  }
  $ancestry
}
function Menu-Owned($element, $window) {
  foreach ($ancestor in @(Menu-Ancestry $element $window)) {
    if ((@($ancestor.runtimeId) -join ',') -ceq (@($window.GetRuntimeId()) -join ',')) { return $true }
    if (Owned-WindowHandle $ancestor.handle $window.Current.NativeWindowHandle) { return $true }
  }
  $false
}
function Menu-Info($element, $window) {
  $info = Info $element
  $info | Add-Member -NotePropertyName items -NotePropertyValue @(Menu-Items $element | ForEach-Object { Info $_ })
  $info | Add-Member -NotePropertyName ancestry -NotePropertyValue @(Menu-Ancestry $element $window)
  $info
}
function Same-RuntimeId($element, $identity) {
  if (-not $identity -or @($identity).Count -eq 0) { return $false }
  (@($element.GetRuntimeId()) -join ',') -ceq (@($identity) -join ',')
}
function Menu-Roots($snapshot, $window) {
  $desktop = [System.Windows.Automation.AutomationElement]::RootElement
  $ownedWindows = @(RuntimeWindows $snapshot | Where-Object { Owned-WindowHandle $_.Current.NativeWindowHandle $window.Current.NativeWindowHandle })
  $items = @($desktop.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition))
  foreach ($ownedWindow in $ownedWindows) { $items += @(Descendants $ownedWindow) }
  $seen = @{}
  @($items | Where-Object {
    try {
      $key = @($_.GetRuntimeId()) -join ','
      if ($seen.ContainsKey($key)) { return $false }
      $seen[$key] = $true
      $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Menu -and $_.Current.IsEnabled -and -not $_.Current.IsOffscreen -and
      -not (InDocument $_ $window) -and (Menu-Owned $_ $window) -and
      (Get-RuntimeWindowProcess $_.Current.ProcessId).ProcessId -eq $snapshot.process_id
    } catch { $false }
  })
}
function Menu-Items($root) {
  @($root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object {
    $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::MenuItem
  })
}
function Menu-Containers($item) {
  @($item.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Menu })
}
function Resolve-MenuPath($root, $path) {
  if (-not $path -or @($path).Count -eq 0) { throw 'Nonempty exact menu path required.' }
  $parent = $root
  foreach ($label in $path) {
    if ($label -isnot [string] -or -not $label) { throw 'Exact nonempty menu label required.' }
    $item = Unique @(Menu-Items $parent | Where-Object { $_.Current.Name -ceq $label })
    $parent = $item
    # Nested menu containers remain scoped to this selected parent.
    $containers = @(Menu-Containers $item)
    if ($containers.Count -gt 1) { throw 'Ambiguous submenu container.' }
    if ($containers.Count -eq 1) { $parent = $containers[0] }
  }
  $item
}
function Matches-MenuWindowTitle([string]$name, [string]$nonce) {
  if ($name -ceq $nonce) { return $true }
  # Chrome's localized native title separator is not always an ASCII hyphen.
  foreach ($separator in @(' - ', (' ' + [char]0x2013 + ' '), (' ' + [char]0x2014 + ' '))) {
    if ($name.StartsWith($nonce + $separator, [System.StringComparison]::Ordinal)) { return $true }
  }
  $false
}
function Assert-MenuBinding($snapshot, $request, [bool]$RequireForeground = $true, [bool]$ExactForeground = $false) {
  if (-not $request.targetId -or $request.nonce -notmatch '^vp-menu-[a-f0-9-]+$') { throw 'Concrete browser target/title binding required.' }
  $config = Get-RuntimeConfig
  $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:$($config.debugPort)/json/list" -TimeoutSec 5)
  $target = Unique @($targets | Where-Object { $_.id -ceq $request.targetId -and $_.type -ceq 'page' -and $_.title -ceq $request.nonce })
  $window = Unique @(RuntimeWindows $snapshot | Where-Object { Matches-MenuWindowTitle $_.Current.Name $request.nonce })
  if ($request.windowRuntimeId -and -not (Same-RuntimeId $window $request.windowRuntimeId)) { throw 'Bound native window changed.' }
  if (-not $window.Current.IsEnabled -or ($window.Current.IsOffscreen -and ($RequireForeground -or -not (Test-MenuWindowMinimized $window.Current.NativeWindowHandle)))) { throw 'Bound window is disabled or offscreen.' }
  if ($RequireForeground) {
    $foreground = Get-MenuForegroundHandle
    if ($ExactForeground) {
      if ($foreground -ne $window.Current.NativeWindowHandle) { throw 'Exact source window is not foreground.' }
    } elseif (-not (Owned-WindowHandle $foreground $window.Current.NativeWindowHandle)) { throw 'Source window or its owned popup is not foreground.' }
  }
  if ($request.runtime) {
    foreach ($key in @('process_id','started_at','webSocketDebuggerUrl')) {
      if ($snapshot.$key -cne $request.runtime.$key) { throw 'Menu runtime incarnation changed.' }
    }
  }
  $window
}
function Menu-Handle($element, $window) {
  foreach ($ancestor in @(Menu-Ancestry $element $window)) { if ($ancestor.handle) { return [long]$ancestor.handle } }
  0
}
function Menu-PopupIdentity($element, $window) {
  $handle = Menu-Handle $element $window
  [pscustomobject]@{runtimeId=@($element.GetRuntimeId());handle=$handle;owner=$(if ($handle) { [NativeMenuWindow]::GetWindow([IntPtr]$handle,4).ToInt64() } else { 0 });name=$element.Current.Name}
}
function Menu-ChildRoots($snapshot, $window, $root, $item, $association = $null) {
  $pattern = Pattern $item ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  if (-not $pattern -or $pattern.Current.ExpandCollapseState -ne [System.Windows.Automation.ExpandCollapseState]::Expanded) { throw 'Parent menu item is not semantically expanded.' }
  $structural = @(); $siblings = @(); $evidence = @()
  if (@(Menu-Items $item).Count -gt 0) { $structural += $item }
  foreach ($candidate in @(Menu-Roots $snapshot $window)) {
    if (Same-RuntimeId $candidate @($root.GetRuntimeId())) { continue }
    $underItem = $false
    foreach ($ancestor in @(Menu-Ancestry $candidate $window)) {
      if ((@($ancestor.runtimeId) -join ',') -ceq (@($item.GetRuntimeId()) -join ',')) { $underItem = $true; break }
    }
    $identity = Menu-PopupIdentity $candidate $window
    $rootHandle = Menu-Handle $root $window
    $rootOwner = if ($rootHandle) { [NativeMenuWindow]::GetWindow([IntPtr]$rootHandle,4).ToInt64() } else { 0 }
    if ($underItem -or ($identity.handle -and $rootHandle -and $identity.handle -ne $rootHandle -and (Owned-WindowHandle $identity.owner $rootHandle))) { $structural += $candidate; continue }
    $decision = 'rejected'
    $boundHandle = [long]$window.Current.NativeWindowHandle
    $causal = $association -and (Same-RuntimeId $item $association.parentRuntimeId) -and $item.Current.Name -ceq $association.parentLabel -and (Same-RuntimeId $root $association.rootRuntimeId) -and $association.boundWindowHandle -eq $boundHandle -and (Same-RuntimeId $window $association.boundWindowRuntimeId) -and $association.rootHandle -eq $rootHandle -and $association.boundRuntime.process_id -eq $snapshot.process_id -and $association.boundRuntime.started_at -ceq $snapshot.started_at -and $association.boundRuntime.webSocketDebuggerUrl -ceq $snapshot.webSocketDebuggerUrl -and $association.expandDecision -ceq 'expanded' -and $association.beforeAt -and $association.expandedAt -and ([DateTime]$association.beforeAt -le [DateTime]$association.expandedAt)
    $fresh = $causal
    if ($causal) {
      foreach ($before in @($association.before)) {
        if ($before.handle -eq $identity.handle -or (@($before.runtimeId) -join ',') -ceq (@($identity.runtimeId) -join ',')) { $fresh = $false }
      }
    }
    if ($identity.handle -and $identity.handle -ne $boundHandle -and $identity.owner -eq $boundHandle -and $rootOwner -eq $boundHandle -and $causal -and $fresh -and (-not $identity.name -or $identity.name -ceq $item.Current.Name)) { $siblings += $candidate; $decision='plausible-sibling' }
    $evidence += [pscustomobject]@{popup=$identity;boundWindowHandle=$boundHandle;parentRuntimeId=@($item.GetRuntimeId());parentLabel=$item.Current.Name;parentState='Expanded';rootRuntimeId=@($root.GetRuntimeId());rootHandle=$rootHandle;rootOwner=$rootOwner;observedAt=[DateTime]::UtcNow.ToString('o');owner=$identity.owner;fresh=$fresh;causal=$causal;decision=$decision}
  }
  if ($association) {
    $association | Add-Member -Force -NotePropertyName candidates -NotePropertyValue $evidence
    $association | Add-Member -Force -NotePropertyName plausibleCount -NotePropertyValue $siblings.Count
    $association | Add-Member -Force -NotePropertyName decision -NotePropertyValue $(if ($siblings.Count -eq 1 -and $structural.Count -eq 0) { 'unique-sibling' } elseif ($structural.Count -eq 1 -and $siblings.Count -eq 0) { 'structural' } else { 'blocked' })
    $script:NativeAssociation=$association
  }
  if ($structural.Count) { if ($structural.Count -ne 1 -or $siblings.Count) { throw 'Native submenu topology is ambiguous.' }; $structural; return }
  if ($siblings.Count -ne 1) { throw 'Native sibling popup association missing or ambiguous.' }
  $chosen = Menu-PopupIdentity $siblings[0] $window
  if ($association.selectedRuntimeId -and (-not (Same-RuntimeId $siblings[0] $association.selectedRuntimeId) -or $chosen.handle -ne $association.selectedHandle)) { throw 'Retained sibling popup identity changed.' }
  $association | Add-Member -Force -NotePropertyName selectedRuntimeId -NotePropertyValue $chosen.runtimeId
  $association | Add-Member -Force -NotePropertyName selectedHandle -NotePropertyValue $chosen.handle
  $siblings[0]
}
function Resolve-MenuRoot($snapshot, $window, $request) {
  $roots = @(Menu-Roots $snapshot $window)
  foreach ($menuRoot in @($roots)) { $roots += @(Descendants $menuRoot | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::MenuItem -and @(Menu-Items $_).Count -gt 0 }) }
  $uniqueRoots = @{}
  foreach ($candidateRoot in $roots) { $uniqueRoots[@($candidateRoot.GetRuntimeId()) -join ','] = $candidateRoot }
  $roots = @($uniqueRoots.Values)
  $previousRoot = $null; $previousItem = $null; $previousAssociation = $null
  foreach ($frame in @($request.ancestors)) {
    if (-not $frame) { continue }
    $ancestorRoot = Unique @($roots | Where-Object { Same-RuntimeId $_ $frame.rootRuntimeId })
    if ($previousItem) { $null = Unique @(Menu-ChildRoots $snapshot $window $previousRoot $previousItem $previousAssociation | Where-Object { Same-RuntimeId $_ $frame.rootRuntimeId }) }
    $ancestorItem = Resolve-MenuPath $ancestorRoot @($frame.label)
    if (-not (Same-RuntimeId $ancestorItem $frame.elementRuntimeId)) { throw 'Parent menu path identity changed.' }
    $previousRoot = $ancestorRoot; $previousItem = $ancestorItem; $previousAssociation = $frame.association
  }
  $root = Unique @($roots | Where-Object { Same-RuntimeId $_ $request.rootRuntimeId })
  if ($previousItem) { $null = Unique @(Menu-ChildRoots $snapshot $window $previousRoot $previousItem $previousAssociation | Where-Object { Same-RuntimeId $_ $request.rootRuntimeId }) }
  $root
}
function Focus-MenuWindow($snapshot, $request) {
  if (-not $request.runtime -or -not $request.windowRuntimeId) { throw 'Retained runtime/window identity required before native focus.' }
  $window = Assert-MenuBinding $snapshot $request -RequireForeground $false
  $script:NativeRevalidation = [pscustomobject]@{status='pending';observedAt=[DateTime]::UtcNow.ToString('o');runtime=$snapshot;window=(Info $window);operation='menu-focus';method='SetForegroundWindow'}
  $current = Get-RuntimeSnapshot
  foreach ($key in @('process_id','started_at','webSocketDebuggerUrl')) {
    if ($current.$key -cne $snapshot.$key) { throw 'Runtime changed before native window focus.' }
  }
  $liveWindow = Assert-MenuBinding $current $request -RequireForeground $false
  if (-not (Same-RuntimeId $liveWindow $request.windowRuntimeId)) { throw 'Live native window identity changed.' }
  if (@(Menu-Roots $current $liveWindow).Count -ne 0) { throw 'Source already has a native menu before focus.' }
  $handle = [long]$liveWindow.Current.NativeWindowHandle
  if (-not $handle) { throw 'Bound source window has no native HWND; no activation performed.' }
  $activation = [pscustomobject]@{targetHwnd=$handle;beforeHwnd=(Get-MenuForegroundHandle);minimized=(Test-MenuWindowMinimized $handle);restoreRequested=$false;restorePreviousVisibility=$null;requestResult=$null;observedHwnd=$null;foregroundVerified=$false}
  $validation = [pscustomobject]@{status='ok';observedAt=[DateTime]::UtcNow.ToString('o');runtime=$current;window=(Info $liveWindow);target=(Info $liveWindow);operation='menu-focus';method='SetForegroundWindow';activation=$activation}
  $script:NativeRevalidation=$validation
  $script:NativePhase='action'; $script:NativeAttempted=$true
  if ($activation.minimized) {
    $activation.restorePreviousVisibility = Restore-MenuWindow $handle
    $activation.restoreRequested = $true
  }
  $activation.requestResult = Request-MenuForeground $handle
  $activation.observedHwnd = Get-MenuForegroundHandle
  $activation.foregroundVerified = $activation.observedHwnd -eq $handle
  if (-not $activation.foregroundVerified) { throw 'SetForegroundWindow requested activation but exact source HWND is not foreground; no context-menu input permitted.' }
  $after = Get-RuntimeSnapshot
  $focusedWindow = Assert-MenuBinding $after $request -RequireForeground $true -ExactForeground $true
  [pscustomobject]@{revalidation=$validation;focus=[pscustomobject]@{status='ok';observedAt=[DateTime]::UtcNow.ToString('o');runtime=$after;window=(Info $focusedWindow);activation=$activation;foregroundVerified=$true}}
}
function Menu-Operation($snapshot, $operation, $request) {
  if ($operation -eq 'menu-focus') { return Focus-MenuWindow $snapshot $request }
  $requireForeground = -not $request.foregroundFree -and ($operation -ne 'menu-bind' -or $request.requireForeground -eq $true)
  $window = Assert-MenuBinding $snapshot $request -RequireForeground $requireForeground -ExactForeground ($operation -eq 'menu-bind')
  if ($operation -eq 'menu-bind') { return [pscustomobject]@{window=(Info $window);runtime=$snapshot;foregroundVerified=$requireForeground;menuRoots=@(Menu-Roots $snapshot $window | ForEach-Object { Menu-Info $_ $window })} }
  $root = Resolve-MenuRoot $snapshot $window $request
  $element = if ($request.path) { Resolve-MenuPath $root $request.path } else { $null }
  if ($operation -eq 'menu-next') { if (-not $element -or -not (Same-RuntimeId $element $request.elementRuntimeId)) { throw 'Parent menu path identity changed.' }; return @(Menu-ChildRoots $snapshot $window $root $element $request.association | ForEach-Object { $info=Menu-Info $_ $window; $info | Add-Member -NotePropertyName association -NotePropertyValue $request.association; $info }) }
  if ($operation -in @('menu-invoke','menu-expand')) {
    if (-not $element -or -not (Same-RuntimeId $element $request.elementRuntimeId)) { throw 'Observed menu item identity changed.' }
    $current = Get-RuntimeSnapshot
    $liveWindow = Assert-MenuBinding $current $request -RequireForeground $requireForeground
    $liveRoot = Resolve-MenuRoot $current $liveWindow $request
    $live = Resolve-MenuPath $liveRoot $request.path
    if (-not (Same-RuntimeId $live $request.elementRuntimeId)) { throw 'Menu item changed before action.' }
    $observed = Info $live
    $validatedAt = [DateTime]::UtcNow.ToString('o')
    $validation = [pscustomobject]@{status='ok';observedAt=$validatedAt;runtime=$current;window=(Info $liveWindow);root=(Menu-Info $liveRoot $liveWindow);item=$observed;operation=$operation;pattern=$(if ($operation -eq 'menu-invoke') { 'InvokePattern' } else { 'ExpandCollapsePattern' })}
    $script:NativeRevalidation=$validation
    if ($operation -eq 'menu-expand') {
      if (-not $live.Current.IsEnabled -or $live.Current.IsOffscreen) { throw 'UIA element is disabled or offscreen.' }
      $pattern = Pattern $live ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
      if (-not $pattern) { throw 'Unsupported ExpandCollapsePattern; no action performed.' }
      $state = $pattern.Current.ExpandCollapseState
      $validation | Add-Member -NotePropertyName expansionState -NotePropertyValue ([string]$state)
      if ($state -notin @([System.Windows.Automation.ExpandCollapseState]::Collapsed,[System.Windows.Automation.ExpandCollapseState]::Expanded)) { throw 'Unavailable or inconsistent menu expansion state.' }
      $beforeAt=[DateTime]::UtcNow.ToString('o')
      $before=@(Menu-Roots $current $liveWindow | ForEach-Object { Menu-PopupIdentity $_ $liveWindow })
      # Discovery is read-only; recheck identity and state immediately before mutation.
      $latest=Get-RuntimeSnapshot
      $latestWindow=Assert-MenuBinding $latest $request -RequireForeground $requireForeground
      $latestRoot=Resolve-MenuRoot $latest $latestWindow $request
      $latestItem=Resolve-MenuPath $latestRoot $request.path
      if (-not (Same-RuntimeId $latestItem $request.elementRuntimeId)) { throw 'Parent menu item changed before expansion.' }
      $latestPattern=Pattern $latestItem ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
      if (-not $latestPattern -or $latestPattern.Current.ExpandCollapseState -ne $state -or -not $latestItem.Current.IsEnabled -or $latestItem.Current.IsOffscreen) { throw 'Parent expansion state changed before action.' }
      $decision='already-expanded'
      if ($state -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed) { $script:NativePhase='action';$script:NativeAttempted=$true;$latestPattern.Expand();$decision='expanded' }
      $association=[pscustomobject]@{parentRuntimeId=@($latestItem.GetRuntimeId());parentLabel=$latestItem.Current.Name;parentStateBefore=[string]$state;rootRuntimeId=@($latestRoot.GetRuntimeId());boundWindowHandle=[long]$latestWindow.Current.NativeWindowHandle;boundWindowRuntimeId=@($latestWindow.GetRuntimeId());boundRuntime=$latest;rootHandle=(Menu-Handle $latestRoot $latestWindow);rootOwner=[NativeMenuWindow]::GetWindow([IntPtr](Menu-Handle $latestRoot $latestWindow),4).ToInt64();before=$before;beforeAt=$beforeAt;expandedAt=[DateTime]::UtcNow.ToString('o');expandDecision=$decision}
      if ($decision -eq 'already-expanded' -and $request.association) { $association=$request.association }
      return [pscustomobject]@{item=$observed;revalidation=$validation;association=$association;expandDecision=$decision}
    }
    Invoke-Semantic $live 'invoke'
    return [pscustomobject]@{item=$observed;revalidation=$validation}
  }
  [pscustomobject]@{root=(Menu-Info $root $window);item=$(if ($element) { Menu-Info $element $window });items=@(Menu-Items $root | ForEach-Object { Info $_ })}
}
# Function definitions are loaded by regression tests without executing desktop actions.
if ($MyInvocation.InvocationName -ne '.') {
  $script:NativePhase = 'readiness'; $script:NativeAttempted = $false; $script:NativeRevalidation=$null; $script:NativeAssociation=$null; $snapshot=$null
  try {
    $snapshot = Get-RuntimeSnapshot
    $script:NativePhase = 'observation'
    $windows = @(RuntimeWindows $snapshot)
    if ($Operation -eq 'menu-bind') { $data = Menu-Operation $snapshot $Operation ($MenuRequest | ConvertFrom-Json) }
    elseif ($Operation -eq 'menu-tree' -and -not ($MenuRequest | ConvertFrom-Json).rootRuntimeId) {
      $request = $MenuRequest | ConvertFrom-Json
      $window = Assert-MenuBinding $snapshot $request -RequireForeground (-not $request.foregroundFree)
      $roots = @(Menu-Roots $snapshot $window)
      $data = @($roots | Where-Object {
        $candidate = $_; $nested = $false
        foreach ($ancestor in @(Menu-Ancestry $candidate $window | Select-Object -Skip 1)) {
          if ($ancestor.type -ceq 'ControlType.Menu') { $nested = $true; break }
        }
        -not $nested
      } | ForEach-Object { Menu-Info $_ $window })
    }
    elseif ($Operation -eq 'menu-next') { $data = @(Menu-Operation $snapshot $Operation ($MenuRequest | ConvertFrom-Json)) }
    elseif ($Operation.StartsWith('menu-')) { $data = Menu-Operation $snapshot $Operation ($MenuRequest | ConvertFrom-Json) }
    elseif ($Operation -eq 'windows') { $data = @($windows | ForEach-Object { Info $_ }) }
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
    [pscustomobject]@{status='ok'; operation=$Operation; observedAt=[DateTime]::UtcNow.ToString('o'); data=$data; phase=$script:NativePhase; attempted=$script:NativeAttempted} | ConvertTo-Json -Compress -Depth 20
  } catch {
    [pscustomobject]@{status='error'; operation=$Operation; observedAt=[DateTime]::UtcNow.ToString('o');runtime=$snapshot;association=$script:NativeAssociation;revalidation=$script:NativeRevalidation; detail=$_.Exception.Message; phase=$script:NativePhase; attempted=$script:NativeAttempted} | ConvertTo-Json -Compress -Depth 20
    exit 1
  }
}
