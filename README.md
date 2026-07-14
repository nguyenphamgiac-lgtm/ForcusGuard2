# FocusGuard AI

An AI-assisted study-focus app: on-device webcam monitoring (face / person /
phone detection), a Pomodoro timer, and a parent dashboard — no video is ever
recorded or uploaded, only derived focus scores and warning counts.

## Project structure

```
FocusGuard/
├── index.html        landing page — pick role (student / parent)
├── dashboard.html     student dashboard (camera, pomodoro, chart, stats)
├── parent.html        parent dashboard (linked students' stats)
├── css/
│   └── style.css
├── js/
│   ├── camera.js       webcam start/stop
│   ├── ai.js           blazeface + coco-ssd detection, distraction logic
│   ├── pomodoro.js     timer, XP, streak, session logging
│   ├── firebase.js     Firestore access layer (has a localStorage demo mode)
│   └── notification.js in-app alerts + schedule reminders
└── README.md
```

## 1. Run it locally

Camera access requires either `https://` or `http://localhost` — opening
`index.html` directly as a `file://` URL will NOT be allowed to use the
webcam in most browsers. Serve the folder locally instead:

```bash
cd FocusGuard
python3 -m http.server 8080
# then open http://localhost:8080
```

(Any static server works — `npx serve`, VS Code "Live Server", etc.)

**Out of the box, with zero configuration**, the app runs in **demo mode**:
`firebase.js` detects that `firebaseConfig` still has placeholder values and
automatically stores users/sessions/warnings in `localStorage` instead of
Firestore. This is enough to try the whole flow (student session → parent
dashboard) on one machine/browser. To sync real data across devices, connect
a real Firebase project (below).

## 2. Configuring Firebase (optional, for real multi-device sync)

1. Create a project at https://console.firebase.google.com.
2. **Authentication** — enable at least "Anonymous" or "Email/Password" sign-in
   (this starter uses a simple name+ID login; swapping in real Firebase Auth
   is a good next step — see the TODO in `index.html`'s `enter()` function).
3. **Firestore Database** — create it in production mode, then add rules that
   scope reads/writes by `userId` before going live (the default sample rules
   are open and NOT safe to deploy as-is).
4. **Project settings → General → Your apps → Web app** — copy the config
   object and paste it into `firebaseConfig` at the top of `js/firebase.js`.
5. Add the Firebase compat SDK scripts to the `<head>` of each HTML page
   (dashboard.html, parent.html, index.html), before `js/firebase.js`:

   ```html
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
   ```

Once `firebaseConfig` no longer has `"REPLACE_ME"` values, `firebase.js`
automatically switches from localStorage to real Firestore reads/writes —
no other file needs to change.

### Firestore collections used

- `Users` — `{ id, name, role: "student" | "parent", watching?: [studentId], schedule? }`
- `StudySessions` — `{ userId, startTime, endTime, focusScore, distractionCount, studySeconds }`
- `Warnings` — `{ userId, type, time, duration }`

### Push notifications to a parent's device (Firebase Cloud Messaging)

Browser JS can only show notifications on the *current* device. To push an
alert to a parent's phone while the student's laptop is the one detecting the
distraction, you need:
1. FCM enabled in the Firebase Console, and a registered service worker on
   the parent's device that calls `firebase.messaging().getToken()`.
2. A small server (Cloud Function is simplest) that listens for new
   `Warnings` documents and calls the FCM Admin SDK to push to that token —
   the Admin SDK key must never ship in client-side JS. See the TODO block
   at the bottom of `js/notification.js` for the exact trigger shape.

## 3. Deploying to Vercel

```bash
cd FocusGuard
npm i -g vercel   # if you don't have the CLI
vercel            # first deploy, follow the prompts
vercel --prod     # promote to production
```

Since this is a static site (no build step), Vercel's defaults work with no
`vercel.json` needed — it will serve `index.html`, `dashboard.html`, etc.
directly. Make sure your Firebase Firestore security rules are locked down
(step 3 above) before making a real deployment public.

## Privacy

- No video frame is ever stored or transmitted — detection runs fully
  on-device via TensorFlow.js.
- Only numeric focus scores, session timestamps, and warning
  type/duration are saved.
- The camera can be stopped at any time with the "Stop" button in the
  video panel.
