"""Genre-preset drum patterns on a 16-step grid (one bar = 16 sixteenth notes)."""

# General MIDI drum map (channel 10) note numbers.
KICK = 36
SNARE = 38
CLAP = 39
CLOSED_HAT = 42
OPEN_HAT = 46

# Each pattern maps a drum note -> list of 16 steps (1 = hit, 0 = rest).
PATTERNS = {
    "boombap": {
        KICK:       [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        SNARE:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        CLOSED_HAT: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    "trap": {
        KICK:       [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        SNARE:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        CLOSED_HAT: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        OPEN_HAT:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    },
    "house": {
        KICK:       [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        CLAP:       [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        CLOSED_HAT: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        OPEN_HAT:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    },
    "rock": {
        KICK:       [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        SNARE:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        CLOSED_HAT: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
}


def generate_drums(genre, bars=4):
    """
    Returns a list of (midi_note, start_beat, duration_beats) tuples covering
    `bars` bars of the named genre pattern (each bar = 4 beats / 16 steps).
    """
    if genre not in PATTERNS:
        raise ValueError(f"Unknown drum genre: {genre}. Options: {list(PATTERNS)}")

    step_beats = 4 / 16
    events = []
    for bar in range(bars):
        bar_start = bar * 4
        for note, steps in PATTERNS[genre].items():
            for i, hit in enumerate(steps):
                if hit:
                    events.append((note, bar_start + i * step_beats, step_beats))
    events.sort(key=lambda e: e[1])
    return events
