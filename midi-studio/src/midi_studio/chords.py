"""Diatonic chord progression generation."""

from .theory import (
    CHORD_QUALITIES,
    DIATONIC_TRIADS,
    SCALES,
    note_name_to_midi,
    parse_roman_numeral,
)


def _default_parent_scale(scale_name):
    """Map a scale to the diatonic-triad table that best fits it."""
    if scale_name in DIATONIC_TRIADS:
        return scale_name
    if "minor" in scale_name:
        return "natural_minor"
    return "major"


def chord_for_degree(key, scale_name, degree, octave=4, quality=None):
    """Build a chord (list of MIDI notes) for a 1-indexed scale degree."""
    scale = SCALES[scale_name]
    root_midi = note_name_to_midi(key, octave)
    degree_index = (degree - 1) % len(scale)
    octave_shift = (degree - 1) // len(scale)
    chord_root = root_midi + scale[degree_index] + 12 * octave_shift

    if quality is None:
        parent = _default_parent_scale(scale_name)
        quality = DIATONIC_TRIADS[parent][degree_index % 7]

    intervals = CHORD_QUALITIES[quality]
    return [chord_root + i for i in intervals]


def build_progression(key, scale_name, progression, octave=4, beats_per_chord=4):
    """
    progression: list of roman numerals, e.g. ["I", "V", "vi", "IV"]
    Returns a list of (chord_notes, duration_beats) tuples.
    """
    events = []
    for token in progression:
        degree, quality, _is_minor_numeral = parse_roman_numeral(token)
        notes = chord_for_degree(key, scale_name, degree, octave, quality)
        events.append((notes, beats_per_chord))
    return events
