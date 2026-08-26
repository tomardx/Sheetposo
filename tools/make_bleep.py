"""Generates assets/bleep.wav: the Sheetposo notification sound.

Two short ascending blips (~190ms total), quick and distinct enough to be
recognisable, short enough not to be annoying several times a day. Regenerate
with: python3 tools/make_bleep.py
"""
import math
import struct
import wave

SAMPLE_RATE = 44100
AMPLITUDE = 0.55
# (frequency Hz, duration s): a rest is frequency 0.
SEGMENTS = [(1244.5, 0.065), (0.0, 0.030), (1864.7, 0.090)]


def envelope(i, total):
    """Fast attack, smooth decay, so the blip has no click at either end."""
    attack = int(0.004 * SAMPLE_RATE)
    if i < attack:
        return i / attack
    decayed = (i - attack) / max(1, total - attack)
    return math.exp(-4.0 * decayed) * (1.0 - decayed) ** 0.5


def main():
    frames = bytearray()
    for freq, duration in SEGMENTS:
        count = int(duration * SAMPLE_RATE)
        for i in range(count):
            if freq == 0.0:
                sample = 0.0
            else:
                phase = 2.0 * math.pi * freq * (i / SAMPLE_RATE)
                sample = math.sin(phase) * envelope(i, count) * AMPLITUDE
            frames += struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 32767))

    with wave.open("assets/bleep.wav", "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(bytes(frames))


if __name__ == "__main__":
    main()
