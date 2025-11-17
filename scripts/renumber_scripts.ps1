# 重新编号脚本文件
# 此脚本会将所有编号脚本按顺序重命名为 001-N

$scriptsPath = "C:\Users\ATZ\Desktop\商家展示\scripts"

# 获取所有编号脚本(排除archived文件夹)
$scripts = Get-ChildItem -Path $scriptsPath -Filter "*.sql" |
    Where-Object { $_.Name -match '^\d{3}_' } |
    Sort-Object Name

Write-Host "找到 $($scripts.Count) 个脚本文件需要重命名"
Write-Host ""

# 创建临时映射
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

Write-Host "预览重命名操作:"
Write-Host "=" * 80
foreach ($item in $renameMap) {
    Write-Host "$($item.Old) -> $($item.New)"
}
Write-Host "=" * 80
Write-Host ""

# 询问确认
$confirm = Read-Host "是否执行重命名? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host ""
    Write-Host "开始重命名..."

    # 为了避免冲突,先重命名为临时名称
    foreach ($item in $renameMap) {
        $tempName = "temp_" + $item.New
        $tempPath = Join-Path $scriptsPath $tempName
        Rename-Item -Path $item.OldPath -NewName $tempName
        Write-Host "✓ $($item.Old) -> $tempName"
    }

    Write-Host ""
    Write-Host "移除临时前缀..."

    # 再次遍历,移除临时前缀
    Get-ChildItem -Path $scriptsPath -Filter "temp_*.sql" | ForEach-Object {
        $newName = $_.Name -replace '^temp_', ''
        Rename-Item -Path $_.FullName -NewName $newName
        Write-Host "✓ $($_.Name) -> $newName"
    }

    Write-Host ""
    Write-Host "重命名完成!"
    Write-Host "总共重命名了 $($renameMap.Count) 个文件"
} else {
    Write-Host "已取消操作"
}
