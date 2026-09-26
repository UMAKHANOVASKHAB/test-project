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

## Документы
- `docs/halal-code-konspekt.md`: конспект гайда по продаже сайтов, использовать для обучения по урокам.

## Правила общения
- Отвечать по-русски, без тире в обычной речи.
- Тексты для отправки давать обычным текстом, без блока кода.
