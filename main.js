var audioCtx;
var timers = [];
var stopped = false;

// each track has its own oscillator and gain node
var tracks = [
    { osc: null, timings: null, inputId: 'code1' },
    { osc: null, timings: null, inputId: 'code2' },
];

var liveCodeState = [[], []]; // one state array per track

const playButton = document.querySelector('#playBtn');
const stopButton = document.querySelector('#stopBtn');

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    tracks.forEach((track, i) => {
        track.osc = audioCtx.createOscillator();
        track.timings = audioCtx.createGain();
        track.timings.gain.value = 0;
        track.osc.type = document.getElementById('oscType').value;
        track.osc.connect(track.timings).connect(audioCtx.destination);
        track.osc.start();
    });
}

function scheduleAudio(trackIndex) {
    if (stopped) return; // don't reschedule if stopped

    const track = tracks[trackIndex];
    let timeElapsedSecs = 0;

    liveCodeState[trackIndex].forEach(noteData => {
        track.timings.gain.setTargetAtTime(1, audioCtx.currentTime + timeElapsedSecs, 0.01);
        track.osc.frequency.setTargetAtTime(noteData["pitch"], audioCtx.currentTime + timeElapsedSecs, 0.01);
        timeElapsedSecs += noteData["length"] / 10.0;
        track.timings.gain.setTargetAtTime(0, audioCtx.currentTime + timeElapsedSecs, 0.01);
        timeElapsedSecs += 0.2; // rest between notes
    });

    // if track is empty, check again in 100ms (waiting for user to type something)
    const delay = timeElapsedSecs > 0 ? timeElapsedSecs * 1000 : 100;
    const timerId = setTimeout(() => scheduleAudio(trackIndex), delay);
    timers.push(timerId);
}

function parseCode(code) {
    if (!code.trim()) return []; // empty track = silence, totally fine

    // new: repeat syntax e.g. 2[1@220 2@330] repeats the block 2 times
    code = expandRepeats(code);

    let notes = code.split(" ").filter(n => n.trim() !== '');
    notes = notes.map(note => {
        let noteData = note.split("@");
        return {
            "length": eval(noteData[0]),
            "pitch": eval(noteData[1])
        };
    });
    return notes;
}

// new: expand repeat blocks like 2[1@220 2@330] before parsing
function expandRepeats(code) {
    while (/\d+\[/.test(code)) {
        code = code.replace(/(\d+)\[([^\[\]]*)\]/g, (match, count, block) => {
            let repeated = '';
            for (let i = 0; i < parseInt(count); i++) {
                repeated += block.trim() + ' ';
            }
            return repeated.trim();
        });
    }
    return code;
}

function reevaluate() {
    stopped = false; // un-stop so scheduleAudio loops again

    tracks.forEach((track, i) => {
        const code = document.getElementById(track.inputId).value;
        liveCodeState[i] = parseCode(code);
        if (track.osc) {
            track.osc.type = document.getElementById('oscType').value;
        }
    });

    // if audio was stopped, restart the schedule loops
    timers.forEach(id => clearTimeout(id));
    timers = [];
    tracks.forEach((_, i) => scheduleAudio(i));
}

// new stop button stops playback but keeps context alive so re-evaluate works
function stopAudio() {
    stopped = true;
    timers.forEach(id => clearTimeout(id));
    timers = [];
    if (audioCtx) {
        tracks.forEach(track => {
            if (track.timings) {
                track.timings.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
            }
        });
    }
}

playButton.addEventListener('click', function () {
    if (!audioCtx) {
        initAudio();
    }
    reevaluate();
});

stopButton.addEventListener('click', function () {
    stopAudio();
});