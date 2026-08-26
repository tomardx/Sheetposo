"""Generates assets/legendary.wav: the sound for the two rarest tiers.

An ascending arpeggio that rings into itself, so it reads as an event rather
than an alert. Deliberately kept near the length of bleep.wav: a notification
sound that outstays its welcome gets the whole app muted.

Regenerate with: python3 tools/make_legendary.py
"""
import math
import struct
import wave

SAMPLE_RATE = 44100
AMPLITUDE = 0.5

# (start seconds, frequency Hz, ring-out seconds, gain)
NOTES = [
    (0.000, 1046.50, 0.30, 0.85),   # C6
    (0.055, 1318.51, 0.30, 0.85),   # E6
    (0.110, 1567.98, 0.30, 0.90),   # G6
    (0.165, 2093.00, 0.22, 1.00),   # C7, the payoff
]
TOTAL = 0.385


def envelope(position, length):
    """Near-instant attack, exponential ring-out, silent at the tail."""
    attack = 0.003 * SAMPLE_RATE
    if position < attack:
        return position / attack
    decayed = (position - attack) / max(1.0, length - attack)
    return math.exp(-4.2 * decayed) * max(0.0, 1.0 - decayed)


def main():
    total_frames = int(TOTAL * SAMPLE_RATE)
    mix = [0.0] * total_frames

    for start, freq, ring, gain in NOTES:
        offset = int(start * SAMPLE_RATE)
        length = int(ring * SAMPLE_RATE)
        for i in range(length):
            index = offset + i
            if index >= total_frames:
                break
            env = envelope(i, length) * gain
            phase = 2.0 * math.pi * freq * (i / SAMPLE_RATE)
            # A touch of the octave above gives it a bell edge.
            sample = math.sin(phase) + 0.22 * math.sin(2.0 * phase)
            mix[index] += sample * env

    peak = max(abs(value) for value in mix) or 1.0
    frames = bytearray()
    for value in mix:
        scaled = (value / peak) * AMPLITUDE
        frames += struct.pack("<h", int(max(-1.0, min(1.0, scaled)) * 32767))

    with wave.open("assets/legendary.wav", "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(bytes(frames))


if __name__ == "__main__":
    main()
