"""Music theory primitives: notes, scales, diatonic chords."""

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Interval patterns (semitones from root) for common scales/modes.
SCALES = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "natural_minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "pentatonic_major": [0, 2, 4, 7, 9],
    "pentatonic_minor": [0, 3, 5, 7, 10],
    "blues": [0, 3, 5, 6, 7, 10],
}

# Explicit chord qualities as semitone intervals from the chord root.
CHORD_QUALITIES = {
    "maj": [0, 4, 7],
    "min": [0, 3, 7],
    "dim": [0, 3, 6],
    "aug": [0, 4, 8],
    "maj7": [0, 4, 7, 11],
    "min7": [0, 3, 7, 10],
    "dom7": [0, 4, 7, 10],
    "dim7": [0, 3, 6, 9],
    "sus2": [0, 2, 7],
    "sus4": [0, 5, 7],
}

# Diatonic triad quality per scale degree (1-indexed) for the two most common
# parent scales. Used when a roman numeral doesn't specify a quality.
DIATONIC_TRIADS = {
    "major": ["maj", "min", "min", "maj", "maj", "min", "dim"],
    "natural_minor": ["min", "dim", "maj", "min", "min", "maj", "maj"],
}

ROMAN_TO_DEGREE = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7,
}


def note_name_to_midi(name, octave=4):
    """'C', 'F#', 'Bb' + octave -> MIDI note number (C4 = 60)."""
    name = name.strip()
    flats_to_sharps = {
        "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#",
    }
    name = flats_to_sharps.get(name, name)
    if name not in NOTE_NAMES:
        raise ValueError(f"Unknown note name: {name}")
    return NOTE_NAMES.index(name) + (octave + 1) * 12


def scale_notes(key, scale_name, octave=4, span=1):
    """Return MIDI note numbers for `key` `scale_name` across `span` octaves."""
    if scale_name not in SCALES:
        raise ValueError(f"Unknown scale: {scale_name}")
    root = note_name_to_midi(key, octave)
    intervals = SCALES[scale_name]
    notes = []
    for o in range(span):
        notes.extend(root + i + 12 * o for i in intervals)
    return notes


def parse_roman_numeral(token):
    """'V7' -> (degree=5, quality='dom7' or None to use diatonic default)."""
    token = token.strip()
    lower = token.lower()
    quality = None
    base = lower
    for suffix, q in (("7", "7"), ("dim", "dim"), ("aug", "aug"),
                      ("sus2", "sus2"), ("sus4", "sus4")):
        if lower.endswith(suffix):
            base = lower[: -len(suffix)]
            quality = q
            break
    if base not in ROMAN_TO_DEGREE:
        raise ValueError(f"Unknown roman numeral: {token}")
    degree = ROMAN_TO_DEGREE[base]
    is_minor_numeral = token[: len(base)].islower()
    return degree, quality, is_minor_numeral
