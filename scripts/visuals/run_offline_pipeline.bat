@echo off
setlocal
REM Run the offline audio-reactive render (analysis + Blender) in one click.
REM Edit the paths below to point to your audio and background video.

REM --- User-editable paths ---
set "REPO_DIR=C:\Users\jonch\reset-biology-website"
set "AUDIO=C:\Users\jonch\Downloads\your_audio.wav"
set "BACKGROUND=C:\Users\jonch\Downloads\Zion1.mp4"
set "OUTPUT=%REPO_DIR%\renders\orb-zion.mp4"

REM --- Render parameters ---
set "BLENDER_EXE=blender"
set "MODE=equirect"           REM equirect for 360, perspective for HD
set "RES_X=7680"              REM horizontal resolution
set "FPS=30"
set "MASK_FLAG=--mask-sky"    REM blank to disable sky keying
set "USE_CYCLES="             REM set to --use_cycles for higher quality (slower)

REM --- Derived paths ---
set "ANALYSIS=%REPO_DIR%\scripts\visuals\output\analysis.json"
set "BLENDER_SCRIPT=%REPO_DIR%\scripts\visuals\blender_generate.py"
set "ANALYZE_SCRIPT=%REPO_DIR%\scripts\visuals\analyze_audio.py"

if not exist "%AUDIO%" (
  echo [ERROR] Audio file not found: %AUDIO%
  echo Edit scripts/visuals/run_offline_pipeline.bat and set AUDIO to a valid file.
  pause
  exit /b 1
)

if not exist "%BACKGROUND%" (
  echo [WARN] Background video not found: %BACKGROUND%
  echo Continuing without a background video...
  set "BACKGROUND_FLAG="
) else (
  set "BACKGROUND_FLAG=--background-video %BACKGROUND%"
)

if not exist "%REPO_DIR%" (
  echo [ERROR] Repo path not found: %REPO_DIR%
  pause
  exit /b 1
)

if not exist "%REPO_DIR%\renders" mkdir "%REPO_DIR%\renders"
if not exist "%REPO_DIR%\scripts\visuals\output" mkdir "%REPO_DIR%\scripts\visuals\output"

pushd "%REPO_DIR%"

echo [1/2] Analyzing audio...
python "%ANALYZE_SCRIPT%" "%AUDIO%" "%ANALYSIS%"
if errorlevel 1 goto :err

echo [2/2] Rendering in Blender...
"%BLENDER_EXE%" -b -P "%BLENDER_SCRIPT%" -- ^
  --analysis "%ANALYSIS%" ^
  --audio "%AUDIO%" ^
  --out "%OUTPUT%" ^
  --mode %MODE% ^
  --resolution %RES_X% ^
  --fps %FPS% ^
  %BACKGROUND_FLAG% ^
  %MASK_FLAG% ^
  %USE_CYCLES%

if errorlevel 1 goto :err

echo.
echo [DONE] Render complete: %OUTPUT%
popd
pause
exit /b 0

:err
echo.
echo [FAILED] See messages above.
popd
pause
exit /b 1
