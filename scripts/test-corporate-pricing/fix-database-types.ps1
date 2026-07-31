$ErrorActionPreference = "Stop"
$path = "src/types/database.types.ts"
[string[]]$lines = Get-Content -Path $path -Encoding Unicode
$list = [System.Collections.Generic.List[string]]::new()
$list.AddRange([string[]]$lines)

function Fix-Occurrences($list, $pattern) {
  $indices = @()
  for ($i = 0; $i -lt $list.Count; $i++) {
    if ($list[$i] -match $pattern) { $indices += $i }
  }
  if ($indices.Count -ne 3) { throw "Expected exactly 3 occurrences of $pattern, found $($indices.Count)" }

  # Trust the Insert-block occurrence (2nd) as the known-correct, correctly
  # indented reference — it already has the trailing '?' as expected.
  $insertLine = $list[$indices[1]]
  if ($insertLine -notmatch '\?:') { throw "Insert-block line missing '?': '$insertLine'" }
  $rowLine = $insertLine -replace '\?:', ':'
  $updateLine = $insertLine

  Write-Output "Pattern $pattern -> Row idx $($indices[0]): '$($list[$indices[0]])' -> '$rowLine'"
  Write-Output "Pattern $pattern -> Update idx $($indices[2]): '$($list[$indices[2]])' -> '$updateLine'"

  $list[$indices[0]] = $rowLine
  $list[$indices[2]] = $updateLine
}

Fix-Occurrences $list 'negotiated_discount_percent'
Fix-Occurrences $list 'standard_price'

Set-Content -Path $path -Value $list -Encoding Unicode -NoNewline:$false
Write-Output "Fixed database.types.ts. Line count: $($list.Count)"
