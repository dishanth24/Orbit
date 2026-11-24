# Orbit — Know your **body**.

> **"Privacy you can see."**  
> Built for **wHACKiest 2026** (Track: *Know Thyself*).

Orbit is a privacy-first personal health intelligence app. It merges steps, sleep, resting heart rate, mood, and water logs from phone and watch CSV exports into a single cohesive timeline. It computes deterministic, explainable insights, issues timely proactive nudges, powers conversational queries ("Ask your data"), and guarantees absolute data sovereignty by showing users exactly what leaves the device before anything ever does.

---

## 🌟 Unique Selling Proposition (USP)

### **"Privacy you can see."**
- **100% On-Device Compute:** All biomarker correlations, trend analyses, and Orbit Scores are computed locally in an on-device SQLite database.
- **Transparent Aggregate Payload:** If the user chooses to generate an AI summary, Orbit creates an anonymized 7-number aggregate payload (`avg_steps`, `avg_sleep_hours`, `avg_resting_hr`, `steps_change_pct`, `short_sleep_nights`, `goal_streak_days`, `orbit_score`). **Zero timestamps, zero raw rows, zero personal identifiers.**
- **Gatekeeper Approval:** The payload preview is displayed live in syntax-highlighted JSON. It is never transmitted without one-time, explicit user approval.
- **Immutable Privacy Ledger:** Every single approval and outbound event is logged to a local, tamper-evident Privacy Ledger.
- **Data Sovereignty:** One-click JSON data export and permanent local data deletion.

---

## 🚀 Quickstart (Two Commands, Zero Errors)

Orbit runs out-of-the-box on a fresh clone with **zero API keys required**.

### 1. Start the Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*Backend runs on `http://localhost:8000` with automatic SQLite database initialization.*

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173` with a Vite reverse proxy forwarding `/api` requests to port `8000`.*

---

## 📱 Feature Highlights

1. **Orbit Hero & Score (0–100):**
   - Central glowing Orbit Score with an SVG progress ring and countdown easing.
   - Five interactive orbiting biomarker orbs (Steps, Sleep, Heart, Mood, Water) circling on an elliptical path. Orb size scales dynamically with percentage of goal.
2. **Bento Health Dashboard:**
   - Stat cards featuring big numbers, animated CountUp transitions, sparklines, and delta chips.
   - 7-day steps bar chart with dashed target line and rounded bar caps.
   - 7-day sleep duration area chart with goal target line and gradient fill.
3. **"Ask your data":**
   - Natural language conversational interface with typing rhythm, suggested query chips, and evidence strips displaying exact supporting data pills.
4. **Explainable Insights:**
   - Cross-metric findings (e.g., how short sleep nights directly impact next-day steps and resting HR).
   - "Why am I seeing this?" expander displaying the mathematical rule and exact numbers.
5. **Actionable Nudges:**
   - Proactive micro-interventions (e.g., step goal reminders, wind-down prompts).
   - Full support for snooze presets (1 hour, tonight, tomorrow), Web Speech API audio read-aloud, and native desktop notifications.
6. **Cross-Metric Trends:**
   - Interactive dual-axis composed chart comparing any two biomarkers over 7, 14, or 30 days.
7. **Privacy Ledger & Data Sovereignty:**
   - Live payload preview, AI summary approval flow with local fallback, immutable on-device ledger, one-click export, and full data wipe.

---

## 🛠️ Stack & Architecture

- **Frontend:** React 18, Vite, Plain CSS with design tokens (no Tailwind), `recharts`, `react-router-dom`, `lucide-react`.
- **Backend:** Python 3.11+, FastAPI, SQLite3 (stdlib), pandas, Pydantic, Uvicorn, pytest.
- **AI Integration (Optional):** Google Gemini (`gemini-2.5-flash`). If `GEMINI_API_KEY` is not provided or fails, Orbit gracefully falls back to its deterministic on-device summary engine with `"source": "local"`.
- **Theme Support:** Adaptive Mint-White & Deep Dark Aurora themes persisted in `localStorage`.
- **Accessibility:** Full `prefers-reduced-motion` compliance, accessible focus rings, and touch targets $\ge 44\text{px}$.

---

## 🧪 Testing & Verification

### Run Automated Backend Tests
Orbit comes with 46 unit and integration tests covering CSV parsing, alias normalization, BOM stripping, minutes-to-hours conversion, insight rules, score boundary constraints, and privacy payload verification:
```bash
cd backend
python -m pytest tests/ -v
```

### Run Smoke Test Script
```bash
# On Linux / macOS / Git Bash:
./scripts/smoke.sh

# On Windows PowerShell:
.\scripts\smoke.ps1
```

### Build Frontend Production Bundle
```bash
cd frontend
npm run build
```

---

## 📋 Honest Product Limits

1. **Import & Demo Only:** CSV file imports and preloaded realistic demo data only; no live background Bluetooth sync with physical wearables.
2. **Rule-Based Insights:** All health analysis is deterministic and mathematical.
3. **Not Medical Advice:** Orbit is an educational and personal intelligence tool, not a diagnostic medical device.
