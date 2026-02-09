# Script to update operator translations for v3.1.0
# Adds all 42 operators with human-readable names

$enPath = "src/lib/stores/translations/en.json"
$ruPath = "src/lib/stores/translations/ru.json"
$enOperatorsPath = "scripts/operators-en.json"
$ruOperatorsPath = "scripts/operators-ru.json"

Write-Host "Loading operator translations from JSON files..." -ForegroundColor Cyan
$enOp = Get-Content $enOperatorsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$ruOp = Get-Content $ruOperatorsPath -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "Updating English translations..." -ForegroundColor Green
$enJson = Get-Content $enPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Update operators
foreach ($prop in $enOp.operators.PSObject.Properties) {
    $enJson.translation.views.calendar.agenda.custom.'filter-editor'.operators | 
        Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
}

# Add UI strings
foreach ($prop in $enOp.ui.PSObject.Properties) {
    $enJson.translation.views.calendar.agenda.custom.'filter-editor' | 
        Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
}

$enJson | ConvertTo-Json -Depth 20 | Set-Content $enPath -Encoding UTF8
Write-Host "OK English translations updated" -ForegroundColor Green

Write-Host "Updating Russian translations..." -ForegroundColor Yellow
$ruJson = Get-Content $ruPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Update operators
foreach ($prop in $ruOp.operators.PSObject.Properties) {
    $ruJson.translation.views.calendar.agenda.custom.'filter-editor'.operators | 
        Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
}

# Add UI strings
foreach ($prop in $ruOp.ui.PSObject.Properties) {
    $ruJson.translation.views.calendar.agenda.custom.'filter-editor' | 
        Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
}

$ruJson | ConvertTo-Json -Depth 20 | Set-Content $ruPath -Encoding UTF8
Write-Host "OK Russian translations updated" -ForegroundColor Green

Write-Host ""
Write-Host "SUCCESS Translations updated successfully" -ForegroundColor Cyan
Write-Host "   - Added 42 operators with human-readable names" -ForegroundColor Gray
Write-Host "   - Added UI strings for filter groups" -ForegroundColor Gray
