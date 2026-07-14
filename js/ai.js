// =====================================================================
// ai.js — on-device computer vision
//
// Uses two TensorFlow.js models, both loaded from the CDN in <head>:
//   - blazeface   -> is a face visible / facing the camera?
//   - coco-ssd    -> is a person present? is a cell phone visible?
//
// Status machine (matches the spec):
//   FOCUSED     — face detected
//   DISTRACTED  — no face detected for > FACE_AWAY_THRESHOLD (10s),
//                 OR a phone is visible
//   AWAY        — no person detected at all for > PERSON_AWAY_THRESHOLD (30s)
//
// Everything runs locally in the browser; no video frame is ever sent
// anywhere or stored — only the derived status/timestamps.
// =====================================================================

const FACE_AWAY_THRESHOLD_MS = 10000;   // 10s turned away -> "distracted"
const PERSON_AWAY_THRESHOLD_MS = 30000; // 30s no person -> "away from desk"
const DETECTION_INTERVAL_MS = 700;

const FGAI = {
    faceModel: null,
    objectModel: null,
    ready: false,
    running: false,
    loopHandle: null,

    status: "focused", // "focused" | "distracted" | "away"
    lastFaceSeenAt: Date.now(),
    lastPersonSeenAt: Date.now(),
    phoneVisible: false,

    onStatusChange: null, // callback(status, meta)
    onWarning: null,       // callback({ type, duration })

    async load() {
        if (this.ready) return;
        this.faceModel = await blazeface.load();
        this.objectModel = await cocoSsd.load();
        this.ready = true;
    },

    start(videoEl) {
        if (!this.ready) throw new Error("Call FGAI.load() before start()");
        if (this.running) return;

        this.running = true;
        this.lastFaceSeenAt = Date.now();
        this.lastPersonSeenAt = Date.now();
        this._warnedDistracted = false;
        this._warnedAway = false;

        this.loopHandle = setInterval(() => this._tick(videoEl), DETECTION_INTERVAL_MS);
    },

    stop() {
        this.running = false;
        if (this.loopHandle) clearInterval(this.loopHandle);
        this.loopHandle = null;
    },

    async _tick(videoEl) {
        if (!videoEl || videoEl.readyState < 2) return;

        const now = Date.now();

        try {
            const faces = await this.faceModel.estimateFaces(videoEl, false);
            const objects = await this.objectModel.detect(videoEl);

            const faceSeen = faces.length > 0;
            const personSeen = faceSeen || objects.some(o => o.class === "person" && o.score > 0.5);
            const phoneSeen = objects.some(o => o.class === "cell phone" && o.score > 0.5);

            this.phoneVisible = phoneSeen;
            if (faceSeen) this.lastFaceSeenAt = now;
            if (personSeen) this.lastPersonSeenAt = now;

            const awayMs = now - this.lastPersonSeenAt;
            const distractedMs = now - this.lastFaceSeenAt;

            let nextStatus = "focused";

            if (awayMs > PERSON_AWAY_THRESHOLD_MS) {
                nextStatus = "away";
                if (!this._warnedAway) {
                    this._warnedAway = true;
                    this._fireWarning("away", awayMs);
                }
            } else if (distractedMs > FACE_AWAY_THRESHOLD_MS || phoneSeen) {
                nextStatus = "distracted";
                if (!this._warnedDistracted) {
                    this._warnedDistracted = true;
                    this._fireWarning(phoneSeen ? "phone" : "distracted", distractedMs);
                }
            } else {
                this._warnedDistracted = false;
                this._warnedAway = false;
            }

            if (nextStatus !== this.status) {
                this.status = nextStatus;
                if (this.onStatusChange) this.onStatusChange(nextStatus, { phoneVisible: phoneSeen });
            }
        } catch (e) {
            console.warn("[FocusGuard] detection tick failed:", e);
        }
    },

    _fireWarning(type, durationMs) {
        if (this.onWarning) {
            this.onWarning({ type, duration: Math.round(durationMs / 1000) });
        }
    },

    isFocused() {
        return this.status === "focused";
    }
};

window.FGAI = FGAI;
