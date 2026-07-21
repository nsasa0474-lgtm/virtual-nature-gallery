# Replace public/photos from new_foto/ without Node.js.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Root
$Inbox = Join-Path $Root 'new_foto'
$OutDir = Join-Path $Root 'public\photos'
$DistPhotos = Join-Path $Root 'dist\photos'
$Manifest = Join-Path $OutDir 'photos.json'
$ImageExt = @('.jpg', '.jpeg', '.png', '.webp', '.gif')

function Get-ImageFiles([string]$Dir) {
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  Get-ChildItem -LiteralPath $Dir -File |
    Where-Object { $ImageExt -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object { $_.Name }
}

function Get-FileSha256([string]$Path) {
  (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Get-SetFingerprint($Files) {
  if (-not $Files -or $Files.Count -eq 0) { return '' }
  $hashes = @($Files | ForEach-Object { Get-FileSha256 $_.FullName } | Sort-Object)
  $text = [string]::Join("`n", $hashes)
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $sha.Dispose()
  }
}

function Get-ImageSize([string]$Path) {
  try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    $img = [System.Drawing.Image]::FromFile($Path)
    try {
      return @{ Width = [int]$img.Width; Height = [int]$img.Height }
    } finally {
      $img.Dispose()
    }
  } catch {
    return @{ Width = 1280; Height = 853 }
  }
}

New-Item -ItemType Directory -Force -Path $Inbox | Out-Null
$incoming = @(Get-ImageFiles $Inbox)

if ($incoming.Count -eq 0) {
  Write-Host ''
  Write-Host '  В папке new_foto нет фото.'
  Write-Host '  Положите туда .jpg / .png / .webp / .gif и запустите снова.'
  Write-Host ''
  exit 0
}

$current = @(Get-ImageFiles $OutDir)
$incomingFp = Get-SetFingerprint $incoming
$currentFp = Get-SetFingerprint $current

if ($incomingFp -eq $currentFp) {
  Write-Host ''
  Write-Host ("  Фото уже совпадают ($($incoming.Count) шт.) - менять нечего.")
  Write-Host ''
  exit 0
}

Write-Host ''
Write-Host ("  Найдено новых фото: $($incoming.Count)")
Write-Host ("  Было в галерее:     $($current.Count)")
Write-Host '  Заменяю...'

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem -LiteralPath $OutDir -File | Remove-Item -Force

$manifest = New-Object System.Collections.Generic.List[object]
for ($i = 0; $i -lt $incoming.Count; $i++) {
  $src = $incoming[$i]
  $ext = $src.Extension.ToLowerInvariant()
  if ($ext -eq '.jpeg') { $ext = '.jpg' }
  $file = ('nature_{0:D3}{1}' -f ($i + 1), $ext)
  $dest = Join-Path $OutDir $file
  Copy-Item -LiteralPath $src.FullName -Destination $dest -Force
  $size = Get-ImageSize $dest
  $manifest.Add([ordered]@{
    file   = $file
    width  = $size.Width
    height = $size.Height
    source = ('new_foto/{0}' -f $src.Name)
  }) | Out-Null
  Write-Host ("  -> $file  ($($size.Width)x$($size.Height))")
}

if ($manifest.Count -eq 1) {
  $json = '[' + ($manifest[0] | ConvertTo-Json -Depth 4 -Compress) + ']'
} else {
  $json = $manifest | ConvertTo-Json -Depth 4
}
[IO.File]::WriteAllText($Manifest, $json, [Text.UTF8Encoding]::new($false))

if (Test-Path -LiteralPath (Join-Path $Root 'dist\index.html')) {
  New-Item -ItemType Directory -Force -Path $DistPhotos | Out-Null
  robocopy $OutDir $DistPhotos /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  Write-Host '  Скопировано в dist\photos'
}

Write-Host ("  Манифест: $($manifest.Count) записей -> public\photos\photos.json")
Write-Host ''
Write-Host '  Готово. Запустите Запустить_галерею.bat / Start-Gallery.bat'
Write-Host ''