// =====================================================================
// pomodoro.js — Pomodoro timer, XP/streak, and study-time bookkeeping
//
// Reads live focus state from FGAI (ai.js) once monitoring is running.
// If AI monitoring is off, every second just counts as "studying" so
// the timer still works as a plain Pomodoro app.
// =====================================================================

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const FGPomodoro = {
    mode: "work",           // "work" | "break"
    timer: WORK_SECONDS,
    isRunning: false,
    interval: null,

    studySeconds: 0,
    distractedSeconds: 0,
    warnings: [],
    streak: 0,
    xp: 0,

    userId: null,
    sessionStart: null,

    ui: {}, // populated by bindUI()

    init(userId) {
        this.userId = userId;
        this.streak = Number(localStorage.getItem(`fg_streak_${userId}`) || 0);
        this.xp = Number(localStorage.getItem(`fg_xp_${userId}`) || 0);
    },

    bindUI(ids) {
        // ids: { timer, studyTime, distractedTime, streak, xp, warning, chartCanvas }
        this.ui = ids;
        this._initChart();
        this._render();
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.sessionStart = this.sessionStart || new Date().toISOString();

        this.interval = setInterval(() => this._tick(), 1000);
    },

    pause() {
        this.isRunning = false;
        clearInterval(this.interval);
    },

    reset() {
        this.pause();
        this.mode = "work";
        this.timer = WORK_SECONDS;
        this.studySeconds = 0;
        this.distractedSeconds = 0;
        this.warnings = [];
        this.sessionStart = null;
        this._render();
    },

    logWarning(warning) {
        // warning: { type, duration }
        this.warnings.push(warning);
        if (this.userId) {
            FGData.saveWarning({
                userId: this.userId,
                type: warning.type,
                time: new Date().toISOString(),
                duration: warning.duration
            });
        }
        this._render();
    },

    async _tick() {
        if (this.timer <= 0) {
            return this._finishPhase();
        }
        this.timer--;

        const focused = window.FGAI && FGAI.running ? FGAI.isFocused() : true;

        if (this.mode === "work") {
            if (focused) this.studySeconds++;
            else this.distractedSeconds++;
        }

        this._render();
    },

    async _finishPhase() {
        this.pause();

        if (this.mode === "work") {
            this.xp += 10;
            this.streak += 1;
            localStorage.setItem(`fg_xp_${this.userId}`, this.xp);
            localStorage.setItem(`fg_streak_${this.userId}`, this.streak);

            if (this.userId) {
                await FGData.saveSession({
                    userId: this.userId,
                    startTime: this.sessionStart,
                    endTime: new Date().toISOString(),
                    focusScore: this._focusScore(),
                    distractionCount: this.warnings.length,
                    studySeconds: this.studySeconds
                });
            }

            this._playSound("doneSound");
            this._speak("Hoàn thành phiên học, đến giờ nghỉ");
            this.mode = "break";
            this.timer = BREAK_SECONDS;
        } else {
            this._speak("Hết giờ nghỉ, bắt đầu phiên học tiếp theo");
            this.mode = "work";
            this.timer = WORK_SECONDS;
            this.sessionStart = new Date().toISOString();
        }

        this._render();
    },

    _focusScore() {
        const total = this.studySeconds + this.distractedSeconds;
        if (total === 0) return 100;
        return Math.floor((this.studySeconds / total) * 100);
    },

    _playSound(elId) {
        const el = document.getElementById(elId);
        if (el) { el.currentTime = 0; el.play().catch(() => {}); }
    },

    _speak(text) {
        if (!("speechSynthesis" in window)) return;
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = "vi-VN";
        speechSynthesis.speak(msg);
    },

    _initChart() {
        const canvas = document.getElementById(this.ui.chartCanvas);
        if (!canvas || typeof Chart === "undefined") return;
        this.chart = new Chart(canvas, {
            type: "doughnut",
            data: {
                labels: ["Focus", "Distracted"],
                datasets: [{ data: [100, 0], backgroundColor: ["#4f7cff", "#ef4444"], borderWidth: 0 }]
            },
            options: { plugins: { legend: { display: false } } }
        });
    },

    _render() {
        const m = Math.floor(this.timer / 60);
        const s = this.timer % 60;
        const timerEl = document.getElementById(this.ui.timer);
        if (timerEl) timerEl.innerText = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

        const modeEl = document.getElementById(this.ui.mode);
        if (modeEl) modeEl.innerText = this.mode === "work" ? "Học" : "Nghỉ";

        const studyEl = document.getElementById(this.ui.studyTime);
        if (studyEl) studyEl.innerText = "Study: " + Math.floor(this.studySeconds / 60) + "m";

        const distractEl = document.getElementById(this.ui.distractedTime);
        if (distractEl) distractEl.innerText = "Distracted: " + this.warnings.length + " times";

        const streakEl = document.getElementById(this.ui.streak);
        if (streakEl) streakEl.innerText = "Streak: " + this.streak;

        const xpEl = document.getElementById(this.ui.xp);
        if (xpEl) xpEl.innerText = "XP: " + this.xp;

        const score = this._focusScore();
        const scoreEl = document.getElementById(this.ui.score);
        if (scoreEl) scoreEl.innerText = score + "%";

        if (this.chart) {
            this.chart.data.datasets[0].data = [score, 100 - score];
            this.chart.update();
        }

        const logEl = document.getElementById(this.ui.log);
        if (logEl) {
            logEl.innerHTML = this.warnings
                .slice(-10)
                .reverse()
                .map(w => `<div class="log-item">${w.type} · ${w.duration}s</div>`)
                .join("") || `<div class="log-item">Chưa có cảnh báo nào</div>`;
        }
    }
};

window.FGPomodoro = FGPomodoro;
