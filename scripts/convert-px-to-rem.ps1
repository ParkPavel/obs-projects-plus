# Script to convert px units to rem in Svelte files
# 1rem = 16px by default

$sourceDir = "src"
$files = Get-ChildItem -Path $sourceDir -Filter "*.svelte" -Recurse

$totalReplacements = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Convert px to rem (except in comments and specific cases)
    # Match patterns like: 12px, 0.5px, -4px
    $content = $content -replace '(\d+\.?\d*)px(?![a-z])', {
        param($match)
        $value = [double]$match.Groups[1].Value
        
        # Special cases
        if ($value -eq 0) {
            return "0"
        }
        elseif ($value -eq 1) {
            # Keep 1px for borders in most cases, but convert for transforms
            if ($match.Groups[0].Value -match 'transform|translate|margin|padding|gap|width|height|font|letter|top|left|right|bottom') {
                $rem = $value / 16
                return "{0:0.######}rem" -f $rem
            }
            return "0.0625rem"
        }
        else {
            $rem = $value / 16
            return "{0:0.######}rem" -f $rem
        }
    }
    
    # Don't convert px in comments that explain conversions
    # Fix specific patterns that shouldn't be converted
    $content = $content -replace '(\d+)rem at (\d+)rem base', '$1px at $2px base'
    $content = $content -replace '// (\d+\.?\d*)rem\)', '// $1px)'
    $content = $content -replace '/\* (\d+\.?\d*)rem \*/', '/* $1px */'
    
    # Write back if changed
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalReplacements++
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "`nTotal files updated: $totalReplacements"
