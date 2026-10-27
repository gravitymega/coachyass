# Petit serveur web local pour Windows (aucune installation). Lancé par lancer-windows.bat.
$port = 8000
$root = Split-Path -Parent $PSScriptRoot
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png';
  '.jpg'='image/jpeg'; '.mp3'='audio/mpeg'; '.txt'='text/plain' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$port/")
$l.Start()
Write-Host "Jeu de Hbibiti : http://localhost:$port  (fermer cette fenetre arrete le jeu)"
Start-Process "http://localhost:$port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq '') { $p = 'index.html' }
  $f = [IO.Path]::GetFullPath((Join-Path $root $p))
  if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $b = [IO.File]::ReadAllBytes($f)
    $c.Response.ContentLength64 = $b.Length
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
