# Совместимость: старый вход теперь просто запускает новый лаунчер.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here 'scripts\launch-gallery.ps1')
exit $LASTEXITCODE
