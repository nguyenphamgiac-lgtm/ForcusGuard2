// =====================================================================
// notification.js — in-app + browser notifications
//
// Two layers:
//  1. Local notifications (this device, works with zero setup): browser
//     Notification API, used for "student hasn't started" / "too many
//     distractions" alerts shown to whoever has the page open.
//  2. Cross-device push to a parent's phone/laptop needs Firebase Cloud
//     Messaging (FCM) — that requires a real Firebase project and a
//     small server (or Cloud Function) to call the FCM Admin API, since
//     browsers cannot send push messages to OTHER devices by themselves.
//     Stubs for that are marked TODO below; see README.md.
// =====================================================================

const FGNotify = {

    async requestPermission() {
        if (!("Notification" in window)) return "unsupported";
        if (Notification.permission === "granted") return "granted";
        if (Notification.permission === "denied") return "denied";
        return await Notification.requestPermission();
    },

    local(title, body) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        try {
            new Notification(title, { body, icon: "" });
        } catch (e) {
            console.warn("Notification failed:", e);
        }
    },

    // Checks a saved schedule entry like { time: "19:00", subject: "Toán" }
    // against the current time and fires a "not started yet" alert if the
    // student hasn't opened a Pomodoro session within `graceMinutes`.
    checkScheduleReminder(schedule, sessionStartedToday, graceMinutes = 5) {
        if (!schedule || !schedule.time) return;
        const [h, m] = schedule.time.split(":").map(Number);
        const now = new Date();
        const scheduled = new Date();
        scheduled.setHours(h, m, 0, 0);

        const graceEnd = new Date(scheduled.getTime() + graceMinutes * 60000);

        if (now >= graceEnd && !sessionStartedToday) {
            this.local(
                "FocusGuard",
                `⚠️ Học sinh chưa bắt đầu buổi học "${schedule.subject || ""}" lúc ${schedule.time}`
            );
            return true;
        }
        return false;
    },

    distractionSummary(studentName, warningCount) {
        this.local("FocusGuard", `⚠️ ${studentName} mất tập trung ${warningCount} lần`);
    },

    // ------------------------------------------------------------------
    // TODO (server-side, requires your own Firebase project + backend):
    //   1. Enable Cloud Messaging in Firebase Console.
    //   2. On the parent's device, register a service worker and call
    //      firebase.messaging().getToken() to get a device token, then
    //      save it via FGData.saveUser({ id, fcmToken }).
    //   3. From a Cloud Function (NOT client-side JS — the server key
    //      must stay secret), send to that token with the Admin SDK:
    //        admin.messaging().send({
    //          token: parentFcmToken,
    //          notification: { title, body }
    //        });
    //      Trigger that function from a Firestore onCreate trigger on
    //      the Warnings collection, so parents get pushed alerts even
    //      when the app is closed.
    // ------------------------------------------------------------------
};

window.FGNotify = FGNotify;
