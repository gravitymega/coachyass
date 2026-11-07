"""Scale-constrained melody generation via a weighted random walk."""

import random

from .theory import scale_notes

# Step-size weights, in scale-degree steps (not semitones). Favors small,
# singable movement with occasional leaps for interest.
STEP_WEIGHTS = {
    -3: 1, -2: 3, -1: 5, 0: 2, 1: 5, 2: 3, 3: 1,
}


def generate_melody(key, scale_name, bars=4, notes_per_bar=4, octave=4,
                     span=2, seed=None):
    """
    Returns a list of (midi_note, duration_beats) tuples, `bars * notes_per_bar`
    long, walking within `span` octaves of `scale_name` starting on the tonic.
    """
    rng = random.Random(seed)
    notes = scale_notes(key, scale_name, octave, span)
    beats_per_note = 4 / notes_per_bar

    position = 0  # index into `notes`, starts on the tonic
    melody = []
    total_notes = bars * notes_per_bar
    for _ in range(total_notes):
        midi_note = notes[position]
        melody.append((midi_note, beats_per_note))

        steps = list(STEP_WEIGHTS.keys())
        weights = list(STEP_WEIGHTS.values())
        step = rng.choices(steps, weights=weights, k=1)[0]
        position = max(0, min(len(notes) - 1, position + step))

    return melody
