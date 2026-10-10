# Mocked UIA observations/patterns plus hidden owned HWND fixtures; no shown desktop UI or browser launch.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'runtime\host\wsl-windows\native-ui.ps1') -Operation expand
function Assert([bool]$condition, [string]$message) { if (-not $condition) { throw $message } }
function AssertBlocked([scriptblock]$action, [string]$message) {
  $blocked=$false; try { & $action | Out-Null } catch { $blocked=$true }
  Assert $blocked $message
}
Assert ($Operation -ceq 'expand') 'Runtime import overwrote native operation routing.'
$titleNonce = 'vp-menu-00000000-0000-0000-0000-000000000000'
Assert (Matches-MenuWindowTitle ($titleNonce + ' - Chrome') $titleNonce) 'ASCII Chrome title suffix failed.'
Assert (Matches-MenuWindowTitle ($titleNonce + ' ' + [char]0x2013 + ' Chrome') $titleNonce) 'Localized en-dash Chrome title suffix failed.'
Assert (-not (Matches-MenuWindowTitle ($titleNonce + '-other - Chrome') $titleNonce)) 'Different nonce prefix was accepted.'
Assert (-not (Matches-MenuWindowTitle ('unrelated - Chrome') $titleNonce)) 'Unrelated Chrome window title was accepted.'

$script:invokes=0; $script:expands=0; $script:supported=$true
$element = [pscustomobject]@{Current=[pscustomobject]@{IsEnabled=$true; IsOffscreen=$false}}
$script:pattern = [pscustomobject]@{}
$script:pattern | Add-Member ScriptMethod Invoke { $script:invokes++ }
$script:pattern | Add-Member ScriptMethod Expand { $script:expands++ }
function Pattern { param($element,$patternId) if ($script:supported) { $script:pattern } }
Invoke-Semantic $element invoke
Invoke-Semantic $element expand
Assert ($script:invokes -eq 1 -and $script:expands -eq 1) 'Supported patterns did not execute.'
$script:supported=$false
AssertBlocked { Invoke-Semantic $element invoke } 'Unsupported invoke continued.'
AssertBlocked { Invoke-Semantic $element expand } 'Unsupported expand continued.'
Assert ($script:invokes -eq 1 -and $script:expands -eq 1) 'Unsupported pattern fell back to an action.'
$script:supported=$true; $element.Current.IsOffscreen=$true
AssertBlocked { Invoke-Semantic $element invoke } 'Hidden element was invoked.'
$element.Current.IsOffscreen=$false; $element.Current.IsEnabled=$false
AssertBlocked { Invoke-Semantic $element invoke } 'Disabled element was invoked.'
AssertBlocked { Unique @() } 'Missing element accepted.'
AssertBlocked { Unique @($element,$element) } 'Ambiguous elements accepted.'
Assert ((Unique @($element)) -eq $element) 'Unique element rejected.'
AssertBlocked { Read-Criteria '{}' } 'Empty selector accepted.'
AssertBlocked { Read-Criteria '{"unknown":"value"}' } 'Unknown selector accepted.'
AssertBlocked { Read-Criteria '{"handle":"123"}' } 'String handle accepted.'
$selector = Read-Criteria '{"name":"Fixture control","class":"Fixture class"}'
function Info { param($element) [pscustomobject]@{name=$element.name; class=$element.class} }
Assert (Matches ([pscustomobject]@{name='Fixture control'; class='Fixture class'}) $selector) 'Exact criteria failed.'
Assert (-not (Matches ([pscustomobject]@{name='fixture control'; class='Fixture class'}) $selector)) 'Fuzzy criteria accepted.'
# Selection excludes UIA Document controls and rejects duplicate matching native controls.
$script:nodes = @([pscustomobject]@{name='Fixture control'; class='Fixture class'; document=$false})
function Descendants { param($window) $script:nodes }
function InDocument { param($element,$window) $element.document }
Assert ((Resolve-Element $null $selector).name -ceq 'Fixture control') 'Generic resolution failed.'
$script:nodes += [pscustomobject]@{name='Fixture control'; class='Fixture class'; document=$true}
Assert ((Resolve-Element $null $selector).name -ceq 'Fixture control') 'Document exclusion failed.'
$script:nodes += [pscustomobject]@{name='Fixture control'; class='Fixture class'; document=$false}
AssertBlocked { Resolve-Element $null $selector } 'Ambiguous native selection continued.'
# The helper owns exact menu path matching and retained identity validation.
function MenuNode([string]$name, [int]$identity) {
  $node = [pscustomobject]@{Current=[pscustomobject]@{Name=$name;IsEnabled=$true;IsOffscreen=$false};identity=$identity;children=@()}
  $node | Add-Member ScriptMethod GetRuntimeId { @($this.identity) }
  $node
}
$rootNode = MenuNode 'Root' 100
$parentNode = MenuNode 'Parent' 101
$commandNode = MenuNode 'Command' 102
$rootNode.children = @($parentNode); $parentNode.children = @($commandNode)
function Menu-Items($root) { @($root.children) }
function Menu-Containers($item) { @() }
Assert ((Resolve-MenuPath $rootNode @('Parent','Command')).identity -eq 102) 'Scoped exact menu path failed.'
AssertBlocked { Resolve-MenuPath $rootNode @('Missing') } 'Missing first menu level accepted.'
AssertBlocked { Resolve-MenuPath $rootNode @('Parent','Missing') } 'Missing submenu label accepted.'
AssertBlocked { Resolve-MenuPath $rootNode @('parent') } 'Case-insensitive menu label accepted.'
$rootNode.children += MenuNode 'Parent' 103
AssertBlocked { Resolve-MenuPath $rootNode @('Parent') } 'Duplicate exact menu labels accepted.'
$rootNode.children = @($parentNode)
Assert (Same-RuntimeId $commandNode @(102)) 'Retained runtime identity failed.'
Assert (-not (Same-RuntimeId $commandNode @(104))) 'Replacement runtime identity accepted.'
Assert (-not (Same-RuntimeId $commandNode @())) 'Empty runtime identity accepted.'
function Menu-Roots($snapshot,$window) { @($rootNode) }
function Descendants($window) { @() }
$request = [pscustomobject]@{rootRuntimeId=@(100);ancestors=@()}
Assert ((Resolve-MenuRoot $null $null $request).identity -eq 100) 'Observed menu root resolution failed.'
$request.rootRuntimeId=@(999)
AssertBlocked { Resolve-MenuRoot $null $null $request } 'Disappeared menu root accepted.'
$request.rootRuntimeId=@(100)
function Assert-MenuBinding($snapshot,$request) { $rootNode }
function Get-RuntimeSnapshot { [pscustomobject]@{process_id=1;started_at='original';webSocketDebuggerUrl='original'} }
function Info($element) { [pscustomobject]@{name=$element.Current.Name;runtimeId=@($element.GetRuntimeId())} }
function Menu-Info($element,$window) { Info $element }
$request | Add-Member -NotePropertyName path -NotePropertyValue @('Parent')
$request | Add-Member -NotePropertyName elementRuntimeId -NotePropertyValue @(999)
AssertBlocked { Menu-Operation $null 'menu-invoke' $request } 'Replaced same-label item accepted before invocation.'
$request.elementRuntimeId=@(101)
$script:supported=$false
AssertBlocked { Menu-Operation $null 'menu-invoke' $request } 'Menu action fell back from unsupported pattern.'
$script:supported=$true
$parentNode.Current.IsOffscreen=$true
AssertBlocked { Menu-Operation $null 'menu-invoke' $request } 'Offscreen native menu item invoked.'
$parentNode.Current.IsOffscreen=$false
# Foreground activation uses actual helper routing; only Win32 boundary calls are mocked.
$rootNode.Current | Add-Member -NotePropertyName NativeWindowHandle -NotePropertyValue 7001
$focusSnapshot=[pscustomobject]@{process_id=1;started_at='original';webSocketDebuggerUrl='original'}
$focusRequest=[pscustomobject]@{runtime=$focusSnapshot;windowRuntimeId=@(100);nonce='vp-menu-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';targetId='source'}
$script:foregroundHwnd=7001; $script:minimized=$false; $script:activationMatches=$true; $script:requestResult=$true; $script:activationCalls=@()
function Get-MenuForegroundHandle { $script:foregroundHwnd }
function Test-MenuWindowMinimized($handle) { $script:minimized }
function Restore-MenuWindow($handle) { $script:activationCalls += "restore:$handle"; $script:minimized=$false; $false }
function Request-MenuForeground($handle) { $script:activationCalls += "activate:$handle"; if ($script:activationMatches) { $script:foregroundHwnd=$handle }; $script:requestResult }
function Assert-MenuBinding($snapshot,$request,[bool]$RequireForeground=$true,[bool]$ExactForeground=$false) {
  if ($RequireForeground -and $script:foregroundHwnd -ne $rootNode.Current.NativeWindowHandle) { throw 'Exact source window is not foreground.' }
  $rootNode
}
function Menu-Roots($snapshot,$window) { @() }
$script:NativeAttempted=$false
$focusEvidence=Menu-Operation $focusSnapshot 'menu-focus' $focusRequest
Assert ($script:activationCalls.Count -eq 1 -and $script:activationCalls[0] -ceq 'activate:7001') 'Already-foreground target was not activated exactly once.'
Assert ($focusEvidence.focus.foregroundVerified -and $focusEvidence.revalidation.method -ceq 'SetForegroundWindow') 'Activation omitted verified foreground/revalidation evidence.'
Assert ($focusEvidence.revalidation.target.runtimeId[0] -eq 100) 'Activation omitted exact target identity.'
Assert ($focusEvidence.focus.activation.beforeHwnd -eq 7001 -and $focusEvidence.focus.activation.observedHwnd -eq 7001) 'Already-foreground evidence omitted actual HWNDs.'
# A minimized source is restored before the single activation request; ShowWindow's return is previous visibility.
$script:foregroundHwnd=8002; $script:minimized=$true; $script:activationCalls=@()
$restoredEvidence=Menu-Operation $focusSnapshot 'menu-focus' $focusRequest
Assert (($script:activationCalls -join ',') -ceq 'restore:7001,activate:7001') 'Minimized target was not restored before activation.'
Assert ($restoredEvidence.focus.activation.minimized -and $restoredEvidence.focus.activation.restoreRequested -and -not $restoredEvidence.focus.activation.restorePreviousVisibility) 'Restore evidence incorrectly inferred success from previous visibility.'
# Success depends on the observed HWND, even if SetForegroundWindow returns false.
$script:foregroundHwnd=8002; $script:requestResult=$false; $script:activationCalls=@()
$matchingEvidence=Menu-Operation $focusSnapshot 'menu-focus' $focusRequest
Assert ($matchingEvidence.focus.foregroundVerified -and -not $matchingEvidence.focus.activation.requestResult -and $matchingEvidence.focus.activation.observedHwnd -eq 7001) 'Matching foreground HWND was replaced by API return-value inference.'
# A true API return with a different foreground HWND must fail closed, with no activation retry.
$script:foregroundHwnd=8002; $script:activationMatches=$false; $script:requestResult=$true; $script:activationCalls=@(); $script:NativeAttempted=$false
AssertBlocked { Menu-Operation $focusSnapshot 'menu-focus' $focusRequest } 'Mismatching foreground accepted after activation request.'
Assert ($script:activationCalls.Count -eq 1 -and $script:NativeAttempted) 'Failed activation was retried or lost attempted evidence.'
Assert (-not $script:NativeRevalidation.activation.foregroundVerified -and $script:NativeRevalidation.activation.observedHwnd -eq 8002) 'Failed activation omitted actual foreground evidence.'
$unfocusedBinding=Menu-Operation $focusSnapshot 'menu-bind' $focusRequest
Assert (-not $unfocusedBinding.foregroundVerified) 'Initial binding claimed unchecked foreground.'
$focusRequest | Add-Member -NotePropertyName requireForeground -NotePropertyValue $true
AssertBlocked { Menu-Operation $focusSnapshot 'menu-bind' $focusRequest } 'Pre-input binding accepted lost exact foreground.'
$script:foregroundHwnd=7001
Assert ((Menu-Operation $focusSnapshot 'menu-bind' $focusRequest).foregroundVerified) 'Pre-input binding omitted checked foreground.'
$focusRequest.PSObject.Properties.Remove('requireForeground')
# Retained identity and runtime checks occur before any restore/activation call.
$focusRequest.windowRuntimeId=@(999); $script:activationCalls=@(); $script:NativeAttempted=$false
AssertBlocked { Menu-Operation $focusSnapshot 'menu-focus' $focusRequest } 'Stale bound window was activated.'
Assert ($script:activationCalls.Count -eq 0 -and -not $script:NativeAttempted) 'Stale target performed activation.'
$focusRequest.windowRuntimeId=@(100)
function Get-RuntimeSnapshot { [pscustomobject]@{process_id=2;started_at='replacement';webSocketDebuggerUrl='replacement'} }
AssertBlocked { Menu-Operation $focusSnapshot 'menu-focus' $focusRequest } 'Changed runtime was activated.'
Assert ($script:activationCalls.Count -eq 0 -and -not $script:NativeAttempted) 'Changed runtime performed activation.'
function Get-RuntimeSnapshot { [pscustomobject]@{process_id=1;started_at='original';webSocketDebuggerUrl='original'} }
$rootNode.Current.PSObject.Properties.Remove('NativeWindowHandle')
function Menu-Roots($snapshot,$window) { @($rootNode) }
function Descendants($window) { @() }
# Exercise the real menu hierarchy/ownership resolver with fake UIA observations.
# Hidden HWND fixtures make the actual native owner chain available without showing UI.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MenuRegressionWindows {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CreateWindowEx(uint exStyle, string cls, string name, uint style,
    int x, int y, int w, int h, IntPtr owner, IntPtr menu, IntPtr instance, IntPtr param);
  [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr hwnd);
  public static IntPtr Create(IntPtr owner) {
    var hwnd = CreateWindowEx(0, "STATIC", "Verification native menu regression", 0x80000000,
      0, 0, 1, 1, owner, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
    if (hwnd == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    return hwnd;
  }
}
'@
$createdWindows = @()
try {
  $sourceHandle = [MenuRegressionWindows]::Create([IntPtr]::Zero); $createdWindows += $sourceHandle
  $rootHandle = [MenuRegressionWindows]::Create($sourceHandle); $createdWindows += $rootHandle
  $submenuHandle = [MenuRegressionWindows]::Create($rootHandle); $createdWindows += $submenuHandle
  $unrelatedHandle = [MenuRegressionWindows]::Create($sourceHandle); $createdWindows += $unrelatedHandle
  Assert (Owned-WindowHandle $submenuHandle.ToInt64() $sourceHandle.ToInt64()) 'Transitive HWND source ownership rejected.'
  Assert (-not (Owned-WindowHandle $unrelatedHandle.ToInt64() $rootHandle.ToInt64())) 'Unrelated source popup attributed to a parent menu.'
  foreach ($node in @($rootNode,$parentNode,$commandNode)) {
    $node.Current | Add-Member -NotePropertyName NativeWindowHandle -NotePropertyValue 0
    $node.Current | Add-Member -NotePropertyName ControlType -NotePropertyValue ([System.Windows.Automation.ControlType]::MenuItem)
  }
  $rootNode.Current.ControlType = [System.Windows.Automation.ControlType]::Menu
  $rootNode.Current.NativeWindowHandle = $rootHandle.ToInt64()
  $sourceNode = MenuNode 'Source' 99
  $sourceNode.Current | Add-Member -NotePropertyName NativeWindowHandle -NotePropertyValue $sourceHandle.ToInt64()
  $script:pattern | Add-Member -NotePropertyName Current -NotePropertyValue ([pscustomobject]@{ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Expanded})
  $script:menuRoots = @($rootNode)
  $script:menuParents = @{'100'=@($sourceNode);'101'=@($rootNode,$sourceNode);'102'=@($parentNode,$rootNode,$sourceNode)}
  function Info($element) { [pscustomobject]@{name=$element.Current.Name;runtimeId=@($element.GetRuntimeId());handle=$element.Current.NativeWindowHandle;type=$(if ($element.Current.ControlType) { $element.Current.ControlType.ProgrammaticName } else { 'ControlType.Window' })} }
  function Menu-Ancestry($element,$window) { @($element)+@($script:menuParents[[string]$element.identity]) | Where-Object { $_ } | ForEach-Object { Info $_ } }
  function Menu-Roots($snapshot,$window) { $script:menuRoots }
  function Descendants($element) { foreach ($child in @($element.children)) { $child; Descendants $child } }
  function Assert-MenuBinding($snapshot,$request) { $sourceNode }
  Assert (Menu-Owned $rootNode $sourceNode) 'Source-owned native menu rejected.'
  $singleChildren = @(Menu-ChildRoots $null $sourceNode $rootNode $parentNode)
  Assert ($singleChildren.Count -eq 1 -and $singleChildren[0].identity -eq 101) 'Single-root submenu items not scoped to expanded parent.'
  $singleRequest = [pscustomobject]@{rootRuntimeId=@(101);ancestors=@([pscustomobject]@{rootRuntimeId=@(100);elementRuntimeId=@(101);label='Parent'});path=@('Command');elementRuntimeId=@(102)}
  Assert ((Resolve-MenuRoot $null $sourceNode $singleRequest).identity -eq 101) 'Single-root ancestor frames failed.'
  $beforeInvokes = $script:invokes
  $singleAction = Menu-Operation $null 'menu-invoke' $singleRequest
  Assert ($script:invokes -eq $beforeInvokes+1 -and $singleAction.revalidation.status -ceq 'ok') 'Single-root semantic path did not invoke with revalidation evidence.'
  $submenuNode = MenuNode 'Separate submenu' 200
  $unrelatedNode = MenuNode 'Unrelated popup' 300
  foreach ($node in @($submenuNode,$unrelatedNode)) {
    $node.Current | Add-Member -NotePropertyName NativeWindowHandle -NotePropertyValue 0
    $node.Current | Add-Member -NotePropertyName ControlType -NotePropertyValue ([System.Windows.Automation.ControlType]::Menu)
  }
  $submenuNode.Current.NativeWindowHandle = $submenuHandle.ToInt64()
  $unrelatedNode.Current.NativeWindowHandle = $unrelatedHandle.ToInt64()
  $parentNode.children=@(); $submenuNode.children=@($commandNode)
  $script:menuParents['200']=@($sourceNode);$script:menuParents['300']=@($sourceNode);$script:menuParents['102']=@($submenuNode,$sourceNode)
  $script:menuRoots=@($rootNode,$submenuNode,$unrelatedNode)
  $separateChildren = @(Menu-ChildRoots $null $sourceNode $rootNode $parentNode)
  Assert ($separateChildren.Count -eq 1 -and $separateChildren[0].identity -eq 200) 'Separately rooted HWND-owned submenu was missing or unrelated popup accepted.'
  $separateRequest = [pscustomobject]@{rootRuntimeId=@(200);ancestors=@([pscustomobject]@{rootRuntimeId=@(100);elementRuntimeId=@(101);label='Parent'});path=@('Command');elementRuntimeId=@(102)}
  Assert ((Resolve-MenuRoot $null $sourceNode $separateRequest).identity -eq 200) 'Separate-root ancestor frames failed.'
  $beforeInvokes=$script:invokes
  $separateAction = Menu-Operation $null 'menu-invoke' $separateRequest
  Assert ($script:invokes -eq $beforeInvokes+1 -and $separateAction.revalidation.item.runtimeId[0] -eq 102) 'Separate-root exact path did not invoke with retained identity.'
  $separateRequest.ancestors[0].elementRuntimeId=@(999)
  AssertBlocked { Resolve-MenuRoot $null $sourceNode $separateRequest } 'Stale parent identity accepted for separate root.'
  $separateRequest.ancestors[0].elementRuntimeId=@(101)
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Collapsed
  AssertBlocked { Menu-ChildRoots $null $sourceNode $rootNode $parentNode } 'Collapsed parent attributed a submenu.'
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Expanded
  function Get-RuntimeSnapshot { $commandNode.identity=777; [pscustomobject]@{process_id=1;started_at='original';webSocketDebuggerUrl='original'} }
  $beforeInvokes=$script:invokes
  AssertBlocked { Menu-Operation $null 'menu-invoke' $separateRequest } 'Item replaced during immediate revalidation was invoked.'
  Assert ($script:invokes -eq $beforeInvokes) 'Stale immediate revalidation executed native pattern.'
  $commandNode.identity=102
  # State-aware menu expansion mutates Collapsed once and never repeats Expanded.
  $script:menuRoots=@($rootNode);$parentNode.children=@($commandNode)
  function Get-RuntimeSnapshot { [pscustomobject]@{process_id=1;started_at='original';webSocketDebuggerUrl='original'} }
  $snapshot=Get-RuntimeSnapshot
  $expandRequest=[pscustomobject]@{rootRuntimeId=@(100);ancestors=@();path=@('Parent');elementRuntimeId=@(101);foregroundFree=$true}
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Collapsed
  $beforeExpands=$script:expands
  $expanded=Menu-Operation $snapshot 'menu-expand' $expandRequest
  Assert ($script:expands -eq $beforeExpands+1 -and $expanded.expandDecision -ceq 'expanded') 'Collapsed parent was not expanded exactly once.'
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Expanded
  $skipped=Menu-Operation $snapshot 'menu-expand' $expandRequest
  Assert ($script:expands -eq $beforeExpands+1 -and $skipped.expandDecision -ceq 'already-expanded') 'Expanded parent repeated Expand.'
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::PartiallyExpanded
  AssertBlocked { Menu-Operation $snapshot 'menu-expand' $expandRequest } 'Inconsistent parent state expanded.'
  $script:pattern.Current.ExpandCollapseState=[System.Windows.Automation.ExpandCollapseState]::Expanded
  $parentNode.children=@()
  $unrelatedNode.Current.Name='Parent'
  $script:menuRoots=@($rootNode,$unrelatedNode)
  $association=[pscustomobject]@{parentRuntimeId=@(101);parentLabel='Parent';rootRuntimeId=@(100);rootHandle=$rootHandle.ToInt64();boundWindowHandle=$sourceHandle.ToInt64();boundWindowRuntimeId=@(99);boundRuntime=$snapshot;before=@(Menu-PopupIdentity $rootNode $sourceNode);beforeAt='2026-10-09T00:00:00Z';expandedAt='2026-10-09T00:00:01Z';expandDecision='expanded'}
  $sibling=@(Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $association)
  Assert ($sibling.Count -eq 1 -and $sibling[0].identity -eq 300 -and $association.decision -ceq 'unique-sibling') 'Unique fresh sibling with exact owner was rejected.'
  AssertBlocked { Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $null } 'Timing/name/owner alone attributed sibling without expansion evidence.'
  $association.parentRuntimeId=@(999)
  AssertBlocked { Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $association } 'Stale exact parent attributed sibling.'
  $association.parentRuntimeId=@(101)
  $association.before += Menu-PopupIdentity $unrelatedNode $sourceNode
  AssertBlocked { Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $association } 'Pre-existing popup attributed as fresh sibling.'
  $association.before=@(Menu-PopupIdentity $rootNode $sourceNode)
  $otherHandle=[MenuRegressionWindows]::Create($sourceHandle);$createdWindows += $otherHandle
  $otherSibling=MenuNode 'Parent' 301
  $otherSibling.Current | Add-Member -NotePropertyName NativeWindowHandle -NotePropertyValue $otherHandle.ToInt64()
  $otherSibling.Current | Add-Member -NotePropertyName ControlType -NotePropertyValue ([System.Windows.Automation.ControlType]::Menu)
  $script:menuParents['301']=@($sourceNode)
  $script:menuRoots=@($rootNode,$unrelatedNode,$otherSibling)
  AssertBlocked { Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $association } 'Two plausible siblings accepted during retained association revalidation.'
  $script:menuRoots=@($rootNode,$otherSibling)
  $otherSibling.Current.NativeWindowHandle=$sourceHandle.ToInt64()
  AssertBlocked { Menu-ChildRoots $snapshot $sourceNode $rootNode $parentNode $association } 'Wrong exact owner attributed a sibling.'
  $script:menuRoots=@($rootNode,$unrelatedNode)
  $staleNext=[pscustomobject]@{rootRuntimeId=@(100);ancestors=@();path=@('Parent');elementRuntimeId=@(999);association=$association}
  AssertBlocked { Menu-Operation $snapshot 'menu-next' $staleNext } 'Menu-next accepted stale retained parent.'
  foreach ($rootSet in @(@(),@($submenuNode),@($submenuNode,$unrelatedNode))) {
    $json = [pscustomobject]@{data=@($rootSet | ForEach-Object { Info $_ })} | ConvertTo-Json -Compress -Depth 8
    $decoded = $json | ConvertFrom-Json
    Assert ($decoded.data -is [array]) 'Native menu JSON collapsed zero/one/multiple roots into a scalar.'
    Assert (@($decoded.data).Count -eq @($rootSet).Count) 'Native menu JSON changed root cardinality.'
  }
} finally {
  [array]::Reverse($createdWindows)
  foreach ($handle in $createdWindows) { $null = [MenuRegressionWindows]::DestroyWindow($handle) }
}
foreach ($file in Get-ChildItem (Join-Path $root 'runtime\host\wsl-windows') -Filter '*.ps1') {
  $tokens=$null; $parseErrors=$null
  $null=[System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)
  Assert ($parseErrors.Count -eq 0) "Invalid PowerShell syntax: $($file.Name)"
}
Write-Output 'PASS: exact UIA and scoped menu path selection, retained runtime identities, stale/missing/duplicate rejection, supported semantic patterns, fail-closed unsupported/hidden/disabled.'
