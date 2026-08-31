# Mind Vault 🧠🔐

> **Privacy-First AI Second Brain & Journaling Platform with Zero-Knowledge Client-Side Encryption, In-Browser Local Embeddings & Multi-Role Security.**

Mind Vault allows users to reflect, unload daily cognitive burdens, and query their historical memories without ever exposing raw plaintext to servers, external databases, or third-party vector aggregators.

---

## 🛡️ Threat Model & Architectural Directives

| Threat Zone | Identified Attack Vector | Production Countermeasure Implemented |
|---|---|---|
| **1. Input Surfaces** | Prompt injection, raw speech stream flooding, unvalidated geolocation spoofing | Strict schema deserialization, regex-cleaned speech chunks, coordinate boundary normalization (`lat/lng` bounds check). |
| **2. Planning & Reasoning** | LLM privilege escalation or model unavailable errors (503/429) | Ephemeral model fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`). |
| **3. Tool Execution & API Keys** | Leaking Google Maps API keys or third-party webhook tokens in client bundles | Maps runtime environment injection (`VITE_GOOGLE_MAPS_API_KEY`), HTTP Referrer Cloud Console restriction, and backend notification proxying. |
| **4. Memory & State** | Unauthorized admin snooping or cross-user Firestore data leaks | Client-side AES-GCM 256-bit encryption (PBKDF2 100k iter). Admins strictly hold Zero-Knowledge permissions (system metrics only). |
| **5. Inter-System Comms** | Unencrypted external webhook transmission from browser | Backend server-side dispatcher `/api/notifications/dispatch-sanitized-alert` using `process.env.NOTIFICATION_WEBHOOK_URL`. |

---

## 🔒 Firestore Security Rules (Owner-Bound Isolation & RBAC)

Deploy the following hardened security rules to enforce owner-bound isolation and zero-knowledge admin access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.admin == true ||
        request.auth.token.role == 'admin' ||
        (exists(/databases/$(database)/documents/roles/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'admin')
      );
    }

    // User data isolation: ONLY owner can read/write
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      // ZERO-KNOWLEDGE: Admins CANNOT read decrypted ciphertext or private records
      match /encrypted_vault/{recordId} {
        allow read, write: if isOwner(userId);
      }

      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Admin-only non-sensitive system stats & sanitized webhook logs
    match /admin_metrics/{metricId} {
      allow read, write: if isAdmin();
    }

    match /admin_notification_logs/{logId} {
      allow read, write: if isAdmin();
    }

    // Deny all other unmatched paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🗺️ Google Maps & Geolocation Directive

- **Client-Side Restrictions**: All Google Maps JavaScript API keys are referenced via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` and must be restricted to authorized HTTP referrers in Google Cloud Console.
- **Encrypted Location Coordinates**: Latitude, longitude, accuracy, and formatted addresses are encrypted alongside the journal body using client-side AES-GCM before saving to IndexedDB or Firestore.

---

## 🚀 Google Cloud Deployment & Secret Management

### 1. Prerequisites & GCP Configuration
Ensure the `gcloud` CLI is installed and configured with your project:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com secretmanager.googleapis.com firestore.googleapis.com
```

### 2. Secret Manager Setup
Create and bind secrets for Gemini AI and Webhooks:
```bash
# Create and populate Gemini API Key secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy to Google Cloud Run
Deploy the application directly from source:
```bash
gcloud run deploy mind-vault \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

### 4. Mandatory Campaign Verification Labeling
Apply the challenge verification label:
```bash
gcloud run services update mind-vault \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Functional Stability & Comprehensive Test Walkthroughs

The following test walkthrough cases allow developers and automated QA tooling to verify every user workflow end-to-end:

### Test Case 1: External Notification Integrations (Slack / Discord / Email)
1. **Open Settings / Alerts Panel**:
   - In the Daily Reflection tab, click the **"Alerts"** button in the toolbar, or open the **Security & Vault** tab and scroll to **External Notification Integrations**.
2. **Configure Delivery Destination**:
   - Select **Slack Webhook**, **Discord Webhook**, or **Email (Resend/API)**.
   - Enter a target Webhook URL or recipient email (`riteshnayak2301@gmail.com`).
3. **Execute Live Test Dispatch**:
   - Click **"Test Alert Dispatch"**.
   - Verify that the spinner displays and an emerald confirmation banner appears: *"Test alert successfully dispatched"*.
   - Check the **Recent Sanitized Dispatches** table below to confirm the event has logged with status `SENT` or `FILTERED`.
4. **Trigger via High Friction Reflection**:
   - Write a reflection mentioning severe burnout or blockers (e.g. *"I am feeling extreme exhaustion and blocked by continuous architectural regressions"*).
   - Click **"Encrypt & Synthesize Mind"**.
   - Observe the structured Gemini synthesis flag (`trigger_alert: true`) and verify the **"Cognitive Friction Alert Triggered"** banner appears in the synthesis preview.
   - Confirm the sanitized summary is dispatched without leaking raw reflection plaintext.

### Test Case 2: Location-Pinning & Map Integration
1. **Toggle Map**: Click **"Pin Location"** under the daily reflection text area.
2. **Select Geolocation**: Click **"Use Current GPS Location"** (or search via Google Places / drag the pin on the map).
3. **Verify Zero-Knowledge Packaging**: Submit reflection. Ensure location coordinates `{ lat, lng, addressName }` are packaged into the encrypted AES-GCM bundle.

### Test Case 3: Admin Dashboard & RBAC Telemetry
1. **Access Protected Route**: Navigate to the **"RBAC & Admin"** tab in the navigation bar.
2. **Telemetry Verification**: Verify total registered users count, reflection volume aggregations, AI API latency monitor, and sanitized external notification logs.
3. **Role Validation**: If unauthenticated or non-admin, observe the unauthorized prompt; toggle admin privileges via the user management controls.

### Test Case 4: Zero-Knowledge Vault Locking & Unlocking
1. **Lock Vault**: Click the lock icon in the header.
2. **Unlock Flow**: Enter the master encryption password and verify PBKDF2 key derivation unlocks in-memory records.
3. **Past Self Semantic Search**: Query historical entries using local vector embeddings generated directly in-browser.

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Compile production bundle
npm run build
npm start
```
