# PreToolUse hook: block destructive git operations
$raw = [Console]::In.ReadToEnd()
$cmd = ''
try {
    $j = $raw | ConvertFrom-Json
    $cmd = if ($j.tool_input.command) { $j.tool_input.command } else { $raw }
} catch {
    $cmd = $raw
}

if ($cmd -match 'git\s+(reset\s+--hard|push\s+(--force|-f)|clean\s+-(d|f))') {
    '{"decision":"block","reason":"BLOCKED: Destructive git operations (reset --hard, push --force, clean) require explicit user execution. Ask the user to run this command manually."}' | Write-Output
    exit 2
}
exit 0
