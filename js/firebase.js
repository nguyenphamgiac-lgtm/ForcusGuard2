// =====================================================================
// firebase.js — Firebase init + data access layer
//
// FocusGuard talks to Firebase through the small API at the bottom of
// this file (FGData.*). Every other module calls FGData instead of the
// Firebase SDK directly, so the whole app also runs with ZERO Firebase
// setup: if firebaseConfig below is left with placeholder values, this
// file automatically falls back to localStorage ("demo mode") and logs
// a warning once. Fill in your real config to switch to real Firestore.
// =====================================================================

// 1) Replace with the config object from:
//    Firebase Console > Project settings > General > Your apps > SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBTGUZ3CxSsES96SjvnVLnOC_FXoUdfqd0",
    authDomain: "forcusgarden.firebaseapp.com",
    projectId: "forcusgarden",
    storageBucket: "forcusgarden.firebasestorage.app",
    messagingSenderId: "439256507735",
    appId: "1:439256507735:web:5a2a366004a3df952bca12"
};
const FG_DEMO_MODE = firebaseConfig.apiKey === "REPLACE_ME";
let fbApp = null;
let fbDb = null;

async function initFirebase() {
    if (FG_DEMO_MODE) {
        console.warn(
            "[FocusGuard] firebaseConfig is still using placeholder values — " +
            "running in DEMO MODE with localStorage instead of Firestore. " +
            "See README.md > 'Configuring Firebase' to connect a real project."
        );
        return;
    }
    try {
        // Loaded from the Firebase compat CDN scripts in <head>.
        fbApp = firebase.initializeApp(firebaseConfig);
        fbDb = firebase.firestore();
        console.log("[FocusGuard] Firebase connected.");
    } catch (e) {
        console.error("[FocusGuard] Firebase init failed, falling back to demo mode:", e);
    }
}

// ---------------------------------------------------------------------
// Local-storage helpers (demo mode backend)
// ---------------------------------------------------------------------
function lsGet(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}
function lsSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------
// Public data API used by the rest of the app
// ---------------------------------------------------------------------
const FGData = {

    async init() {
        await initFirebase();
    },

    // ---- Users -------------------------------------------------------
    async saveUser(user) {
        // user: { id, name, role: "student" | "parent", parentOf?: [studentId] }
        if (fbDb) {
            await fbDb.collection("Users").doc(user.id).set(user, { merge: true });
        } else {
            const users = lsGet("fg_users", {});
            users[user.id] = user;
            lsSet("fg_users", users);
        }
    },

    async getUser(id) {
        if (fbDb) {
            const doc = await fbDb.collection("Users").doc(id).get();
            return doc.exists ? doc.data() : null;
        }
        const users = lsGet("fg_users", {});
        return users[id] || null;
    },

    async listStudents() {
        if (fbDb) {
            const snap = await fbDb.collection("Users").where("role", "==", "student").get();
            return snap.docs.map(d => d.data());
        }
        const users = lsGet("fg_users", {});
        return Object.values(users).filter(u => u.role === "student");
    },

    // ---- Study sessions ------------------------------------------------
    async saveSession(session) {
        // session: { userId, startTime, endTime, focusScore, distractionCount, studySeconds }
        if (fbDb) {
            await fbDb.collection("StudySessions").add(session);
        } else {
            const sessions = lsGet("fg_sessions", []);
            sessions.push({ ...session, id: Date.now().toString() });
            lsSet("fg_sessions", sessions);
        }
    },

    async getSessionsForUser(userId) {
        if (fbDb) {
            const snap = await fbDb.collection("StudySessions").where("userId", "==", userId).get();
            return snap.docs.map(d => d.data());
        }
        const sessions = lsGet("fg_sessions", []);
        return sessions.filter(s => s.userId === userId);
    },

    // ---- Warnings ------------------------------------------------------
    async saveWarning(warning) {
        // warning: { userId, type, time, duration }
        if (fbDb) {
            await fbDb.collection("Warnings").add(warning);
        } else {
            const warnings = lsGet("fg_warnings", []);
            warnings.push({ ...warning, id: Date.now().toString() });
            lsSet("fg_warnings", warnings);
        }
    },

    async getWarningsForUser(userId) {
        if (fbDb) {
            const snap = await fbDb.collection("Warnings").where("userId", "==", userId).get();
            return snap.docs.map(d => d.data());
        }
        const warnings = lsGet("fg_warnings", []);
        return warnings.filter(w => w.userId === userId);
    },

    // ---- Study schedule (used by notification.js) ----------------------
    async saveSchedule(userId, schedule) {
        // schedule: { time: "19:00", subject: "Toán" }
        if (fbDb) {
            await fbDb.collection("Users").doc(userId).set({ schedule }, { merge: true });
        } else {
            const users = lsGet("fg_users", {});
            users[userId] = { ...(users[userId] || {}), schedule };
            lsSet("fg_users", users);
        }
    },

    isDemoMode() {
        return FG_DEMO_MODE;
    }
};

window.FGData = FGData;
