# test-project

Учебный проект: Claude Code, разработка мини-аппов и сайтов.

## Установленные навыки

### Agent Skills (Addy Osmani, MIT)
25 инженерных навыков в `.claude/skills/`, справочники в `.claude/references/`, агенты-ревьюеры в `.claude/agents/`.
Команды: `/spec`, `/planning`, `/build`, `/test`, `/review`, `/code-simplify`, `/ship`, `/constraints`, `/webperf`.

В начале любой задачи по коду сначала применяй навык `using-agent-skills`, чтобы выбрать подходящий рабочий процесс по фазе: Define → Plan → Build → Verify → Review → Ship.

### Graphify
Навык `/graphify` в `.claude/skills/graphify/`. Строит граф знаний по коду, чтобы не перечитывать файлы.
Требует пакет: `pip install graphifyy`. Когда в проекте появится код, запусти `/graphify .`, потом задавай вопросы по коду через `graphify query "<вопрос>"`. После изменений: `graphify update .`.

## Текущий проект: мини-апп 9 bar coffee (запущен)
Перед любой работой прочитай `docs/runbook.md`: там где что лежит, переменные Railway и что делать при сбоях.
- Бот @ninebar_coffee_05bot, сервер Railway (сервис ninebar-coffee), адрес https://ninebar-coffee-production-4d6a.up.railway.app
- Код: `apps/web` (мини-апп), `apps/api` (сервер и бот). Push в main сам деплоит на Railway.
- Пользователь работает с телефона: к Railway и Telegram у Claude доступа нет, пользователь нажимает сам по пошаговым инструкциям и присылает скрины.
- Не сделано: постоянный диск (Volume /data), админка меню, онлайн-оплата, выход из Railway Trial.

## Документы
- `docs/runbook.md`: памятка по боту 9 bar coffee и починке.
- `docs/halal-code-konspekt.md`: конспект гайда по продаже сайтов, использовать для обучения по урокам.

## Правила общения
- Отвечать по-русски, без тире в обычной речи.
- Тексты для отправки давать обычным текстом, без блока кода.
