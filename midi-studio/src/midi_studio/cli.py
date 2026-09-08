"""CLI: generate a multi-track .mid file (chords + melody + drums) to import into FL Studio."""

import argparse

from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo

from .chords import chord_for_degree
from .drums import PATTERNS, generate_drums
from .melody import generate_melody
from .theory import SCALES, parse_roman_numeral

TICKS_PER_BEAT = 480


def beats_to_ticks(beats):
    return int(round(beats * TICKS_PER_BEAT))


def notes_to_track(note_events, channel, velocity=90):
    """
    note_events: list of (notes, start_beat, duration_beats), where `notes`
    is a single MIDI note number or a list of them (for a chord).
    Returns a MidiTrack with delta-time note on/off messages.
    """
    raw = []
    for notes, start_beat, duration_beats in note_events:
        note_list = notes if isinstance(notes, list) else [notes]
        start_tick = beats_to_ticks(start_beat)
        end_tick = beats_to_ticks(start_beat + duration_beats)
        for n in note_list:
            raw.append((start_tick, 1, n))   # note_on, sorts after note_off at same tick
            raw.append((end_tick, 0, n))      # note_off

    raw.sort(key=lambda e: (e[0], e[1]))

    track = MidiTrack()
    last_tick = 0
    for abs_tick, kind, note in raw:
        delta = abs_tick - last_tick
        last_tick = abs_tick
        if kind == 1:
            track.append(Message("note_on", note=note, velocity=velocity, time=delta, channel=channel))
        else:
            track.append(Message("note_off", note=note, velocity=0, time=delta, channel=channel))
    return track


def build_chord_events(key, scale, progression_tokens, octave, beats_per_chord, total_beats):
    events = []
    t = 0.0
    i = 0
    while t < total_beats - 1e-9:
        token = progression_tokens[i % len(progression_tokens)]
        degree, quality, _is_minor = parse_roman_numeral(token)
        notes = chord_for_degree(key, scale, degree, octave, quality)
        dur = min(beats_per_chord, total_beats - t)
        events.append((notes, t, dur))
        t += dur
        i += 1
    return events


def build_melody_events(key, scale, bars, notes_per_bar, octave, seed):
    mel = generate_melody(key, scale, bars, notes_per_bar, octave, seed=seed)
    events = []
    t = 0.0
    for note, dur in mel:
        events.append((note, t, dur))
        t += dur
    return events


def build_midi(args):
    mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    total_beats = args.bars * 4

    tempo_track = MidiTrack()
    tempo_track.append(MetaMessage("track_name", name="tempo", time=0))
    tempo_track.append(MetaMessage("set_tempo", tempo=bpm2tempo(args.tempo), time=0))
    mid.tracks.append(tempo_track)

    if not args.no_chords:
        progression_tokens = args.progression.split("-")
        chord_events = build_chord_events(
            args.key, args.scale, progression_tokens,
            args.chord_octave, args.beats_per_chord, total_beats,
        )
        track = notes_to_track(chord_events, channel=0)
        track.insert(0, MetaMessage("track_name", name="chords", time=0))
        mid.tracks.append(track)

    if not args.no_melody:
        mel_events = build_melody_events(
            args.key, args.scale, args.bars, args.notes_per_bar,
            args.melody_octave, args.seed,
        )
        track = notes_to_track(mel_events, channel=1)
        track.insert(0, MetaMessage("track_name", name="melody", time=0))
        mid.tracks.append(track)

    if args.drum_genre != "none":
        drum_events = generate_drums(args.drum_genre, args.bars)
        track = notes_to_track(drum_events, channel=9)
        track.insert(0, MetaMessage("track_name", name="drums", time=0))
        mid.tracks.append(track)

    mid.save(args.output)
    return args.output


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate a multi-track MIDI sketch (chords + melody + drums) to import into FL Studio.",
    )
    parser.add_argument("--key", default="C", help="Root note, e.g. C, F#, Bb (default: C)")
    parser.add_argument("--scale", default="major", choices=sorted(SCALES), help="Scale/mode (default: major)")
    parser.add_argument("--progression", default="I-V-vi-IV",
                         help="Roman-numeral chord progression, hyphen-separated (default: I-V-vi-IV). "
                              "Append 7/dim/aug/sus2/sus4 to override quality, e.g. V7-I.")
    parser.add_argument("--bars", type=int, default=8, help="Total bars to generate (default: 8)")
    parser.add_argument("--beats-per-chord", type=float, default=4.0, help="Beats each chord holds (default: 4)")
    parser.add_argument("--notes-per-bar", type=int, default=4, help="Melody notes per bar (default: 4)")
    parser.add_argument("--tempo", type=int, default=120, help="Tempo in BPM (default: 120)")
    parser.add_argument("--chord-octave", type=int, default=3, help="Octave for chords (default: 3)")
    parser.add_argument("--melody-octave", type=int, default=5, help="Octave for melody (default: 5)")
    parser.add_argument("--drum-genre", default="boombap", choices=sorted(PATTERNS) + ["none"],
                         help="Drum pattern preset, or 'none' to skip drums (default: boombap)")
    parser.add_argument("--no-chords", action="store_true", help="Skip the chord track")
    parser.add_argument("--no-melody", action="store_true", help="Skip the melody track")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for the melody (default: random)")
    parser.add_argument("-o", "--output", default="output.mid", help="Output .mid file path (default: output.mid)")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    path = build_midi(args)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
