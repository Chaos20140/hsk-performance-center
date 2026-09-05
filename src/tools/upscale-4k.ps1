# HSK Performance Center — Clips auf 4K skalieren (lokal, Windows PowerShell)
# Voraussetzung: ffmpeg im PATH (winget install Gyan.FFmpeg)
# Aufruf:  .\upscale-4k.ps1 -Src "D:\HSK Performance Center" -Out "D:\HSK Performance Center\export"
#
# Ergebnis pro Clip:
#   <name>-4k.mp4    3840x2160, H.264 High, CRF 18, yuv420p, faststart, ohne Ton
#   <name>-1080.mp4  1920x1080, CRF 21 (Fallback für Mobile / langsame Leitungen)
#   <name>-poster.jpg  Einzelbild bei 1 s als Poster
#
# Hinweis: Lanczos-Skalierung liefert sauberes, aber kein "echtes" 4K — die Schärfe
# bleibt die der Quelle. Wenn Originale mit höherer Auflösung vorliegen, immer die nehmen.

param(
  [string]$Src = ".",
  [string]$Out = ".\export"
)

New-Item -ItemType Directory -Force -Path $Out | Out-Null
$clips = Get-ChildItem -Path $Src -Recurse -Include *.mp4,*.mov,*.m4v -File

foreach ($c in $clips) {
  $name = [IO.Path]::GetFileNameWithoutExtension($c.Name)
  Write-Host "→ $name"

  # 4K, gerade Kantenlängen, Seitenverhältnis bleibt (schwarze Balken statt Verzerrung)
  ffmpeg -y -hide_banner -loglevel error -i "$($c.FullName)" -an `
    -vf "scale=3840:2160:flags=lanczos:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:0.4:3:3:0.0,format=yuv420p" `
    -c:v libx264 -profile:v high -level 5.1 -preset slow -crf 18 -g 60 -movflags +faststart `
    "$Out\$name-4k.mp4"

  # 1080p Fallback
  ffmpeg -y -hide_banner -loglevel error -i "$($c.FullName)" -an `
    -vf "scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" `
    -c:v libx264 -profile:v high -preset slow -crf 21 -g 60 -movflags +faststart `
    "$Out\$name-1080.mp4"

  # Poster
  ffmpeg -y -hide_banner -loglevel error -ss 1 -i "$Out\$name-4k.mp4" -frames:v 1 -q:v 3 "$Out\$name-poster.jpg"
}

Write-Host "Fertig. Prüfen mit: ffprobe -select_streams v:0 -show_entries stream=codec_name,width,height <datei>"
