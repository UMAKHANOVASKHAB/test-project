#!/usr/bin/env python3
"""Защита от удалений (мод из видео про Claude Code 2.0).

Хук PreToolUse для Bash: блокирует рекурсивное rm вне временных и
пересобираемых папок, git clean -f, git reset --hard, git push --force,
find -delete и стирание дисков. Остальные команды пропускает.
"""
import json
import re
import shlex
import sys

DISPOSABLE = re.compile(
    r"^(/tmp/|\$TMPDIR|/var/tmp/|(.*/)?(node_modules|dist|build|\.cache|__pycache__|\.next|coverage)/?$)"
)
RULES = [
    (r"\bgit\s+clean\b[^|;&]*-[a-zA-Z]*f", "git clean -f стирает неотслеживаемые файлы безвозвратно"),
    (r"\bgit\s+reset\b[^|;&]*--hard", "git reset --hard стирает незакоммиченную работу"),
    (r"\bgit\s+push\b[^|;&]*(--force\b|--force-with-lease\b|\s-f\b)", "git push --force переписывает историю на GitHub"),
    (r"\bfind\b[^|;&]*-delete\b", "find -delete удаляет пачкой"),
    (r"\bshred\b|\bmkfs\b|\bdd\s+[^|;&]*of=/dev/", "необратимое стирание диска или файла"),
]


def risky_rm_targets(command):
    risky = []
    for part in re.split(r"&&|\|\||;|\|", command):
        try:
            words = shlex.split(part)
        except ValueError:
            words = part.split()
        at = next((i for i, w in enumerate(words) if w == "rm" or w.endswith("/rm")), -1)
        if at == -1:
            continue
        args = words[at + 1:]
        if not any(re.match(r"^-[a-zA-Z]*[rR]", a) or a == "--recursive" for a in args):
            continue
        risky += [a for a in args if not a.startswith("-") and not DISPOSABLE.match(a)]
    return risky


def check(command):
    risky = risky_rm_targets(command)
    if risky:
        return f"рекурсивное удаление {', '.join(risky)} заблокировано"
    for pattern, why in RULES:
        if re.search(pattern, command):
            return f"заблокировано: {why}"
    return None


def main():
    data = json.load(sys.stdin)
    reason = check(data.get("tool_input", {}).get("command", ""))
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"delete-guard: {reason}. Спроси пользователя.",
        }}, ensure_ascii=False))


if __name__ == "__main__":
    main()
