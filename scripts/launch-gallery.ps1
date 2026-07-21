#Requires -Version 5.0
# Запуск галереи без Node.js: подготовка файлов + HTTP на свободном порту.
$ErrorActionPreference = 'Continue'
try {
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
  $OutputEncoding = [Text.Encoding]::UTF8
} catch {}

function Write-Info([string]$Message) { Write-Host "  $Message" }
function Write-Err([string]$Message) {
  Write-Host ''
  Write-Host "  [!] $Message" -ForegroundColor Yellow
  Write-Host ''
}

function Get-ProjectRoot {
  if ($PSScriptRoot) {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  }
  return (Get-Location).Path
}

function Test-PortFree([int]$Port) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Find-FreePort {
  $preferred = @(8765, 8080, 8000, 8888, 5173, 3000, 5000, 9000, 18080)
  $scan = 8800..8999
  $scan2 = 19000..19100
  foreach ($p in ($preferred + $scan + $scan2)) {
    if (Test-PortFree $p) { return [int]$p }
  }
  throw 'Не найден свободный порт на 127.0.0.1. Закройте лишние программы или перезагрузите ПК.'
}

function Copy-TreeRobust([string]$Source, [string]$Dest, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Нет папки ${Label}: $Source"
  }
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  $ok = $false
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      & robocopy.exe $Source $Dest /E /R:2 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
      if ($LASTEXITCODE -le 7) { $ok = $true; break }
    } catch {}

    try {
      Get-ChildItem -LiteralPath $Source -Recurse -File -ErrorAction Stop | ForEach-Object {
        $rel = $_.FullName.Substring((Resolve-Path -LiteralPath $Source).Path.Length).TrimStart('\', '/')
        $target = Join-Path $Dest $rel
        $dir = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $dir)) {
          New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force -ErrorAction Stop
      }
      $ok = $true
      break
    } catch {
      Start-Sleep -Milliseconds (400 * $attempt)
    }
  }

  if (-not $ok) {
    throw "Не удалось скопировать ${Label}. Закройте браузер/проводник/антивирус, блокирующий файлы, и попробуйте снова."
  }
}

function Get-ContentType([string]$ext) {
  switch ($ext.ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js'   { return 'application/javascript; charset=utf-8' }
    '.mjs'  { return 'application/javascript; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.png'  { return 'image/png' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.webp' { return 'image/webp' }
    '.gif'  { return 'image/gif' }
    '.svg'  { return 'image/svg+xml' }
    '.ico'  { return 'image/x-icon' }
    '.map'  { return 'application/json' }
    '.bin'  { return 'application/octet-stream' }
    default { return 'application/octet-stream' }
  }
}

function Get-SafeFilePath([string]$RootWithSep, [string]$UrlPath) {
  try {
    $rel = [Uri]::UnescapeDataString((($UrlPath -split '\?', 2)[0]))
  } catch {
    return $null
  }
  if (($rel -eq '/') -or ($rel -eq '') -or ($null -eq $rel)) { $rel = '/index.html' }
  $rel = $rel.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
  if ($rel.Contains('..')) { return $null }
  try {
    $full = [IO.Path]::GetFullPath([IO.Path]::Combine($RootWithSep, $rel))
  } catch {
    return $null
  }
  if (-not $full.StartsWith($RootWithSep, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  return $full
}

function Write-Http([System.Net.Sockets.NetworkStream]$Stream, [int]$Status, [string]$StatusText, [string]$ContentType, [byte[]]$Body, [bool]$WriteBody) {
  if ($null -eq $Body) { $Body = [byte[]]@() }
  $header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-cache`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($WriteBody -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Handle-Client([System.Net.Sockets.TcpClient]$Client, [string]$RootWithSep) {
  $stream = $null
  try {
    $Client.ReceiveTimeout = 20000
    $Client.SendTimeout = 20000
    $stream = $Client.GetStream()
    $buffer = New-Object byte[] 16384
    $ms = New-Object IO.MemoryStream
    while ($true) {
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) { break }
      $ms.Write($buffer, 0, $read)
      $textSoFar = [Text.Encoding]::ASCII.GetString($ms.ToArray())
      if ($textSoFar.Contains("`r`n`r`n")) { break }
      if ($ms.Length -gt 65536) { break }
    }
    $reqText = [Text.Encoding]::ASCII.GetString($ms.ToArray())
    $firstLine = (($reqText -split "`r`n")[0])
    if ([string]::IsNullOrWhiteSpace($firstLine)) { return }
    $parts = $firstLine.Split(' ')
    if ($parts.Length -lt 2) {
      Write-Http $stream 400 'Bad Request' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Bad Request')) $true
      return
    }
    $method = $parts[0].ToUpperInvariant()
    $urlPath = $parts[1]
    if ($method -eq 'OPTIONS') {
      Write-Http $stream 204 'No Content' 'text/plain' ([byte[]]@()) $false
      return
    }
    if ($method -ne 'GET' -and $method -ne 'HEAD') {
      Write-Http $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Method Not Allowed')) $true
      return
    }
    $filePath = Get-SafeFilePath $RootWithSep $urlPath
    if ((-not $filePath) -or (-not (Test-Path -LiteralPath $filePath -PathType Leaf))) {
      Write-Http $stream 404 'Not Found' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Not found')) $true
      return
    }
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $type = Get-ContentType ([IO.Path]::GetExtension($filePath))
    Write-Http $stream 200 'OK' $type $bytes ($method -ne 'HEAD')
  } catch {
    try {
      if ($stream -and $stream.CanWrite) {
        Write-Http $stream 500 'Internal Server Error' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Server error')) $true
      }
    } catch {}
  } finally {
    try { if ($stream) { $stream.Close() } } catch {}
    try { $Client.Close() } catch {}
  }
}

function Open-Browser([string]$Url) {
  try { Start-Process $Url | Out-Null; return $true } catch {}
  try { Start-Process 'cmd.exe' -ArgumentList @('/c', "start `"`" `"$Url`"") -WindowStyle Hidden | Out-Null; return $true } catch {}
  try { [void][Diagnostics.Process]::Start($Url); return $true } catch {}
  return $false
}

function Show-Pause {
  Write-Host ''
  Write-Host '  Нажмите любую клавишу, чтобы закрыть это окно...'
  try { $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') } catch { try { Read-Host 'Enter' | Out-Null } catch {} }
}

$tcp = $null
try {
  $Root = Get-ProjectRoot
  Set-Location -LiteralPath $Root

  Write-Host ''
  Write-Host '  Виртуальная галерея природы'
  Write-Host '  ============================'
  Write-Host ''

  $dist = Join-Path $Root 'dist'
  $index = Join-Path $dist 'index.html'
  $assetsDir = Join-Path $dist 'assets'
  $publicPhotos = Join-Path $Root 'public\photos'
  $publicSecret = Join-Path $Root 'public\secret'
  $distPhotos = Join-Path $dist 'photos'
  $distSecret = Join-Path $dist 'secret'

  if (-not (Test-Path -LiteralPath $index)) {
    Write-Err 'Не найдена готовая галерея: dist\index.html'
    Write-Info 'Скачайте ZIP заново с GitHub и распакуйте ВСЮ папку (не удаляйте dist).'
    Write-Info 'https://github.com/nsasa0474-lgtm/virtual-nature-gallery'
    Show-Pause
    exit 1
  }
  if (-not (Test-Path -LiteralPath $assetsDir)) {
    Write-Err 'Папка dist\assets пустая или отсутствует. Скачайте свежий ZIP с GitHub.'
    Show-Pause
    exit 1
  }
  if (-not (Test-Path -LiteralPath $publicPhotos)) {
    Write-Err 'Нет папки public\photos. Скачайте ZIP заново.'
    Show-Pause
    exit 1
  }

  $photoCount = @(Get-ChildItem -LiteralPath $publicPhotos -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp|gif)$' }).Count
  if ($photoCount -lt 1) {
    Write-Err 'В public\photos нет изображений. Положите фото в new_foto и запустите smena_foto.bat'
    Show-Pause
    exit 1
  }

  Write-Info "Найдено фото: $photoCount"
  Write-Info 'Подготовка файлов...'
  try {
    Copy-TreeRobust $publicPhotos $distPhotos 'фото'
    if (Test-Path -LiteralPath $publicSecret) {
      Copy-TreeRobust $publicSecret $distSecret 'секретные файлы'
    }
  } catch {
    Write-Err $_.Exception.Message
    Show-Pause
    exit 1
  }

  if (-not (Test-Path -LiteralPath (Join-Path $distPhotos 'photos.json'))) {
    Write-Err 'Нет dist\photos\photos.json после копирования. Запустите smena_foto.bat или скачайте ZIP заново.'
    Show-Pause
    exit 1
  }

  Write-Info 'Ищу свободный порт...'
  try {
    $port = Find-FreePort
  } catch {
    Write-Err $_.Exception.Message
    Show-Pause
    exit 1
  }

  $rootWithSep = $dist
  if (-not $rootWithSep.EndsWith([IO.Path]::DirectorySeparatorChar)) {
    $rootWithSep += [IO.Path]::DirectorySeparatorChar
  }

  try {
    $tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
    $tcp.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)
    $tcp.Start()
  } catch {
    Write-Err "Не удалось открыть порт ${port}: $($_.Exception.Message)"
    Write-Info 'Добавьте папку проекта в исключения антивируса и попробуйте снова.'
    Show-Pause
    exit 1
  }

  $url = "http://127.0.0.1:$port/"
  try {
    [IO.File]::WriteAllText((Join-Path $Root 'gallery-url.txt'), $url, [Text.UTF8Encoding]::new($false))
  } catch {}

  Write-Host ''
  Write-Info "Адрес: $url"
  Write-Info 'Если браузер не открылся - скопируйте адрес из строки выше или из файла gallery-url.txt'
  Write-Info 'Остановка: просто закройте это окно.'
  Write-Host ''

  if (-not (Open-Browser $url)) {
    Write-Info 'Автооткрытие браузера не удалось - откройте адрес вручную.'
  }

  while ($true) {
    try {
      $client = $tcp.AcceptTcpClient()
      Handle-Client $client $rootWithSep
    } catch {
      Start-Sleep -Milliseconds 30
    }
  }
} catch {
  Write-Err "Неожиданная ошибка: $($_.Exception.Message)"
  Write-Info '1) Распакуйте ZIP на Рабочий стол (не запускайте изнутри архива)'
  Write-Info '2) Запустите Start-Gallery.bat'
  Write-Info '3) Если SmartScreen ругается: Подробнее -> Выполнить в любом случае'
  Show-Pause
  exit 1
} finally {
  try { if ($null -ne $tcp) { $tcp.Stop() } } catch {}
}