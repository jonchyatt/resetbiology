$ErrorActionPreference = 'Stop'

$planningRoot = Split-Path -Parent $PSScriptRoot
$requirementsPath = Join-Path $planningRoot 'REQUIREMENTS.md'
$roadmapPath = Join-Path $planningRoot 'ROADMAP.md'
$requirementsText = Get-Content -LiteralPath $requirementsPath -Raw
$roadmapText = Get-Content -LiteralPath $roadmapPath -Raw

$definitionIds = [regex]::Matches(
  $requirementsText,
  '(?m)^- \[[ xX]\] \*\*([A-Z]+-[0-9]+)\*\*'
) | ForEach-Object { $_.Groups[1].Value }

$roadmapOwners = @{}
$phaseMatches = [regex]::Matches(
  $roadmapText,
  '(?ms)^### Phase ([0-9]+):.*?^\*\*Requirements\*\*: (.+?)$'
)
foreach ($phaseMatch in $phaseMatches) {
  $phase = [int]$phaseMatch.Groups[1].Value
  foreach ($rawId in ($phaseMatch.Groups[2].Value -split ', ')) {
    $id = $rawId.Trim()
    if ($roadmapOwners.ContainsKey($id)) {
      throw "Roadmap requirement $id has more than one primary phase: $($roadmapOwners[$id]) and $phase."
    }
    $roadmapOwners[$id] = $phase
  }
}

$traceOwners = @{}
$traceMatches = [regex]::Matches(
  $requirementsText,
  '(?m)^\| ([A-Z]+-[0-9]+) \| Phase ([0-9]+) \|'
)
foreach ($traceMatch in $traceMatches) {
  $id = $traceMatch.Groups[1].Value
  $phase = [int]$traceMatch.Groups[2].Value
  if ($traceOwners.ContainsKey($id)) {
    throw "Traceability requirement $id has more than one primary phase: $($traceOwners[$id]) and $phase."
  }
  $traceOwners[$id] = $phase
}

function Assert-ExactUniqueSet {
  param(
    [string]$Label,
    [string[]]$Actual,
    [string[]]$Expected
  )

  $actualUnique = @($Actual | Sort-Object -Unique)
  $expectedUnique = @($Expected | Sort-Object -Unique)
  if ($Actual.Count -ne $actualUnique.Count) {
    throw "$Label contains duplicate requirement IDs."
  }
  if ($actualUnique.Count -ne $expectedUnique.Count) {
    throw "$Label count $($actualUnique.Count) does not equal expected count $($expectedUnique.Count)."
  }
  $difference = Compare-Object -ReferenceObject $expectedUnique -DifferenceObject $actualUnique
  if ($difference) {
    throw "$Label does not contain the exact requirement set: $($difference | Out-String)"
  }
}

if ($definitionIds.Count -ne 105) {
  throw "Expected 105 requirement definitions; found $($definitionIds.Count)."
}
Assert-ExactUniqueSet -Label 'Requirement definitions' -Actual $definitionIds -Expected $definitionIds
Assert-ExactUniqueSet -Label 'Roadmap assignments' -Actual @($roadmapOwners.Keys) -Expected $definitionIds
Assert-ExactUniqueSet -Label 'Traceability rows' -Actual @($traceOwners.Keys) -Expected $definitionIds

foreach ($id in $definitionIds) {
  if ($roadmapOwners[$id] -ne $traceOwners[$id]) {
    throw "Phase mismatch for ${id}: roadmap Phase $($roadmapOwners[$id]), traceability Phase $($traceOwners[$id])."
  }
}

$phase10 = [regex]::Match(
  $roadmapText,
  '(?ms)^### Phase 10:.*?^\*\*Depends on\*\*: (.+?)$'
)
if (-not $phase10.Success -or $phase10.Groups[1].Value -notmatch 'Phase 9') {
  throw 'Phase 10 must explicitly depend on Phase 9.'
}

[pscustomobject]@{
  definitions = $definitionIds.Count
  roadmap_assignments = $roadmapOwners.Count
  traceability_rows = $traceOwners.Count
  duplicate_ids = 0
  omissions = 0
  phase_mismatches = 0
  phase_10_depends_on_phase_9 = $true
}
