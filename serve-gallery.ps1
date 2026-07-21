param(
  [int]$Port = 8765,
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not $Root.EndsWith([IO.Path]::DirectorySeparatorChar)) {
  $Root = $Root + [IO.Path]::DirectorySeparatorChar
}

function Get-ContentType([string]$ext) {
  switch ($ext.ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js'   { return 'application/javascript; charset=utf-8' }
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

function Get-SafePath([string]$urlPath) {
  $rel = [System.Uri]::UnescapeDataString($urlPath)
  if (($rel -eq '/') -or ($rel -eq '')) { $rel = '/index.html' }
  $rel = $rel.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
  $full = [IO.Path]::GetFullPath([IO.Path]::Combine($Root, $rel))
  if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  return $full
}

function Start-GalleryListener([int]$tryPort) {
  $listener = New-Object System.Net.HttpListener
  $prefix = "http://127.0.0.1:$tryPort/"
  $listener.Prefixes.Add($prefix)
  $listener.Start()
  return @{ Listener = $listener; Prefix = $prefix; Port = $tryPort }
}

$started = $null
$lastError = $null
for ($i = 0; $i -lt 25; $i++) {
  $tryPort = $Port + $i
  try {
    $conn = Get-NetTCPConnection -LocalPort $tryPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) { continue }
    $started = Start-GalleryListener $tryPort
    break
  } catch {
    $lastError = $_
    try { if ($started -and $started.Listener) { $started.Listener.Close() } } catch {}
    $started = $null
  }
}

if (-not $started) {
  Write-Host "Cannot bind port near $Port"
  if ($lastError) { Write-Host $lastError }
  exit 1
}

Write-Host ""
Write-Host "  Р’РёСЂС‚СѓР°Р»СЊРЅР°СЏ РіР°Р»РµСЂРµСЏ РїСЂРёСЂРѕРґС‹"
Write-Host "  ============================"
Write-Host "  $($started.Prefix)"
Write-Host "  Р—Р°РєСЂРѕР№С‚Рµ СЌС‚Рѕ РѕРєРЅРѕ, С‡С‚РѕР±С‹ РѕСЃС‚Р°РЅРѕРІРёС‚СЊ РіР°Р»РµСЂРµСЋ."
Write-Host ""
Start-Process $started.Prefix

$listener = $started.Listener
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $filePath = Get-SafePath $req.Url.AbsolutePath
      if ((-not $filePath) -or (-not (Test-Path -LiteralPath $filePath -PathType Leaf))) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ext = [IO.Path]::GetExtension($filePath)
        $res.ContentType = Get-ContentType $ext
        $bytes = [IO.File]::ReadAllBytes($filePath)
        $res.StatusCode = 200
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
}
