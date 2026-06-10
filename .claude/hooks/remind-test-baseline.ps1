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
    '{"systemMessage":"Baseline reminder: 139 suites / 2099 tests must PASS. Any deviation requires acknowledgement and CONTEXT.md update via context-manager."}' | Write-Output
}
exit 0
