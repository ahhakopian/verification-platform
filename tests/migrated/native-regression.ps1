# Mocked semantic patterns only; no desktop interaction or browser launch.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $root 'runtime\host\wsl-windows\native-ui.ps1') -Operation expand
function Assert([bool]$condition, [string]$message) { if (-not $condition) { throw $message } }
function AssertBlocked([scriptblock]$action, [string]$message) {
  $blocked=$false; try { & $action | Out-Null } catch { $blocked=$true }
  Assert $blocked $message
}
Assert ($Operation -ceq 'expand') 'Runtime import overwrote native operation routing.'
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
foreach ($file in Get-ChildItem (Join-Path $root 'runtime\host\wsl-windows') -Filter '*.ps1') {
  $tokens=$null; $parseErrors=$null
  $null=[System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)
  Assert ($parseErrors.Count -eq 0) "Invalid PowerShell syntax: $($file.Name)"
}
Write-Output 'PASS: generic exact UIA selection, ambiguity/document rejection, supported semantic patterns, fail-closed unsupported/hidden/disabled.'
