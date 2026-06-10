# PostToolUse hook: block @ts-ignore additions in src/
$raw = [Console]::In.ReadToEnd()
$filePath = ''
$newContent = ''
try {
    $j = $raw | ConvertFrom-Json
    $filePath = if ($j.tool_input.file_path) { $j.tool_input.file_path } else { '' }
    $newContent = if ($j.tool_input.new_string) { $j.tool_input.new_string } `
                  elseif ($j.tool_input.content) { $j.tool_input.content } `
                  else { '' }
} catch {}

$inSrc = $filePath -match '[/\\]src[/\\]' -or $filePath -match '^src[/\\]'
$hasIgnore = $newContent -match '@ts-ignore'

if ($inSrc -and $hasIgnore) {
    '{"decision":"block","reason":"INVARIANT VIOLATED: @ts-ignore is forbidden in src/. Fix the TypeScript types properly instead of suppressing the error. Revert this change."}' | Write-Output
    exit 2
}
exit 0
