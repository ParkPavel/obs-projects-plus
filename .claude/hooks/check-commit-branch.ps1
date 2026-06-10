# PreToolUse hook: block git commit directly on main/master
$raw = [Console]::In.ReadToEnd()
$cmd = ''
try {
    $j = $raw | ConvertFrom-Json
    $cmd = if ($j.tool_input.command) { $j.tool_input.command } else { $raw }
} catch {
    $cmd = $raw
}

if ($cmd -match 'git\s+commit') {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and ($branch -eq 'main' -or $branch -eq 'master')) {
        '{"decision":"block","reason":"BLOCKED: Direct commits to main/master are forbidden. Create a feature branch first: git checkout -b feat/<name>"}' | Write-Output
        exit 2
    }
}
exit 0
