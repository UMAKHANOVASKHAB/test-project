"""Расшифровка wav (16 кГц, моно) через faster-whisper с метками времени.

Запуск: python3 -I transcribe.py <audio.wav> <out.txt> [модель]
Аудио читается через wave+numpy, потому что встроенный декодер faster-whisper
падает на несовместимой версии av (ошибка metadata_errors).
"""
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel

model_name = sys.argv[3] if len(sys.argv) > 3 else "small"
w = wave.open(sys.argv[1])
audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768

model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, _ = model.transcribe(audio, language="ru", vad_filter=True)
with open(sys.argv[2], "w") as f:
    for s in segments:
        f.write(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {s.text.strip()}\n")
        f.flush()
