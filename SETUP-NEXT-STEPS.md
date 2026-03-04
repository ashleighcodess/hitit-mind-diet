# HIT IT Mind Diet — Setup & Next Steps

## Architecture (Rebuilt Mar 3, 2026)
Single-page app (SPA) with hash routing. One `index.html`, all screens toggle via JS.

**Screens:** Splash → Onboarding (2 pages) → Login/Register → Tracker → Daily Weight → Weekly Results → Peak Vibration → Exercises → Reference Charts → Coach Dashboard

**Navigation:** Bottom nav bar (Tracker, Daily, Weekly, Vibes, More) on all post-auth screens.

**Stack:** Vanilla HTML/CSS/JS + Firebase Auth + Cloud Firestore. No build step.

---

## Firebase Setup (Do This First)

### 1. Create Firebase Project
- Go to https://console.firebase.google.com
- Click "Add project" → name it `hitit-mind-diet`
- Skip Google Analytics (optional)

### 2. Enable Authentication
- Firebase Console → Build → Authentication → Get Started
- Click "Email/Password" → Enable it → Save

### 3. Create Firestore Database
- Build → Firestore Database → Create Database
- Choose **production mode**
- Pick a region (us-central1 is fine)

### 4. Register a Web App
- Project Settings (gear icon) → General → "Your apps" → Web (</> icon)
- Name it "hitit-mind-diet-web"
- Copy the `firebaseConfig` object

### 5. Paste Config into Code
Open `js/firebase-config.js` and replace placeholders:
```js
const firebaseConfig = {
  apiKey: "paste-your-real-key",
  authDomain: "hitit-mind-diet.firebaseapp.com",
  projectId: "hitit-mind-diet",
  storageBucket: "hitit-mind-diet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 6. Set Firestore Security Rules
In Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "coach";
    }
    match /entries/{entryId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "coach"
      );
    }
    match /assignments/{assignmentId} {
      allow read: if request.auth != null && (
        resource.data.clientId == request.auth.uid ||
        resource.data.coachId == request.auth.uid
      );
      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "coach";
      allow update: if request.auth != null && resource.data.clientId == request.auth.uid;
    }
  }
}
```

### 7. Create Firestore Indexes
The app needs composite indexes. Easiest method: use the app, check browser console for Firebase error links, click to auto-create.

Indexes needed:
- `entries`: `userId` (Asc) + `date` (Asc) + `timestamp` (Desc)
- `entries`: `userId` (Asc) + `date` (Asc) + `date` (Desc) + `timestamp` (Desc)
- `assignments`: `clientId` (Asc) + `createdAt` (Desc)

---

## Test It
1. Run `npx serve .` or `python3 -m http.server 8000`
2. Open `http://localhost:8000` in Chrome
3. Splash → Get Started → Onboarding → Register
4. Tap emotions on tracker → log appears, score updates
5. Navigate via bottom bar: Daily, Weekly, Vibes, More

---

## Updated Calorie Values (Mar 2026)
| Tier | Emotion | Calories |
|------|---------|----------|
| RED | Guilt | +1,000 |
| RED | Fear | +2,000 |
| RED | Anger | +3,000 |
| RED | Doubt | +4,000 |
| RED | Critical | +5,000 |
| GREEN | Willingness | -2,000 |
| GREEN | Point Self Flip | -3,000 |
| BLUE | Big Smile | -1,000 |
| BLUE | Bright Side | -2,000 |
| BLUE | Giving Comps | -3,000 |
| BLUE | Piece Done | -4,000 |
| PURPLE | Rocket Desire | -1,000 |
| PURPLE | Spend Money | -2,000 |
| PURPLE | Synchronicity | -3,000 |
| WHITE | Intention | -1,000 |
| WHITE | Stayed Calm | -2,000 |

---

## Still To Build
- **PWA:** `manifest.json`, service worker, install prompt
- **Deploy:** Cloudflare Pages
- **Firebase project:** Create and connect (see above)
- **Coach assignments:** Assignment detail view, file uploads
- **Push notifications:** Service worker reminders
