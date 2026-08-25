# PostToolUse hook: remind about baseline after npm test
$raw = [Console]::In.ReadToEnd()
$cmd = ''
try {
    $j = $raw | ConvertFrom-Json
    $cmd = if ($j.tool_input.command) { $j.tool_input.command } else { $raw }
} catch {
    $cmd = $raw
}

if ($cmd -match 'npm\s+test\b' -or $cmd -match 'npm\s+run\s+test') {
    '{"systemMessage":"Baseline reminder: the canonical suite/test count is the \"Canonical baseline\" line in docs/internal/CONTEXT.md - read it there, never from memory. Any deviation requires acknowledgement and a CONTEXT.md update."}' | Write-Output
}
exit 0
