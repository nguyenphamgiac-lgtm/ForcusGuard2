// =====================================================================
// camera.js — webcam lifecycle
//
// Privacy note: FocusGuard never records or uploads video. The stream
// only ever feeds the on-device TensorFlow.js models in ai.js; nothing
// leaves the browser except the small numeric results (focus score,
// timestamps, warning counts) saved through firebase.js.
// =====================================================================

const FGCamera = {
    stream: null,
    videoEl: null,

    async start(videoElementId) {
        this.videoEl = document.getElementById(videoElementId);
        if (!this.videoEl) throw new Error("Video element not found: " + videoElementId);

        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 },
            audio: false
        });

        this.videoEl.srcObject = this.stream;

        await new Promise(resolve => {
            this.videoEl.onloadedmetadata = () => {
                this.videoEl.play();
                resolve();
            };
        });

        return this.videoEl;
    },

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoEl) {
            this.videoEl.srcObject = null;
        }
    },

    isActive() {
        return !!this.stream;
    }
};

window.FGCamera = FGCamera;
