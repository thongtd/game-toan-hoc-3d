#!/usr/bin/env bash
#
# Downloads the open-source (CC0) assets used by "Duong dua Toan hoc 3D".
#
# Downloads a fixed whitelist of files from verified CC0 sources into
# public/assets/. Safe to run repeatedly. Never deletes anything outside the
# repository's own .cache/game-assets/ working directory.
#
# Sources are documented in ASSET_SOURCES.md. If a direct URL stops working the
# script prints the stable source page so the files can be fetched by hand.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CACHE_DIR="${REPO_ROOT}/.cache/game-assets"
PUBLIC_ASSETS="${REPO_ROOT}/public/assets"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

# key|display name|url|stable page|zip filename
PACKS=(
  "platformer-kit|Kenney Platformer Kit 4.1|https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip|https://kenney.nl/assets/platformer-kit|kenney_platformer-kit.zip"
  "ui-audio|Kenney UI Audio 1.0|https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip|https://kenney.nl/assets/ui-audio|kenney_ui-audio.zip"
  "music-jingles|Kenney Music Jingles 1.0|https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip|https://kenney.nl/assets/music-jingles|kenney_music-jingles.zip"
  "childrens-march|Children's March Theme - Cleyton Kauffman|https://opengameart.org/sites/default/files/childrens_march_theme.zip|https://opengameart.org/content/childrens-march-theme|childrens_march_theme.zip"
  # Avatar source packs. Only the individual sprites listed in
  # shared/content/avatars.json are copied out of these.
  "animal-pack-remastered|Kenney Animal Pack Remastered|https://kenney.nl/media/pages/assets/animal-pack-remastered/54a307a369-1774771709/kenney_animal-pack-remastered.zip|https://kenney.nl/assets/animal-pack-remastered|kenney_animal-pack-remastered.zip"
  "robot-pack|Kenney Robot Pack|https://kenney.nl/media/pages/assets/robot-pack/e545150528-1677670212/kenney_robot-pack.zip|https://kenney.nl/assets/robot-pack|kenney_robot-pack.zip"
  "tappy-plane|Kenney Tappy Plane|https://kenney.nl/media/pages/assets/tappy-plane/78fa8bdf8c-1677700386/kenney_tappy-plane.zip|https://kenney.nl/assets/tappy-plane|kenney_tappy-plane.zip"
  "space-shooter-remastered|Kenney Space Shooter Remastered|https://kenney.nl/media/pages/assets/space-shooter-remastered/2cbf3c45c8-1774771931/kenney_space-shooter-remastered.zip|https://kenney.nl/assets/space-shooter-remastered|kenney_space-shooter-remastered.zip"
  "tanks|Kenney Tanks|https://kenney.nl/media/pages/assets/tanks/d0bbede612-1677579063/kenney_tanks.zip|https://kenney.nl/assets/tanks|kenney_tanks.zip"
  "top-down-tanks-remastered|Kenney Top-down Tanks Remastered|https://kenney.nl/media/pages/assets/top-down-tanks-remastered/f24c234ed5-1774771973/kenney_top-down-tanks-remastered.zip|https://kenney.nl/assets/top-down-tanks-remastered|kenney_top-down-tanks-remastered.zip"
)

# Single files fetched directly rather than from an archive.
# display name|url|stable page|destination relative to public/assets
DIRECT_FILES=(
  "Baloo 2 Variable (SIL OFL 1.1)|https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf|https://github.com/google/fonts/tree/main/ofl/baloo2|fonts/baloo2/Baloo2-Variable.ttf"
  "Baloo 2 license|https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/OFL.txt|https://github.com/google/fonts/tree/main/ofl/baloo2|licenses/Baloo2-OFL.txt"
)

# pack key|path suffix inside the archive|destination relative to public/assets
COPY_PLAN=(
  # A. Models (GLB) + shared colormap texture. The relative Textures/ folder
  #    must be preserved because the GLB files reference it.
  "platformer-kit|Models/GLB format/character-oopi.glb|models/platformer/character-oopi.glb"
  "platformer-kit|Models/GLB format/coin-gold.glb|models/platformer/coin-gold.glb"
  "platformer-kit|Models/GLB format/chest.glb|models/platformer/chest.glb"
  "platformer-kit|Models/GLB format/crate.glb|models/platformer/crate.glb"
  "platformer-kit|Models/GLB format/flag.glb|models/platformer/flag.glb"
  "platformer-kit|Models/GLB format/fence-low-straight.glb|models/platformer/fence-low-straight.glb"
  "platformer-kit|Models/GLB format/rocks.glb|models/platformer/rocks.glb"
  "platformer-kit|Models/GLB format/tree.glb|models/platformer/tree.glb"
  "platformer-kit|Models/GLB format/tree-pine.glb|models/platformer/tree-pine.glb"
  "platformer-kit|Models/GLB format/Textures/colormap.png|models/platformer/Textures/colormap.png"
  "platformer-kit|License.txt|licenses/kenney_platformer-kit_License.txt"

  # B. UI audio
  "ui-audio|Audio/click1.ogg|audio/ui/click.ogg"
  "ui-audio|Audio/rollover1.ogg|audio/ui/rollover.ogg"
  "ui-audio|Audio/switch1.ogg|audio/ui/switch.ogg"
  "ui-audio|License.txt|licenses/kenney_ui-audio_License.txt"

  # C. Feedback jingles
  "music-jingles|Audio/Pizzicato jingles/jingles_PIZZI00.ogg|audio/sfx/correct.ogg"
  "music-jingles|Audio/8-Bit jingles/jingles_NES13.ogg|audio/sfx/wrong.ogg"
  "music-jingles|Audio/Pizzicato jingles/jingles_PIZZI07.ogg|audio/sfx/finish.ogg"
  "music-jingles|Audio/Pizzicato jingles/jingles_PIZZI03.ogg|audio/sfx/new-record.ogg"
  "music-jingles|License.txt|licenses/kenney_music-jingles_License.txt"

  # D. Background music (OGG so the loop is gapless)
  "childrens-march|Children's March Theme.ogg|audio/music/childrens-march-theme.ogg"
  "childrens-march|readme.txt|licenses/childrens-march-theme_readme.txt"

  # E. Avatar pack licenses (the sprites themselves come from avatars.json)
  "animal-pack-remastered|License.txt|licenses/kenney_animal-pack-remastered_License.txt"
  "robot-pack|License.txt|licenses/kenney_robot-pack_License.txt"
  "tappy-plane|License.txt|licenses/kenney_tappy-plane_License.txt"
  "space-shooter-remastered|license.txt|licenses/kenney_space-shooter-remastered_License.txt"
  "tanks|License.txt|licenses/kenney_tanks_License.txt"
  "top-down-tanks-remastered|License.txt|licenses/kenney_top-down-tanks-remastered_License.txt"
)

# Maps the `sourcePack` field of avatars.json onto a pack key above.
avatar_pack_key() {
  case "$1" in
    'Kenney Animal Pack Remastered') echo 'animal-pack-remastered' ;;
    'Kenney Robot Pack') echo 'robot-pack' ;;
    'Kenney Tappy Plane') echo 'tappy-plane' ;;
    'Kenney Space Shooter Remastered') echo 'space-shooter-remastered' ;;
    'Kenney Tanks') echo 'tanks' ;;
    'Kenney Top-down Tanks Remastered') echo 'top-down-tanks-remastered' ;;
    *) echo '' ;;
  esac
}

# The avatar sprites are driven entirely by the shared manifest, so the game,
# the server and this script can never disagree about which files exist.
# Node is already a prerequisite of the project, so it is used to read the JSON.
while IFS='|' read -r avatar_pack avatar_source avatar_id; do
  [[ -z "${avatar_id}" ]] && continue
  pack_key="$(avatar_pack_key "${avatar_pack}")"
  if [[ -z "${pack_key}" ]]; then
    err "Unknown sourcePack in avatars.json: ${avatar_pack}"
    exit 1
  fi
  COPY_PLAN+=("${pack_key}|${avatar_source}|avatars/${avatar_id}.png")
done < <(node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const a of manifest.items) {
  process.stdout.write(`${a.sourcePack}|${a.sourceFile}|${a.id}\n`);
}
' "${REPO_ROOT}/shared/content/avatars.json")

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
ok() { printf '\033[32m    OK  %s\033[0m\n' "$1"; }
warn() { printf '\033[33m    !!  %s\033[0m\n' "$1"; }
err() { printf '\033[31m%s\033[0m\n' "$1"; }

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required tool not found: $1"
    exit 1
  fi
}

require_tool unzip
if command -v curl >/dev/null 2>&1; then
  DOWNLOADER=curl
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER=wget
else
  err 'Neither curl nor wget is available.'
  exit 1
fi

mkdir -p "${CACHE_DIR}" \
  "${PUBLIC_ASSETS}/models/platformer/Textures" \
  "${PUBLIC_ASSETS}/audio/music" \
  "${PUBLIC_ASSETS}/audio/sfx" \
  "${PUBLIC_ASSETS}/audio/ui" \
  "${PUBLIC_ASSETS}/fonts/baloo2" \
  "${PUBLIC_ASSETS}/avatars" \
  "${PUBLIC_ASSETS}/licenses"

download() {
  local url="$1" out="$2"
  if [[ "${DOWNLOADER}" == "curl" ]]; then
    curl --fail --location --silent --show-error --retry 2 --output "${out}" "${url}"
  else
    wget --quiet --tries=3 --output-document="${out}" "${url}"
  fi
}

failed_packs=()

for pack in "${PACKS[@]}"; do
  IFS='|' read -r key name url page zip <<<"${pack}"
  zip_path="${CACHE_DIR}/${zip}"
  extract_dir="${CACHE_DIR}/${key}"

  if [[ -f "${zip_path}" && ${FORCE} -eq 0 ]]; then
    step "${name}: using cached archive"
  else
    step "${name}: downloading"
    if download "${url}" "${zip_path}.part"; then
      mv "${zip_path}.part" "${zip_path}"
      ok "downloaded ${zip}"
    else
      rm -f "${zip_path}.part"
      warn "download failed (HTTP error or network problem)"
      warn "Download manually from the stable source page: ${page}"
      warn "Then place the archive at: ${zip_path} and re-run this script."
      failed_packs+=("${name}")
      continue
    fi
  fi

  # Re-extract into a dedicated folder inside .cache so repeated runs are safe.
  rm -rf "${extract_dir}"
  mkdir -p "${extract_dir}"
  if unzip -qq -o "${zip_path}" -d "${extract_dir}"; then
    ok "extracted to .cache/game-assets/${key}"
  else
    warn "extract failed - the archive may be corrupt"
    warn "Delete ${zip_path} and re-run with --force."
    failed_packs+=("${name}")
  fi
done

step 'Downloading single files'

copied=()
missing=()

for entry in "${DIRECT_FILES[@]}"; do
  IFS='|' read -r name url page dest <<<"${entry}"
  dest_path="${PUBLIC_ASSETS}/${dest}"

  if [[ -f "${dest_path}" && ${FORCE} -eq 0 ]]; then
    ok "${name}: already present"
    copied+=("${dest}")
    continue
  fi

  mkdir -p "$(dirname "${dest_path}")"
  if download "${url}" "${dest_path}.part"; then
    mv "${dest_path}.part" "${dest_path}"
    ok "downloaded ${dest}"
    copied+=("${dest}")
  else
    rm -f "${dest_path}.part"
    warn "download failed for ${name}"
    warn "Download manually from: ${page}"
    warn "Then save it as: ${dest_path}"
    missing+=("${dest}")
  fi
done

step 'Copying whitelisted files into public/assets'

for entry in "${COPY_PLAN[@]}"; do
  IFS='|' read -r key match dest <<<"${entry}"
  extract_dir="${CACHE_DIR}/${key}"

  if [[ ! -d "${extract_dir}" ]]; then
    missing+=("${dest}")
    continue
  fi

  source_file="$(find "${extract_dir}" -type f -path "*${match}" -print -quit 2>/dev/null || true)"
  if [[ -z "${source_file}" ]]; then
    missing+=("${dest}  (not found in pack: ${match})")
    continue
  fi

  mkdir -p "$(dirname "${PUBLIC_ASSETS}/${dest}")"
  cp -f "${source_file}" "${PUBLIC_ASSETS}/${dest}"
  copied+=("${dest}")
done

echo
step 'Prepared files'
for file in "${copied[@]}"; do
  size_kb=$(( ( $(wc -c <"${PUBLIC_ASSETS}/${file}") + 1023 ) / 1024 ))
  printf '    %-52s %6s KB\n' "${file}" "${size_kb}"
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo
  err 'MISSING FILES:'
  for file in "${missing[@]}"; do
    err "    - ${file}"
  done
  echo
  printf '\033[33mStable source pages:\033[0m\n'
  for pack in "${PACKS[@]}"; do
    IFS='|' read -r _ name _ page _ <<<"${pack}"
    printf '\033[33m    %s: %s\033[0m\n' "${name}" "${page}"
  done
  exit 1
fi

if [[ ${#failed_packs[@]} -gt 0 ]]; then
  echo
  err "Some packs failed to download: ${failed_packs[*]}"
  exit 1
fi

echo
printf '\033[32mAll %d asset files are ready in public/assets/.\033[0m\n' "${#copied[@]}"
