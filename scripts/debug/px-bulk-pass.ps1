# REFACTOR-404 bulk pass: convert common box-shadow / outline px patterns to rem.
# Excludes mojibake-corrupted files (handled in REFACTOR-403b).
$ErrorActionPreference = 'Stop'

$exclude = @(
  'src\ui\views\Calendar\agenda\DateFormulaInput.svelte',
  'src\ui\views\Calendar\agenda\FilterRow.svelte',
  'src\ui\views\Calendar\agenda\AdvancedFilterEditor.svelte'
)

$totalBefore = 0
$totalAfter  = 0
$changed     = 0

Get-ChildItem -Path src -Include *.svelte,*.css -Recurse -File |
  Where-Object { $_.FullName -notmatch '__tests__|__mocks__' } |
  ForEach-Object {
    $rel = $_.FullName.Replace((Get-Location).Path + '\', '')
    if ($exclude -contains $rel) { return }
    $c = Get-Content $_.FullName -Raw
    $b = ([regex]'\b\d+(?:\.\d+)?px\b').Matches($c).Count
    if ($b -eq 0) { return }
    $c2 = $c

    # var() shadow fallbacks
    $c2 = $c2 -replace 'var\(--shadow-s,\s*0 2px 8px rgba\(([^)]+)\)\)', 'var(--shadow-s, 0 0.125rem 0.5rem rgba($1))'
    $c2 = $c2 -replace 'var\(--shadow-s,\s*0 4px 12px rgba\(([^)]+)\)\)', 'var(--shadow-s, 0 0.25rem 0.75rem rgba($1))'
    $c2 = $c2 -replace 'var\(--shadow-m,\s*0 4px 12px rgba\(([^)]+)\)\)', 'var(--shadow-m, 0 0.25rem 0.75rem rgba($1))'
    $c2 = $c2 -replace 'var\(--shadow-l,\s*0 8px 24px rgba\(([^)]+)\)\)', 'var(--shadow-l, 0 0.5rem 1.5rem rgba($1))'

    # var() radius/size/font fallbacks
    $c2 = $c2 -replace 'var\(--radius-s,\s*4px\)',  'var(--radius-s, 0.25rem)'
    $c2 = $c2 -replace 'var\(--radius-m,\s*6px\)',  'var(--radius-m, 0.375rem)'
    $c2 = $c2 -replace 'var\(--radius-m,\s*8px\)',  'var(--radius-m, 0.5rem)'
    $c2 = $c2 -replace 'var\(--radius-l,\s*8px\)',  'var(--radius-l, 0.5rem)'
    $c2 = $c2 -replace 'var\(--radius-l,\s*12px\)', 'var(--radius-l, 0.75rem)'
    $c2 = $c2 -replace 'var\(--radius-xl,\s*12px\)', 'var(--radius-xl, 0.75rem)'
    $c2 = $c2 -replace 'var\(--radius-xl,\s*16px\)', 'var(--radius-xl, 1rem)'
    $c2 = $c2 -replace 'var\(--font-ui-smaller,\s*12px\)', 'var(--font-ui-smaller, 0.75rem)'
    $c2 = $c2 -replace 'var\(--font-ui-small,\s*13px\)',   'var(--font-ui-small, 0.8125rem)'
    $c2 = $c2 -replace 'var\(--font-ui-medium,\s*14px\)',  'var(--font-ui-medium, 0.875rem)'
    $c2 = $c2 -replace 'var\(--ppp-border-width-thick,\s*2px\)', 'var(--ppp-border-width-thick, 0.125rem)'
    $c2 = $c2 -replace 'var\(--ppp-border-width,\s*1px\)',       'var(--ppp-border-width, 0.0625rem)'
    $c2 = $c2 -replace 'var\(--ppp-radius-full,\s*999px\)',  'var(--ppp-radius-full, 624.9375rem)'
    $c2 = $c2 -replace 'var\(--ppp-radius-full,\s*9999px\)', 'var(--ppp-radius-full, 624.9375rem)'

    # Standalone box-shadow patterns (drop shadows)
    $c2 = $c2 -replace 'box-shadow:\s*0 1px 2px rgba\(([^)]+)\)',  'box-shadow: 0 0.0625rem 0.125rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 1px 3px rgba\(([^)]+)\)',  'box-shadow: 0 0.0625rem 0.1875rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 1px 4px rgba\(([^)]+)\)',  'box-shadow: 0 0.0625rem 0.25rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 2px 4px rgba\(([^)]+)\)',  'box-shadow: 0 0.125rem 0.25rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 2px 6px rgba\(([^)]+)\)',  'box-shadow: 0 0.125rem 0.375rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 2px 8px rgba\(([^)]+)\)',  'box-shadow: 0 0.125rem 0.5rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 4px 8px rgba\(([^)]+)\)',  'box-shadow: 0 0.25rem 0.5rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 4px 12px rgba\(([^)]+)\)', 'box-shadow: 0 0.25rem 0.75rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 4px 16px rgba\(([^)]+)\)', 'box-shadow: 0 0.25rem 1rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 8px 16px rgba\(([^)]+)\)', 'box-shadow: 0 0.5rem 1rem rgba($1)'
    $c2 = $c2 -replace 'box-shadow:\s*0 8px 24px rgba\(([^)]+)\)', 'box-shadow: 0 0.5rem 1.5rem rgba($1)'

    # Inset focus rings 1px/2px
    $c2 = $c2 -replace 'box-shadow:\s*0 0 0 1px inset ', 'box-shadow: 0 0 0 0.0625rem inset '
    $c2 = $c2 -replace 'box-shadow:\s*0 0 0 2px inset ', 'box-shadow: 0 0 0 0.125rem inset '
    $c2 = $c2 -replace 'box-shadow:\s*0 0 0 1px ', 'box-shadow: 0 0 0 0.0625rem '
    $c2 = $c2 -replace 'box-shadow:\s*0 0 0 2px ', 'box-shadow: 0 0 0 0.125rem '

    # outline / outline-offset (a11y focus rings, 2px → 0.125rem)
    $c2 = $c2 -replace 'outline:\s*2px solid ', 'outline: 0.125rem solid '
    $c2 = $c2 -replace 'outline-offset:\s*1px;', 'outline-offset: 0.0625rem;'
    $c2 = $c2 -replace 'outline-offset:\s*2px;', 'outline-offset: 0.125rem;'

    # text-underline-offset
    $c2 = $c2 -replace 'text-underline-offset:\s*1px;', 'text-underline-offset: 0.0625rem;'
    $c2 = $c2 -replace 'text-underline-offset:\s*2px;', 'text-underline-offset: 0.125rem;'

    # Strip px from /* ... */ block comments (documentation-only px → bare numbers)
    $c2 = [regex]::Replace($c2, '/\*([^*]|\*(?!/))*\*/', { param($m) $m.Value -replace '\b(\d+(?:\.\d+)?)px\b', '$1' })
    # Strip px from // line comments inside .svelte <script> blocks
    $c2 = [regex]::Replace($c2, '//[^\r\n]*', { param($m) $m.Value -replace '\b(\d+(?:\.\d+)?)px\b', '$1' })

    if ($c2 -ne $c) {
      Set-Content -Path $_.FullName -Value $c2 -NoNewline
      $a = ([regex]'\b\d+(?:\.\d+)?px\b').Matches($c2).Count
      Write-Host ("{0,-72} : {1,3} -> {2,3}" -f $rel, $b, $a)
      $totalBefore += $b
      $totalAfter  += $a
      $changed++
    }
  }

Write-Host ""
Write-Host "Files changed: $changed"
Write-Host "Subtotal:     $totalBefore -> $totalAfter (delta -$($totalBefore - $totalAfter))"
