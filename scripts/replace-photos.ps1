#Requires -Version 5.0
# Замена фото из new_foto без Node.js (безопасно, с откатом при ошибке).
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
} catch {}

function Write-Info([string]$Message) { Write-Host "  $Message" }
function Write-Err([string]$Message) {
  Write-Host ''
  Write-Host "  [!] $Message" -ForegroundColor Yellow
  Write-Host ''
}

function Show-Pause {
  Write-Host ''
  Write-Host '  Нажмите любую клавишу...'
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { try { Read-Host 'Enter' | Out-Null } catch {} }
}

function Get-ImageFiles([string]$Dir, [string[]]$ImageExt) {
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  Get-ChildItem -LiteralPath $Dir -File -ErrorAction SilentlyContinue |
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

try {
  if ($PSScriptRoot) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  } else {
    $Root = (Get-Location).Path
  }

  $Inbox = Join-Path $Root 'new_foto'
  $OutDir = Join-Path $Root 'public\photos'
  $DistPhotos = Join-Path $Root 'dist\photos'
  $Manifest = Join-Path $OutDir 'photos.json'
  $Staging = Join-Path $Root 'public\photos_staging'
  $Backup = Join-Path $Root 'public\photos_backup'
  $ImageExt = @('.jpg', '.jpeg', '.png', '.webp', '.gif')

  New-Item -ItemType Directory -Force -Path $Inbox | Out-Null
  $incoming = @(Get-ImageFiles $Inbox $ImageExt)

  if ($incoming.Count -eq 0) {
    Write-Host ''
    Write-Info 'В папке new_foto нет фото.'
    Write-Info 'Положите туда .jpg / .png / .webp / .gif и запустите снова.'
    Write-Host ''
    exit 0
  }

  # Skip tiny/corrupt files
  $valid = @()
  foreach ($f in $incoming) {
    if ($f.Length -lt 100) {
      Write-Info "Пропуск (слишком маленький файл): $($f.Name)"
      continue
    }
    $valid += $f
  }
  if ($valid.Count -eq 0) {
    Write-Err 'В new_foto нет пригодных изображений (файлы пустые или битые).'
    exit 1
  }
  $incoming = $valid

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $current = @(Get-ImageFiles $OutDir $ImageExt)
  $incomingFp = Get-SetFingerprint $incoming
  $currentFp = Get-SetFingerprint $current

  if ($incomingFp -eq $currentFp) {
    Write-Host ''
    Write-Info ("Фото уже совпадают ($($incoming.Count) шт.) - менять нечего.")
    Write-Host ''
    exit 0
  }

  Write-Host ''
  Write-Info ("Найдено новых фото: $($incoming.Count)")
  Write-Info ("Было в галерее:     $($current.Count)")
  Write-Info 'Готовлю замену (сначала во временную папку)...'

  if (Test-Path -LiteralPath $Staging) { Remove-Item -LiteralPath $Staging -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $Staging | Out-Null

  $manifest = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $incoming.Count; $i++) {
    $src = $incoming[$i]
    $ext = $src.Extension.ToLowerInvariant()
    if ($ext -eq '.jpeg') { $ext = '.jpg' }
    $file = ('nature_{0:D3}{1}' -f ($i + 1), $ext)
    $dest = Join-Path $Staging $file
    Copy-Item -LiteralPath $src.FullName -Destination $dest -Force
    $size = Get-ImageSize $dest
    $manifest.Add([ordered]@{
      file   = $file
      width  = $size.Width
      height = $size.Height
      source = ('new_foto/{0}' -f $src.Name)
    }) | Out-Null
    Write-Info ("-> $file  ($($size.Width)x$($size.Height))")
  }

  if ($manifest.Count -eq 1) {
    $json = '[' + ($manifest[0] | ConvertTo-Json -Depth 4 -Compress) + ']'
  } else {
    $json = $manifest | ConvertTo-Json -Depth 4
  }
  $stagingManifest = Join-Path $Staging 'photos.json'
  [IO.File]::WriteAllText($stagingManifest, $json, [Text.UTF8Encoding]::new($false))

  # Atomic-ish swap via rename
  if (Test-Path -LiteralPath $Backup) { Remove-Item -LiteralPath $Backup -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $OutDir) {
    Rename-Item -LiteralPath $OutDir -NewName 'photos_backup'
  }
  try {
    Rename-Item -LiteralPath $Staging -NewName 'photos'
  } catch {
    # rollback
    if (Test-Path -LiteralPath $Backup) {
      Rename-Item -LiteralPath $Backup -NewName 'photos' -ErrorAction SilentlyContinue
    }
    throw "Не удалось заменить папку фото: $($_.Exception.Message)"
  }

  if (Test-Path -LiteralPath $Backup) {
    Remove-Item -LiteralPath $Backup -Recurse -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath (Join-Path $Root 'dist\index.html')) {
    New-Item -ItemType Directory -Force -Path $DistPhotos | Out-Null
    & robocopy.exe $OutDir $DistPhotos /E /R:2 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Info 'Скопировано в dist\photos'
  }

  Write-Info ("Манифест: $($manifest.Count) записей -> public\photos\photos.json")
  Write-Host ''
  Write-Info 'Готово. Запустите Запустить_галерею.bat / Start-Gallery.bat'
  Write-Host ''
  exit 0
} catch {
  Write-Err "Ошибка смены фото: $($_.Exception.Message)"
  Write-Info 'Убедитесь, что галерея сейчас НЕ запущена (закройте чёрное окно сервера).'
  Write-Info 'Файлы в new_foto не удаляются - можно повторить.'
  exit 1
}