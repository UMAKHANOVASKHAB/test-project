"""Разбор видео или голосового: расшифровка речи и кадры экрана.

Запуск: python3 -I razbor.py <файл> <папка_результата> [--lang ru] [--model medium] [--step 20]
Результат: transcript.txt (с метками времени), frames/fNNN.jpg, grid*.jpg (по 6 кадров на лист).
Звук читается через ffmpeg, а не через av: faster-whisper 1.2.1 с av 19 падает на metadata_errors.
"""
import argparse, glob, os, subprocess
import numpy as np

p = argparse.ArgumentParser()
p.add_argument("src"); p.add_argument("out")
p.add_argument("--lang", default="ru")
p.add_argument("--model", default="medium")
p.add_argument("--step", type=int, default=20, help="кадр каждые N секунд")
a = p.parse_args()
os.makedirs(os.path.join(a.out, "frames"), exist_ok=True)

# Кадры: по ним видно, что показывают на экране
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-vf", f"fps=1/{a.step},scale=1280:-1",
                os.path.join(a.out, "frames", "f%03d.jpg")], check=False)
try:
    from PIL import Image
    fs = sorted(glob.glob(os.path.join(a.out, "frames", "f*.jpg")))
    for k in range(0, len(fs), 6):
        sheet = Image.new("RGB", (2560, 2160), "white")
        for i, f in enumerate(fs[k:k + 6]):
            sheet.paste(Image.open(f).resize((1280, 720)), ((i % 2) * 1280, (i // 2) * 720))
        sheet.save(os.path.join(a.out, f"grid{k // 6}.jpg"), quality=80)
except ImportError:
    pass

# Звук: 16 кГц моно float32 прямо из ffmpeg
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.src, "-vn", "-ac", "1", "-ar", "16000",
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.float32)
if audio.size == 0:
    print("в файле нет звука, только кадры"); raise SystemExit

from faster_whisper import WhisperModel
model = WhisperModel(a.model, device="cpu", compute_type="int8")
segs, _ = model.transcribe(audio, language=None if a.lang == "auto" else a.lang,
                           vad_filter=True, beam_size=1)
with open(os.path.join(a.out, "transcript.txt"), "w") as f:
    for s in segs:
        f.write(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {s.text.strip()}\n")
        f.flush()
print("готово:", a.out)
