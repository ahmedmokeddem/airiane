"""Generate seamless nature sound loops (via ElevenLabs Sound Effects API)
and a mathematically exact 40 Hz amplitude-modulated pink-noise WAV loop.

Outputs to: mobile/assets/audio/
"""

from __future__ import annotations

import json
import math
import os
import random
import struct
import urllib.error
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "mobile" / "assets" / "audio"
ENV_PATH = ROOT / "backend" / ".env"


def load_elevenlabs_key() -> str | None:
    key = os.environ.get("RE_ELEVENLABS_API_KEY")
    if key:
        return key.strip()
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("RE_ELEVENLABS_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    return None


def generate_elevenlabs_loop(api_key: str, prompt: str, out_path: Path, duration: float = 15.0) -> bool:
    if out_path.exists() and out_path.stat().st_size > 10_000:
        print(f"[skip] {out_path.name} already exists ({out_path.stat().st_size} bytes)")
        return True

    url = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"
    payload = json.dumps(
        {
            "text": prompt,
            "duration_seconds": duration,
            "prompt_influence": 0.45,
            "loop": True,
            "model_id": "eleven_text_to_sound_v2",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        out_path.write_bytes(data)
        print(f"[ok] Generated {out_path.name} via ElevenLabs ({len(data)} bytes)")
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[err] ElevenLabs HTTP {e.code} for {out_path.name}: {body}")
        return False
    except Exception as e:
        print(f"[err] Failed to generate {out_path.name}: {e}")
        return False


def generate_40hz_pink_noise_wav(out_path: Path, duration_sec: float = 10.0, sample_rate: int = 44100) -> None:
    """Generate a seamless stereo 1/f pink-noise loop modulated at 40 Hz (25% depth)
    plus subtle 0.5 Hz bilateral stereo panning for autonomic grounding.
    """
    n_samples = int(duration_sec * sample_rate)
    # Voss-McCartney / Paul Kellet pink noise filter state
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
    rng = random.Random(42)

    raw_samples: list[float] = []
    for _ in range(n_samples):
        white = rng.uniform(-1.0, 1.0)
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
        b6 = white * 0.115926
        raw_samples.append(pink * 0.08)

    # Crossfade loop boundaries (first/last 0.5s) for seamless looping
    fade_len = int(0.5 * sample_rate)
    for i in range(fade_len):
        alpha = i / fade_len
        raw_samples[i] = raw_samples[i] * alpha + raw_samples[n_samples - fade_len + i] * (1.0 - alpha)

    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)

        frames = bytearray()
        for i, s in enumerate(raw_samples):
            t = i / sample_rate
            # 40 Hz subtle amplitude modulation (range 0.75 to 1.0)
            gamma_mod = 0.875 + 0.125 * math.sin(2.0 * math.pi * 40.0 * t)
            # Gentle 0.5 Hz bilateral stereo sway (L/R balance between 0.35 and 0.65)
            pan = 0.5 + 0.15 * math.sin(2.0 * math.pi * 0.5 * t)
            val = s * gamma_mod
            left = max(-1.0, min(1.0, val * math.sqrt(1.0 - pan)))
            right = max(-1.0, min(1.0, val * math.sqrt(pan)))
            frames.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))
        wf.writeframes(bytes(frames))

    print(f"[ok] Generated {out_path.name} ({out_path.stat().st_size} bytes)")


def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    generate_40hz_pink_noise_wav(AUDIO_DIR / "gamma_40hz_pink_noise.wav")

    api_key = load_elevenlabs_key()
    if not api_key:
        print("[warn] RE_ELEVENLABS_API_KEY not found; skipping ElevenLabs nature sound generation.")
        return

    tracks = [
        (
            "nordic_forest_birds.mp3",
            "Gentle Finnish pine forest with soft morning birdsong and light breeze through leaves, calm nature ambience",
        ),
        (
            "gentle_rain.mp3",
            "Soft continuous rainfall on pine needles and wooden cabin roof, calm soothing rain ambience",
        ),
        (
            "nordic_stream.mp3",
            "Peaceful woodland stream flowing gently over smooth stones with distant soft birds, relaxing nature",
        ),
    ]

    for filename, prompt in tracks:
        generate_elevenlabs_loop(api_key, prompt, AUDIO_DIR / filename)


if __name__ == "__main__":
    main()
