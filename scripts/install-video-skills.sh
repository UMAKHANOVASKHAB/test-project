#!/usr/bin/env bash
# Ставит 5 навыков монтажа из видео «чтобы Claude монтировал» в ~/.claude/skills/.
# Версии закреплены по коммитам. Повторный запуск ничего не ломает.
# Облачная сессия Claude Code каждый раз чистая, поэтому скрипт запускают
# в начале работы с видео: bash scripts/install-video-skills.sh
set -euo pipefail

SKILLS="$HOME/.claude/skills"
mkdir -p "$SKILLS"

# имя папки | репозиторий | коммит
REPOS=(
  "ghost-editor|kurbaitaev/ghost-editor|ce17272"
  "ffmpeg-skill|kajisho5/ffmpeg-skill|f90f639"
  "shorts|AgriciDaniel/claude-shorts|a369fad"
)

fetch() { # dir repo commit
  local dir=$1 repo=$2 rev=$3
  if [ -d "$dir/.git" ]; then echo "есть: $dir"; return; fi
  git clone -q --filter=blob:none "https://github.com/$repo.git" "$dir"
  git -C "$dir" checkout -q "$rev"
  echo "поставлен: $dir ($repo @ $rev)"
}

for entry in "${REPOS[@]}"; do
  IFS='|' read -r name repo rev <<<"$entry"
  fetch "$SKILLS/$name" "$repo" "$rev"
done

# HyperFrames (HeyGen): монорепозиторий на 400 МБ, берём только папку skills/.
HF="$HOME/.cache/hyperframes-src"
if [ ! -d "$HF/.git" ]; then
  git clone -q --filter=blob:none --sparse https://github.com/heygen-com/hyperframes.git "$HF"
  git -C "$HF" sparse-checkout set skills
  git -C "$HF" checkout -q 5259097
fi
for s in "$HF"/skills/*/; do
  n=$(basename "$s")
  [ -e "$SKILLS/$n" ] || ln -s "$s" "$SKILLS/$n"
done
echo "поставлен: hyperframes (навыки: $(ls -d "$HF"/skills/*/ | xargs -n1 basename | tr '\n' ' '))"

# OpenMontage: это не навык, а целый проект (AGPL-3.0) со своими навыками в .claude/.
# Работать с ним нужно, открыв его папку как проект.
fetch "$HOME/OpenMontage" calesthio/OpenMontage 195eab2

echo
echo "Готово. Зависимости (whisper, node-пакеты, Python-пакеты) ставятся при первой задаче:"
echo "  ghost-editor: bash ~/.claude/skills/ghost-editor/scripts/doctor.sh"
echo "  shorts:       см. ~/.claude/skills/shorts/README.md"
