<#
.SYNOPSIS
  Downloads the open-source (CC0) assets used by "Duong dua Toan hoc 3D".

.DESCRIPTION
  Downloads a fixed whitelist of files from verified CC0 sources into
  public/assets/. Safe to run repeatedly. Never deletes anything outside the
  repository's own .cache/game-assets/ working directory.

  Sources are documented in ASSET_SOURCES.md. If a direct URL stops working,
  this script prints the stable source page so the files can be fetched by hand.
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$CacheDir = Join-Path $RepoRoot '.cache/game-assets'
$PublicAssets = Join-Path $RepoRoot 'public/assets'
$ModelsDir = Join-Path $PublicAssets 'models/platformer'
$TexturesDir = Join-Path $ModelsDir 'Textures'
$MusicDir = Join-Path $PublicAssets 'audio/music'
$SfxDir = Join-Path $PublicAssets 'audio/sfx'
$UiDir = Join-Path $PublicAssets 'audio/ui'
$FontDir = Join-Path $PublicAssets 'fonts/baloo2'
$AvatarDir = Join-Path $PublicAssets 'avatars'
$LicenseDir = Join-Path $PublicAssets 'licenses'

# Single files fetched directly rather than from an archive.
$DirectFiles = @(
    @{
        Name = 'Baloo 2 Variable (SIL OFL 1.1)'
        Url  = 'https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf'
        Page = 'https://github.com/google/fonts/tree/main/ofl/baloo2'
        Dest = 'fonts/baloo2/Baloo2-Variable.ttf'
    },
    @{
        Name = 'Baloo 2 license'
        Url  = 'https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/OFL.txt'
        Page = 'https://github.com/google/fonts/tree/main/ofl/baloo2'
        Dest = 'licenses/Baloo2-OFL.txt'
    }
)

$Packs = @(
    @{
        Key      = 'platformer-kit'
        Name     = 'Kenney Platformer Kit 4.1'
        Url      = 'https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip'
        Page     = 'https://kenney.nl/assets/platformer-kit'
        Zip      = 'kenney_platformer-kit.zip'
    },
    @{
        Key      = 'ui-audio'
        Name     = 'Kenney UI Audio 1.0'
        Url      = 'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip'
        Page     = 'https://kenney.nl/assets/ui-audio'
        Zip      = 'kenney_ui-audio.zip'
    },
    @{
        Key      = 'music-jingles'
        Name     = 'Kenney Music Jingles 1.0'
        Url      = 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip'
        Page     = 'https://kenney.nl/assets/music-jingles'
        Zip      = 'kenney_music-jingles.zip'
    },
    @{
        Key      = 'childrens-march'
        Name     = "Children's March Theme - Cleyton Kauffman"
        Url      = 'https://opengameart.org/sites/default/files/childrens_march_theme.zip'
        Page     = 'https://opengameart.org/content/childrens-march-theme'
        Zip      = 'childrens_march_theme.zip'
    },
    # Avatar source packs. Only the individual sprites listed in
    # shared/content/avatars.json are copied out of these.
    @{
        Key      = 'animal-pack-remastered'
        Name     = 'Kenney Animal Pack Remastered'
        Url      = 'https://kenney.nl/media/pages/assets/animal-pack-remastered/54a307a369-1774771709/kenney_animal-pack-remastered.zip'
        Page     = 'https://kenney.nl/assets/animal-pack-remastered'
        Zip      = 'kenney_animal-pack-remastered.zip'
    },
    @{
        Key      = 'robot-pack'
        Name     = 'Kenney Robot Pack'
        Url      = 'https://kenney.nl/media/pages/assets/robot-pack/e545150528-1677670212/kenney_robot-pack.zip'
        Page     = 'https://kenney.nl/assets/robot-pack'
        Zip      = 'kenney_robot-pack.zip'
    },
    @{
        Key      = 'tappy-plane'
        Name     = 'Kenney Tappy Plane'
        Url      = 'https://kenney.nl/media/pages/assets/tappy-plane/78fa8bdf8c-1677700386/kenney_tappy-plane.zip'
        Page     = 'https://kenney.nl/assets/tappy-plane'
        Zip      = 'kenney_tappy-plane.zip'
    },
    @{
        Key      = 'space-shooter-remastered'
        Name     = 'Kenney Space Shooter Remastered'
        Url      = 'https://kenney.nl/media/pages/assets/space-shooter-remastered/2cbf3c45c8-1774771931/kenney_space-shooter-remastered.zip'
        Page     = 'https://kenney.nl/assets/space-shooter-remastered'
        Zip      = 'kenney_space-shooter-remastered.zip'
    },
    @{
        Key      = 'tanks'
        Name     = 'Kenney Tanks'
        Url      = 'https://kenney.nl/media/pages/assets/tanks/d0bbede612-1677579063/kenney_tanks.zip'
        Page     = 'https://kenney.nl/assets/tanks'
        Zip      = 'kenney_tanks.zip'
    },
    @{
        Key      = 'top-down-tanks-remastered'
        Name     = 'Kenney Top-down Tanks Remastered'
        Url      = 'https://kenney.nl/media/pages/assets/top-down-tanks-remastered/f24c234ed5-1774771973/kenney_top-down-tanks-remastered.zip'
        Page     = 'https://kenney.nl/assets/top-down-tanks-remastered'
        Zip      = 'kenney_top-down-tanks-remastered.zip'
    }
)

# Maps the `sourcePack` field of avatars.json onto a pack key above.
$AvatarPackKeys = @{
    'Kenney Animal Pack Remastered'    = 'animal-pack-remastered'
    'Kenney Robot Pack'                = 'robot-pack'
    'Kenney Tappy Plane'               = 'tappy-plane'
    'Kenney Space Shooter Remastered'  = 'space-shooter-remastered'
    'Kenney Tanks'                     = 'tanks'
    'Kenney Top-down Tanks Remastered' = 'top-down-tanks-remastered'
}

# sourceGlob -> destination path (relative to public/assets)
$CopyPlan = [System.Collections.ArrayList]@(
    # A. Models (GLB) + shared colormap texture. The relative Textures/ folder
    #    must be preserved because the GLB files reference it.
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/character-oopi.glb'; Dest = 'models/platformer/character-oopi.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/coin-gold.glb'; Dest = 'models/platformer/coin-gold.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/chest.glb'; Dest = 'models/platformer/chest.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/crate.glb'; Dest = 'models/platformer/crate.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/flag.glb'; Dest = 'models/platformer/flag.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/fence-low-straight.glb'; Dest = 'models/platformer/fence-low-straight.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/rocks.glb'; Dest = 'models/platformer/rocks.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/tree.glb'; Dest = 'models/platformer/tree.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/tree-pine.glb'; Dest = 'models/platformer/tree-pine.glb' },
    @{ Pack = 'platformer-kit'; Match = 'Models/GLB format/Textures/colormap.png'; Dest = 'models/platformer/Textures/colormap.png' },
    @{ Pack = 'platformer-kit'; Match = 'License.txt'; Dest = 'licenses/kenney_platformer-kit_License.txt' },

    # B. UI audio
    @{ Pack = 'ui-audio'; Match = 'Audio/click1.ogg'; Dest = 'audio/ui/click.ogg' },
    @{ Pack = 'ui-audio'; Match = 'Audio/rollover1.ogg'; Dest = 'audio/ui/rollover.ogg' },
    @{ Pack = 'ui-audio'; Match = 'Audio/switch1.ogg'; Dest = 'audio/ui/switch.ogg' },
    @{ Pack = 'ui-audio'; Match = 'License.txt'; Dest = 'licenses/kenney_ui-audio_License.txt' },

    # C. Feedback jingles
    @{ Pack = 'music-jingles'; Match = 'Audio/Pizzicato jingles/jingles_PIZZI00.ogg'; Dest = 'audio/sfx/correct.ogg' },
    @{ Pack = 'music-jingles'; Match = 'Audio/8-Bit jingles/jingles_NES13.ogg'; Dest = 'audio/sfx/wrong.ogg' },
    @{ Pack = 'music-jingles'; Match = 'Audio/Pizzicato jingles/jingles_PIZZI07.ogg'; Dest = 'audio/sfx/finish.ogg' },
    @{ Pack = 'music-jingles'; Match = 'Audio/Pizzicato jingles/jingles_PIZZI03.ogg'; Dest = 'audio/sfx/new-record.ogg' },
    @{ Pack = 'music-jingles'; Match = 'License.txt'; Dest = 'licenses/kenney_music-jingles_License.txt' },

    # D. Background music (OGG so the loop is gapless)
    @{ Pack = 'childrens-march'; Match = "Children's March Theme.ogg"; Dest = 'audio/music/childrens-march-theme.ogg' },
    @{ Pack = 'childrens-march'; Match = 'readme.txt'; Dest = 'licenses/childrens-march-theme_readme.txt' },

    # E. Avatar pack licenses (the sprites themselves come from avatars.json)
    @{ Pack = 'animal-pack-remastered'; Match = 'License.txt'; Dest = 'licenses/kenney_animal-pack-remastered_License.txt' },
    @{ Pack = 'robot-pack'; Match = 'License.txt'; Dest = 'licenses/kenney_robot-pack_License.txt' },
    @{ Pack = 'tappy-plane'; Match = 'License.txt'; Dest = 'licenses/kenney_tappy-plane_License.txt' },
    @{ Pack = 'space-shooter-remastered'; Match = 'license.txt'; Dest = 'licenses/kenney_space-shooter-remastered_License.txt' },
    @{ Pack = 'tanks'; Match = 'License.txt'; Dest = 'licenses/kenney_tanks_License.txt' },
    @{ Pack = 'top-down-tanks-remastered'; Match = 'License.txt'; Dest = 'licenses/kenney_top-down-tanks-remastered_License.txt' }
)

# The avatar sprites are driven entirely by the shared manifest, so the game,
# the server and this script can never disagree about which files exist.
$AvatarManifestPath = Join-Path $RepoRoot 'shared/content/avatars.json'
$AvatarManifest = (Get-Content -LiteralPath $AvatarManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).items

foreach ($avatar in $AvatarManifest) {
    $packKey = $AvatarPackKeys[$avatar.sourcePack]
    if ($null -eq $packKey) {
        Write-Host "Unknown sourcePack in avatars.json: $($avatar.sourcePack)" -ForegroundColor Red
        exit 1
    }
    [void]$CopyPlan.Add(@{
        Pack = $packKey
        Match = $avatar.sourceFile
        Dest = "avatars/$($avatar.id).png"
    })
}

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Warn2([string]$Message) {
    Write-Host "    !!  $Message" -ForegroundColor Yellow
}

foreach ($dir in @($CacheDir, $ModelsDir, $TexturesDir, $MusicDir, $SfxDir, $UiDir, $FontDir, $AvatarDir, $LicenseDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$failedDownloads = @()

foreach ($pack in $Packs) {
    $zipPath = Join-Path $CacheDir $pack.Zip
    $extractDir = Join-Path $CacheDir $pack.Key

    if ((Test-Path $zipPath) -and -not $Force) {
        Write-Step "$($pack.Name): using cached archive"
    }
    else {
        Write-Step "$($pack.Name): downloading"
        try {
            Invoke-WebRequest -Uri $pack.Url -OutFile $zipPath -MaximumRedirection 5 -UseBasicParsing
            Write-Ok "downloaded $($pack.Zip)"
        }
        catch {
            Write-Warn2 "download failed: $($_.Exception.Message)"
            Write-Warn2 "Download manually from the stable source page: $($pack.Page)"
            Write-Warn2 "Then place the archive at: $zipPath and re-run this script."
            $failedDownloads += $pack.Name
            continue
        }
    }

    if (-not (Test-Path $zipPath)) { continue }

    # Re-extract into a dedicated folder inside .cache so repeated runs are safe.
    if (Test-Path $extractDir) {
        Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

    try {
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
        Write-Ok "extracted to .cache/game-assets/$($pack.Key)"
    }
    catch {
        Write-Warn2 "extract failed: $($_.Exception.Message)"
        Write-Warn2 "The archive may be corrupt. Delete $zipPath and re-run with -Force."
        $failedDownloads += $pack.Name
    }
}

Write-Step 'Downloading single files'

$copied = @()
$missing = @()

foreach ($file in $DirectFiles) {
    $destPath = Join-Path $PublicAssets $file.Dest
    if ((Test-Path $destPath) -and -not $Force) {
        Write-Ok "$($file.Name): already present"
        $copied += $file.Dest
        continue
    }

    try {
        Invoke-WebRequest -Uri $file.Url -OutFile $destPath -MaximumRedirection 5 -UseBasicParsing
        Write-Ok "downloaded $($file.Dest)"
        $copied += $file.Dest
    }
    catch {
        Write-Warn2 "download failed: $($_.Exception.Message)"
        Write-Warn2 "Download manually from: $($file.Page)"
        Write-Warn2 "Then save it as: $destPath"
        $missing += $file.Dest
    }
}

Write-Step 'Copying whitelisted files into public/assets'

foreach ($item in $CopyPlan) {
    $extractDir = Join-Path $CacheDir $item.Pack
    if (-not (Test-Path $extractDir)) {
        $missing += $item.Dest
        continue
    }

    $wanted = $item.Match -replace '/', [System.IO.Path]::DirectorySeparatorChar
    $source = Get-ChildItem -LiteralPath $extractDir -Recurse -File |
        Where-Object { $_.FullName.EndsWith($wanted, [System.StringComparison]::OrdinalIgnoreCase) } |
        Select-Object -First 1

    if ($null -eq $source) {
        $missing += "$($item.Dest)  (not found in pack: $($item.Match))"
        continue
    }

    $destPath = Join-Path $PublicAssets $item.Dest
    $destParent = Split-Path -Parent $destPath
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Force -Path $destParent | Out-Null
    }

    Copy-Item -LiteralPath $source.FullName -Destination $destPath -Force
    $copied += $item.Dest
}

Write-Host ''
Write-Step 'Prepared files'
foreach ($file in $copied) {
    $full = Join-Path $PublicAssets $file
    $size = [math]::Round((Get-Item -LiteralPath $full).Length / 1KB, 1)
    Write-Host ("    {0,-52} {1,8} KB" -f $file, $size)
}

if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'MISSING FILES:' -ForegroundColor Red
    foreach ($file in $missing) {
        Write-Host "    - $file" -ForegroundColor Red
    }
    Write-Host ''
    Write-Host 'Stable source pages:' -ForegroundColor Yellow
    foreach ($pack in $Packs) {
        Write-Host "    $($pack.Name): $($pack.Page)" -ForegroundColor Yellow
    }
    exit 1
}

if ($failedDownloads.Count -gt 0) {
    Write-Host ''
    Write-Host "Some packs failed to download: $($failedDownloads -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host "All $($copied.Count) asset files are ready in public/assets/." -ForegroundColor Green
