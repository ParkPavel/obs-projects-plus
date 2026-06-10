# PreToolUse hook: block git push targeting main/master
$raw = [Console]::In.ReadToEnd()
$cmd = ''
try {
    $j = $raw | ConvertFrom-Json
    $cmd = if ($j.tool_input.command) { $j.tool_input.command } else { $raw }
} catch {
    $cmd = $raw
}

if ($cmd -match 'git\s+push' -and $cmd -match '\b(main|master)\b') {
    '{"decision":"block","reason":"BLOCKED: Push to main/master is reserved for the user. Do not push from an agent."}' | Write-Output
    exit 2
}
exit 0
