import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from midi_studio.chords import build_progression, chord_for_degree
from midi_studio.drums import generate_drums
from midi_studio.melody import generate_melody
from midi_studio.theory import note_name_to_midi, scale_notes


def test_note_name_to_midi():
    assert note_name_to_midi("C", 4) == 60
    assert note_name_to_midi("A", 4) == 69
    assert note_name_to_midi("Bb", 3) == 58


def test_scale_notes_major():
    notes = scale_notes("C", "major", octave=4, span=1)
    assert notes == [60, 62, 64, 65, 67, 69, 71]


def test_chord_for_degree_diatonic_qualities():
    # I in C major -> C major triad
    assert chord_for_degree("C", "major", 1, octave=4) == [60, 64, 67]
    # ii in C major -> D minor triad
    assert chord_for_degree("C", "major", 2, octave=4) == [62, 65, 69]
    # vii in C major -> B diminished triad
    assert chord_for_degree("C", "major", 7, octave=4) == [71, 74, 77]


def test_build_progression_length_and_duration():
    events = build_progression("C", "major", ["I", "V", "vi", "IV"], beats_per_chord=4)
    assert len(events) == 4
    for notes, duration in events:
        assert len(notes) == 3
        assert duration == 4


def test_generate_melody_stays_in_scale():
    scale = set(scale_notes("C", "major", octave=4, span=2))
    melody = generate_melody("C", "major", bars=4, notes_per_bar=4, octave=4, span=2, seed=42)
    assert len(melody) == 16
    for note, duration in melody:
        assert note in scale
        assert duration > 0


def test_generate_melody_is_deterministic_with_seed():
    a = generate_melody("C", "major", bars=2, notes_per_bar=4, seed=1)
    b = generate_melody("C", "major", bars=2, notes_per_bar=4, seed=1)
    assert a == b


def test_generate_drums_covers_all_bars():
    events = generate_drums("boombap", bars=2)
    assert all(0 <= start < 2 * 4 for _note, start, _dur in events)
    kicks = [e for e in events if e[0] == 36]
    assert len(kicks) == 2 * 3  # 3 kicks per bar in the boombap preset


def test_generate_drums_unknown_genre_raises():
    try:
        generate_drums("dubstep", bars=1)
        assert False, "expected ValueError"
    except ValueError:
        pass
