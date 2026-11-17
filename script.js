
/* =========================================================
   IVY PIANO TRAINER
   Version 1.0 Prototype
   ========================================================= */

// Get HTML elements by ID
const $ = (id) => document.getElementById(id);

/* =========================================================
   1. IMAGE AND PDF VARIABLES
   ========================================================= */

let original = null;
let base = null;
let pdf = null;
let selection = null;
let start = null;
let rotation = 0;

const cv = $("preview");
const ctx = cv.getContext("2d");

/* =========================================================
   2. IMAGE PROCESSING
   ========================================================= */

// Create a copy of a canvas
function clone(canvas) {
    const copy = document.createElement("canvas");

    copy.width = canvas.width;
    copy.height = canvas.height;

    copy.getContext("2d").drawImage(canvas, 0, 0);

    return copy;
}

// Render image with rotation and contrast
function render() {
    if (!base) return;

    cv.hidden = false;

    cv.width = rotation % 180
        ? base.height
        : base.width;

    cv.height = rotation % 180
        ? base.width
        : base.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, cv.width, cv.height);

    ctx.save();

    ctx.translate(cv.width / 2, cv.height / 2);

    ctx.rotate(rotation * Math.PI / 180);

    ctx.filter = `contrast(${$("contrast").value}%)`;

    ctx.drawImage(
        base,
        -base.width / 2,
        -base.height / 2
    );

    ctx.restore();

    // Draw crop selection
    if (selection) {
        ctx.strokeStyle = "#168052";
        ctx.lineWidth = 3;
        ctx.strokeRect(...selection);
    }
}

// Set a new image
function setImage(canvas) {
    original = clone(canvas);
    base = clone(canvas);

    rotation = 0;
    selection = null;

    $("contrast").value = 100;

    render();
}

/* =========================================================
   3. PDF PROCESSING
   ========================================================= */

async function pdfPage() {
    if (!pdf) return;

    const pageNumber = Math.max(
        1,
        Math.min(
            pdf.numPages,
            Number($("page").value) || 1
        )
    );

    $("page").value = pageNumber;

    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({
        scale: 2
    });

    const canvas = document.createElement("canvas");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: viewport,
        background: "white"
    }).promise;

    setImage(canvas);

    $("imageStatus").textContent =
        `PDF has ${pdf.numPages} pages. ` +
        `Showing page ${pageNumber}. Drag to crop.`;
}

/* =========================================================
   4. FILE UPLOAD
   ========================================================= */

$("file").onchange = async () => {
    try {
        const file = $("file").files[0];

        if (!file) return;

        pdf = null;

        $("imageStatus").textContent =
            "Loading file...";

        // PDF upload
        if (file.name.toLowerCase().endsWith(".pdf")) {

            const pdfjs = await import(
                "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs"
            );

            pdfjs.GlobalWorkerOptions.workerSrc =
                "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

            pdf = await pdfjs.getDocument({
                data: await file.arrayBuffer(),
                isEvalSupported: false
            }).promise;

            $("page").value = 1;
            $("page").max = pdf.numPages;

            await pdfPage();

        } else {

            // Image upload
            const image = await createImageBitmap(file);

            const canvas =
                document.createElement("canvas");

            // Limit very large images
            const scale = Math.min(
                1,
                Math.sqrt(
                    12000000 /
                    (image.width * image.height)
                )
            );

            canvas.width = Math.max(
                1,
                Math.round(image.width * scale)
            );

            canvas.height = Math.max(
                1,
                Math.round(image.height * scale)
            );

            const context = canvas.getContext("2d");

            context.fillStyle = "white";

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            context.drawImage(
                image,
                0,
                0,
                canvas.width,
                canvas.height
            );

            image.close();

            setImage(canvas);

            $("imageStatus").textContent =
                "Image loaded. Drag across the image to crop.";
        }

    } catch (error) {
        console.error(error);

        $("imageStatus").textContent =
            "Error loading file: " + error.message;
    }
};

// Load selected PDF page
$("loadPage").onclick = () => {
    pdfPage().catch((error) => {
        $("imageStatus").textContent = error.message;
    });
};

/* =========================================================
   5. CONTRAST, ROTATION AND RESET
   ========================================================= */

$("contrast").oninput = render;

$("rotate").onclick = () => {
    if (!base) return;

    rotation = (rotation + 90) % 360;

    selection = null;

    render();
};

$("reset").onclick = () => {
    if (original) {
        setImage(original);
    }
};

/* =========================================================
   6. CROP SELECTION
   ========================================================= */

function point(event) {
    const rect = cv.getBoundingClientRect();

    const x =
        (event.clientX - rect.left) *
        cv.width / rect.width;

    const y =
        (event.clientY - rect.top) *
        cv.height / rect.height;

    return [
        Math.max(0, Math.min(cv.width, x)),
        Math.max(0, Math.min(cv.height, y))
    ];
}

cv.onpointerdown = (event) => {
    if (!base) return;

    start = point(event);

    cv.setPointerCapture(event.pointerId);
};

cv.onpointermove = (event) => {
    if (!start) return;

    const [x, y] = point(event);

    selection = [
        Math.min(x, start[0]),
        Math.min(y, start[1]),
        Math.abs(x - start[0]),
        Math.abs(y - start[1])
    ];

    render();
};

cv.onpointerup = () => {
    start = null;
};

cv.onpointercancel = () => {
    start = null;
};

// Apply selected crop
$("crop").onclick = () => {

    if (
        !selection ||
        selection[2] < 2 ||
        selection[3] < 2
    ) {
        $("imageStatus").textContent =
            "Select an area before cropping.";

        return;
    }

    const region = selection;

    selection = null;

    const contrast = $("contrast").value;

    // Avoid applying contrast twice
    $("contrast").value = 100;

    render();

    const canvas = document.createElement("canvas");

    canvas.width = Math.round(region[2]);
    canvas.height = Math.round(region[3]);

    canvas.getContext("2d").drawImage(
        cv,
        ...region,
        0,
        0,
        canvas.width,
        canvas.height
    );

    base = canvas;

    rotation = 0;

    $("contrast").value = contrast;

    render();

    $("imageStatus").textContent =
        "Image cropped successfully.";
};

/* =========================================================
   7. DOWNLOAD PREPARED IMAGE
   ========================================================= */

$("saveImage").onclick = () => {
    if (!base) return;

    const savedSelection = selection;

    selection = null;

    render();

    const link = document.createElement("a");

    link.download = "prepared-score.png";
    link.href = cv.toDataURL("image/png");

    link.click();

    selection = savedSelection;

    render();
};

/* =========================================================
   8. MUSICAL NOTES AND MIDI NUMBERS
   ========================================================= */

const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
];

// Convert a note such as C4 into a MIDI number
function midi(note) {

    const match =
        /^([A-G])([#b]?)(-?\d+)$/.exec(note);

    if (!match) return NaN;

    const letter = match[1];
    const accidental = match[2];
    const octave = Number(match[3]);

    let adjustment = 0;

    if (accidental === "#") adjustment = 1;
    if (accidental === "b") adjustment = -1;

    return (
        (octave + 1) * 12 +
        names.indexOf(letter) +
        adjustment
    );
}

// Convert MIDI number into a note name
function name(number) {
    return (
        names[number % 12] +
        (Math.floor(number / 12) - 1)
    );
}

/* =========================================================
   9. CREATE THE 88-KEY PIANO
   ========================================================= */

const map = new Map();
const whites = [];

$("keys").replaceChildren();

// Standard piano range: A0 to C8
for (let number = 21; number <= 108; number++) {

    if (!name(number).includes("#")) {
        whites.push(number);
    }
}

// Create white piano keys
for (const number of whites) {

    const key = document.createElement("div");

    key.className = "white";

    key.textContent = name(number);

    $("keys").append(key);

    map.set(number, key);
}

// Create black piano keys
for (let number = 21; number <= 108; number++) {

    if (!name(number).includes("#")) continue;

    const key = document.createElement("div");

    key.className = "black";

    key.style.width =
        `${100 / 52 * 0.62}%`;

    key.style.left =
        `${(
            whites.indexOf(number - 1) +
            1 - 0.31
        ) * 100 / 52}%`;

    key.textContent = name(number);

    $("keys").append(key);

    map.set(number, key);
}

/* =========================================================
   10. PLAYBACK VARIABLES
   ========================================================= */

let events = [];
let index = 0;
let timer = null;
let running = false;
let remaining = 0;
let last = 0;
let countdown = 0;
let playbackStarted = false;

// Stop the playback interval
function stop() {

    running = false;

    clearInterval(timer);

    timer = null;
}

// Remove all active piano key colors
function clearKeys() {

    for (const key of map.values()) {

        key.classList.remove(
            "lh",
            "rh",
            "both"
        );
    }
}

/* =========================================================
   11. DISPLAY NOTES AND HIGHLIGHT PIANO KEYS
   ========================================================= */

function show() {

    const event = events[index];

    clearKeys();

    const timelineItems =
        [...$("timeline").children];

    for (const [position, element]
        of timelineItems.entries()) {

        element.classList.toggle(
            "active",
            position === index
        );
    }

    if (!event) return;

    const selectedHand = $("hand").value;

    const left =
        selectedHand === "right"
            ? []
            : event.l;

    const right =
        selectedHand === "left"
            ? []
            : event.r;

    // Highlight left hand notes
    for (const note of left) {

        const key = map.get(midi(note));

        if (key) key.classList.add("lh");
    }

    // Highlight right hand notes
    for (const note of right) {

        const key = map.get(midi(note));

        if (!key) continue;

        if (key.classList.contains("lh")) {

            key.classList.remove("lh");

            key.classList.add("both");

        } else {

            key.classList.add("rh");
        }
    }

    $("now").textContent =
        `Left: ${left.join(" ") || "—"}     ` +
        `Right: ${right.join(" ") || "—"}`;

    // Scroll the current note into view
    const activeItem =
        $("timeline").children[index];

    if (activeItem) {

        activeItem.scrollIntoView({
            block: "nearest",
            inline: "center"
        });
    }
}

/* =========================================================
   12. CREATE THE NOTE TIMELINE
   ========================================================= */

function createTimeline() {

    $("timeline").replaceChildren();

    for (const [position, event]
        of events.entries()) {

        const card = document.createElement("div");

        card.className = "event";

        const left = document.createElement("div");

        left.className = "left";

        left.textContent =
            event.l.join(" ") || "—";

        const right = document.createElement("div");

        right.className = "right";

        right.textContent =
            event.r.join(" ") || "—";

        const duration =
            document.createElement("div");

        duration.className = "muted";

        duration.textContent =
            event.b + " beats";

        card.append(left, right, duration);

        // Click a note to practice from that position
        card.style.cursor = "pointer";

        card.onclick = () => {

            stop();

            index = position;

            remaining = events[index].b;

            countdown = 0;

            playbackStarted = false;

            show();
        };

        $("timeline").append(card);
    }
}

/* =========================================================
   13. LOAD MANUALLY ENTERED NOTES
   Format: beats | left hand | right hand
   ========================================================= */

function load() {

    try {

        const lines = $("notes").value
            .trim()
            .split(/\n/)
            .filter(line => line.trim());

        const next = lines.map(line => {

            const [beats, left, right, ...extra] =
                line.split("|");

            if (
                left === undefined ||
                right === undefined ||
                extra.length ||
                !Number.isFinite(Number(beats)) ||
                !(Number(beats) > 0)
            ) {

                throw new Error(
                    "Invalid line: " + line
                );
            }

            function parseNotes(text) {

                return text
                    .trim()
                    .split(/\s+/)
                    .filter(note =>
                        note !== "-" && note !== ""
                    );
            }

            const event = {
                b: Number(beats),
                l: parseNotes(left),
                r: parseNotes(right)
            };

            const allNotes = [
                ...event.l,
                ...event.r
            ];

            for (const note of allNotes) {

                const number = midi(note);

                if (
                    !Number.isFinite(number) ||
                    number < 21 ||
                    number > 108
                ) {

                    throw new Error(
                        "Invalid piano note: " + note
                    );
                }
            }

            return event;
        });

        if (!next.length) {
            throw new Error("No notes entered.");
        }

        stop();

        events = next;

        index = 0;

        remaining = events[0].b;

        countdown = 0;

        playbackStarted = false;

        createTimeline();

        show();

        $("xmlStatus").textContent =
            `Loaded ${events.length} practice steps.`;

    } catch (error) {

        console.error(error);

        $("xmlStatus").textContent =
            error.message;
    }
}

// Load practice notes button
$("apply").onclick = load;

/* =========================================================
   14. PLAYBACK SPEED AND HAND SELECTION
   ========================================================= */

$("speed").oninput = () => {

    $("speedText").textContent =
        $("speed").value + "%";
};

$("hand").onchange = () => {

    if (countdown <= 0) {
        show();
    }
};

/* =========================================================
   15. PLAY AND COUNTDOWN
   ========================================================= */

$("play").onclick = () => {

    if (running || !events.length) return;

    // Restart after finishing
    if (index >= events.length) {

        index = 0;

        remaining = events[0].b;

        playbackStarted = false;
    }

    // Start a new countdown
    if (!playbackStarted) {

        countdown = Math.max(
            0,
            Math.min(
                60,
                Number($("count").value) || 0
            )
        );

        playbackStarted = true;
    }

    running = true;

    last = performance.now();

    if (countdown > 0) {

        clearKeys();

        $("now").textContent =
            "Starting in " + Math.ceil(countdown);

    } else {

        show();
    }

    timer = setInterval(() => {

        const now = performance.now();

        const elapsed = (now - last) / 1000;

        last = now;

        // Countdown
        if (countdown > 0) {

            countdown = Math.max(
                0,
                countdown - elapsed
            );

            $("now").textContent =
                countdown > 0
                    ? "Starting in " +
                        Math.ceil(countdown)
                    : "Go!";

            if (countdown === 0) {
                show();
            }

            return;
        }

        // Read tempo and speed dynamically
        const bpm = Math.max(
            20,
            Math.min(
                300,
                Number($("bpm").value) || 80
            )
        );

        const speed =
            Number($("speed").value) / 100;

        // Convert elapsed seconds into musical beats
        remaining -=
            elapsed * bpm / 60 * speed;

        // Move to the next musical event
        while (remaining <= 0) {

            index++;

            // End of music
            if (index >= events.length) {

                stop();

                clearKeys();

                playbackStarted = false;

                $("now").textContent =
                    "Finished!";

                return;
            }

            remaining += events[index].b;

            show();
        }

    }, 30);
};

/* =========================================================
   16. PAUSE AND RESET PLAYBACK
   ========================================================= */

$("pause").onclick = () => {

    stop();

    $("now").textContent = "Paused";
};

$("stop").onclick = () => {

    stop();

    index = 0;

    remaining = events[0]?.b || 0;

    countdown = 0;

    playbackStarted = false;

    clearKeys();

    if (events.length) {

        show();

    } else {

        $("now").textContent = "Ready";
    }
};

/* =========================================================
   17. IMPORT MUSICXML
   ========================================================= */

$("xml").onchange = async () => {

    try {

        const file = $("xml").files[0];

        if (!file) return;

        $("xmlStatus").textContent =
            "Reading MusicXML...";

        const content = await file.text();

        const doc = new DOMParser().parseFromString(
            content,
            "application/xml"
        );

        if (
            doc.querySelector("parsererror") ||
            doc.documentElement.localName !==
                "score-partwise"
        ) {

            throw new Error(
                "Use an uncompressed score-partwise " +
                "MusicXML file."
            );
        }

        const parts = [
            ...doc.querySelectorAll(
                "score-partwise > part"
            )
        ];

        if (
            !parts.length ||
            parts.length > 2
        ) {

            throw new Error(
                "Only one piano part or " +
                "two separate hand parts are supported."
            );
        }

        const spans = [];

        let end = 0;

        /* Read each musical part */

        for (const [partIndex, part]
            of parts.entries()) {

            let divisions = 1;
            let clock = 0;

            const measures = [...part.children]
                .filter(element =>
                    element.localName === "measure"
                );

            /* Read each measure */

            for (const measure of measures) {

                let position = clock;
                let maximum = clock;
                let previous = clock;

                for (const element
                    of measure.children) {

                    const tag = element.localName;

                    const value = selector =>
                        element.querySelector(selector)
                            ?.textContent;

                    // MusicXML timing attributes
                    if (tag === "attributes") {

                        if (value("divisions")) {

                            divisions = Number(
                                value("divisions")
                            );
                        }

                        if (
                            !Number.isFinite(divisions) ||
                            !(divisions > 0)
                        ) {

                            throw new Error(
                                "Invalid MusicXML divisions."
                            );
                        }

                    // Move between voices
                    } else if (
                        tag === "backup" ||
                        tag === "forward"
                    ) {

                        const duration =
                            Number(value("duration")) /
                            divisions;

                        if (
                            !Number.isFinite(duration)
                        ) {

                            throw new Error(
                                "Invalid MusicXML duration."
                            );
                        }

                        position +=
                            tag === "backup"
                                ? -duration
                                : duration;

                        maximum = Math.max(
                            maximum,
                            position
                        );

                    // Read musical notes
                    } else if (tag === "note") {

                        // Grace notes are not supported
                        if (
                            element.querySelector("grace")
                        ) {
                            continue;
                        }

                        const duration =
                            Number(value("duration")) /
                            divisions;

                        if (
                            !Number.isFinite(duration) ||
                            !(duration > 0)
                        ) continue;

                        const chord = Boolean(
                            element.querySelector("chord")
                        );

                        const at =
                            chord ? previous : position;

                        if (!chord) {

                            previous = position;

                            position += duration;
                        }

                        maximum = Math.max(
                            maximum,
                            at + duration,
                            position
                        );

                        // Skip rests
                        if (
                            !element.querySelector("pitch")
                        ) continue;

                        const step =
                            value("pitch > step");

                        const octave =
                            value("pitch > octave");

                        const alter = Number(
                            value("pitch > alter") || 0
                        );

                        if (
                            ![-1, 0, 1].includes(alter)
                        ) {

                            throw new Error(
                                "Double accidentals and " +
                                "microtones are not supported."
                            );
                        }

                        let accidental = "";

                        if (alter === 1) {
                            accidental = "#";
                        }

                        if (alter === -1) {
                            accidental = "b";
                        }

                        const note =
                            step + accidental + octave;

                        // Determine left or right hand
                        let hand;

                        if (parts.length === 2) {

                            hand =
                                partIndex === 0
                                    ? "r"
                                    : "l";

                        } else {

                            hand =
                                value("staff") === "2"
                                    ? "l"
                                    : "r";
                        }

                        spans.push({
                            at: at,
                            to: at + duration,
                            n: note,
                            hand: hand
                        });
                    }
                }

                clock = maximum;
            }

            end = Math.max(end, clock);
        }

        /* =================================================
           18. CONVERT MUSICXML INTO PRACTICE EVENTS
           ================================================= */

        const times = [
            ...new Set(
                [
                    0,
                    end,
                    ...spans.flatMap(span => [
                        span.at,
                        span.to
                    ])
                ].map(number =>
                    Math.round(number * 1000000) /
                    1000000
                )
            )
        ].sort((a, b) => a - b);

        const lines = times
            .slice(0, -1)
            .map((time, position) => {

                function activeNotes(hand) {

                    const notes = spans
                        .filter(span =>
                            span.hand === hand &&
                            span.at <= time + 0.0000005 &&
                            span.to > time + 0.0000005
                        )
                        .map(span => span.n);

                    return (
                        [...new Set(notes)].join(" ") ||
                        "-"
                    );
                }

                const duration = Number(
                    (
                        times[position + 1] - time
                    ).toFixed(6)
                );

                return (
                    `${duration} | ` +
                    `${activeNotes("l")} | ` +
                    `${activeNotes("r")}`
                );
            });

        $("notes").value = lines.join("\n");

        load();

    } catch (error) {

        console.error(error);

        $("xmlStatus").textContent =
            "MusicXML error: " + error.message;
    }
};

/* =========================================================
   19. INITIALIZE APPLICATION
   ========================================================= */

load();

console.log(
    "Ivy Piano Trainer initialized successfully."
);

/* =========================================================
   END OF SCRIPT
   ========================================================= */
