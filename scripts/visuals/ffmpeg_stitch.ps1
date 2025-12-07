# Simple helper to stitch image sequence + audio into an MP4.
# Usage:
#   ./scripts/visuals/ffmpeg_stitch.ps1 -Images "frame%05d.png" -Audio "input.wav" -Out "output.mp4" -Fps 30

param(
    [string]$Images = "frame%05d.png",
    [string]$Audio = "audio.wav",
    [string]$Out = "out.mp4",
    [int]$Fps = 30
)

ffmpeg -y -r $Fps -i $Images -i $Audio -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 320k $Out
