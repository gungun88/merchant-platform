# Script to renumber SQL migration files
$scriptsPath = "C:\Users\ATZ\Desktop\商家展示\scripts"

# Get all numbered scripts (exclude archived folder)
$scripts = Get-ChildItem -Path $scriptsPath -Filter "*.sql" |
    Where-Object { $_.Name -match '^\d{3}_' } |
    Sort-Object Name

Write-Host "Found $($scripts.Count) script files to renumber"
Write-Host ""

# Create mapping
$counter = 1
$renameMap = @()

foreach ($script in $scripts) {
    $oldName = $script.Name
    $newNumber = "{0:D3}" -f $counter
    $newName = $oldName -replace '^\d{3}_', "${newNumber}_"

    if ($oldName -ne $newName) {
        $renameMap += @{
            Old = $oldName
            New = $newName
            OldPath = $script.FullName
            NewPath = Join-Path $scriptsPath $newName
        }
    }

    $counter++
}

Write-Host "Preview of renaming operations:"
Write-Host "=" * 80
foreach ($item in $renameMap) {
    Write-Host "$($item.Old) -> $($item.New)"
}
Write-Host "=" * 80
Write-Host ""

# Confirm
Write-Host "Total files to rename: $($renameMap.Count)"
Write-Host ""
Write-Host "Proceeding with renaming..."

# Rename to temp names first to avoid conflicts
foreach ($item in $renameMap) {
    $tempName = "temp_" + $item.New
    $tempPath = Join-Path $scriptsPath $tempName
    Rename-Item -Path $item.OldPath -NewName $tempName -Force
    Write-Host "Renamed: $($item.Old) -> $tempName"
}

Write-Host ""
Write-Host "Removing temp prefix..."

# Remove temp prefix
Get-ChildItem -Path $scriptsPath -Filter "temp_*.sql" | ForEach-Object {
    $newName = $_.Name -replace '^temp_', ''
    Rename-Item -Path $_.FullName -NewName $newName -Force
    Write-Host "Finalized: $($_.Name) -> $newName"
}

Write-Host ""
Write-Host "Renaming completed!"
Write-Host "Total renamed: $($renameMap.Count) files"
