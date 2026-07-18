param(
  [int]$Port = 5173,
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path

try {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($conn) {
    $conn | ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 400
  }
} catch {}

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Cannot bind port $Port"
  Write-Host $_
  exit 1
}

Write-Host "Gallery running: $prefix"
Write-Host "Close this window (or Ctrl+C) to stop."
Start-Process $prefix

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
