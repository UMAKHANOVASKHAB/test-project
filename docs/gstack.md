# gstack: установка

Источник: https://github.com/garrytan/gstack (MIT). Закреплённая версия: 1.91.108.0, коммит `b0f1e65e0d9c8a55c74adf3fff4b21126d6ec23c`.
Нужно: git, bun 1.3.3 или новее (проверено на 1.4.2). Установка занимает около 30 секунд и скачивает Chromium (~300 МБ).

## Облако (claude.ai/code)

Контейнер каждый раз создаётся заново, поэтому установку кладём в настройки окружения:
меню окружения в заголовке сессии → Edit → Setup script. Вставить:

```bash
GSTACK_COMMIT=b0f1e65e0d9c8a55c74adf3fff4b21126d6ec23c
DEST="$HOME/.claude/skills/gstack"
export PATH="$HOME/.bun/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
if [ ! -x "$DEST/bin/gstack-config" ]; then
  mkdir -p "$HOME/.claude/skills" && rm -rf "$DEST"
  git init -q "$DEST"
  git -C "$DEST" fetch -q --depth 1 https://github.com/garrytan/gstack.git "$GSTACK_COMMIT"
  git -C "$DEST" checkout -q FETCH_HEAD
  (cd "$DEST" && ./setup --prefix -q) || echo "gstack setup failed"
  "$DEST/bin/gstack-config" set telemetry off
fi
```

Скрипт не прерывает старт сессии при ошибке: если gstack не встал, сессия всё равно откроется, а Claude скажет, что команд `/gstack-*` нет.

## Свой компьютер (Mac или Linux)

Один раз в терминале:

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --prefix
~/.claude/skills/gstack/bin/gstack-config set telemetry off
```

Обновление: команда `/gstack-upgrade`. В облаке обновление делается сменой коммита в Setup script, после проверки новой версии.

## Проверка

`~/.claude/skills/gstack/bin/gstack-doctor`: должно быть `0 fail`. Пункты `codex` и `artifacts sync` в состоянии `not configured` нормальны: это необязательные дополнения (второе мнение от OpenAI Codex и синхронизация между компьютерами).

Известная мелочь версии 1.91.108.0: при установке с `--prefix` в `/gstack-review` не находится одна ссылка на раздел из `qa` (`setup --status` пишет 1 of 65 broken). На наш порядок работы не влияет, `/gstack-review` мы не используем.

## Движок Impeccable для /gstack-design-review

При первом запуске `/gstack-design-review` спросит, скачать ли движок Impeccable (один файл ~16 МБ с GitHub, сверяется по контрольной сумме). Отвечать «да»: тогда к ручной проверке добавятся 61 автоматическое правило.
