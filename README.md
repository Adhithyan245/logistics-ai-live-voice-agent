# AI Voice Calling Agent for UPS Logistics

A high-performance, full-stack Voice Calling Agent simulation built for **United Parcel Service (UPS) Customer Support**. 

This application simulates an interactive voice call with a customer using advanced Gemini-powered natural language understanding. It features real-time Speech-to-Text translation, responsive agent conversation streaming, support ticket creation, and robust integration with **eight custom Mock Model Context Protocol (MCP) Servers** representing distinct regional logistics, exceptions, and claims platforms.

---

## 🌟 Key Features

- **Interactive Voice Simulator**: Live visual workspace depicting customer/agent interaction logs, audio waves, call durations, and status states (ringing, speaking, listening, held, escalated).
- **Tone Analysis & Adaptive Empathy**: Recognizes customer tones (e.g., calm, polite, worried, anxious, frustrated, angry) and adapts response style to de-escalate situations.
- **Strict Human Escalation Guardrails**:
  - The agent never automatically escalates to a supervisor without explicit consent.
  - If confidence is low or the issue requires a manual touch, the agent presents a choice:
    - **Option A**: Continue autonomously with the AI agent (and file a support ticket/claim under CRMSupportMCPServer).
    - **Option B**: Escalate immediately to a live human supervisor (using TelephonyEscalationServer).
  - Escalation only triggers if the customer explicitly selects **Option B**.
- **Unified Function Trace Logger**: A visual terminal showing real-time Model Context Protocol (MCP) tool execution, arguments passed, returns, and server-side responses.

---

## 🛠️ The 8 Mock MCP Servers & Integrated Tools

1. **CustomsLogisticsMCPServer**
   - `track_shipment`: Retrieves basic shipment metadata (carrier, status, origin, destination, ETA).
   - `package_deep_dive`: Analyzes granular temperature logs, GPS routing history, and customs freeze states.
2. **CRMSupportMCPServer**
   - `create_support_ticket`: Registers an official inquiry case under CRM tracking databases.
3. **TelephonyEscalationServer**
   - `escalate_to_human`: Places an outbound Twilio ring or routing trigger to a human manager.
4. **ShipmentStatusMCPServer**
   - `track_package`: Obtains deep tracking state/event timelines.
   - `locate_shipment`: Locates precise facilities or latitude/longitude GPS locks.
   - `confirm_arrival_times`: Confirms scheduled local arrival intervals and scanning times.
5. **DeliveryRescheduledMCPServer**
   - `update_eta`: Overrides estimated arrival times due to transport disruptions.
   - `reschedule_deliveries`: Re-routes specific slots (morning/afternoon/weekend holds).
6. **DeliveryExceptionsMCPServer**
   - `handle_failed_delivery`: Updates the system on redelivery, changes of address, or terminal holds.
   - `failed_access_attempt`: Records locked complex gate buzzer codes, codes/instructions to bypass exceptions.
7. **PickupMCPServer**
   - `schedule_pickup`: Schedules a commercial carrier pickup.
   - `cancel_pickup`: Revokes scheduled pickups.
8. **ClaimsSpecialMCPServer**
   - `file_insurance_claim`: Files moisture damage/derailment insurance cases.
   - `resolve_billing_issue`: Files fuel surcharge/billing disputes and applies supervisory credits.

---

## 🧪 Cargo Matrix Test Scenarios

You can test the agent's behaviors in the voice calling terminal using these specific cargo numbers:
- **TRK-STATUS-701** (Status & Facility Location check via `ShipmentStatusMCPServer`)
- **TRK-RESCHED-802** (Rescheduling weather-delayed shipments via `DeliveryRescheduledMCPServer`)
- **TRK-EXCEPT-903** (Access exceptions & logging buzzer code `4912` via `DeliveryExceptionsMCPServer`)
- **TRK-PICKUP-104** (Austin warehouse pickup scheduling & cancellations via `PickupMCPServer`)
- **TRK-CLAIM-205** (Liquid-soaked heavy freight claims & fuel surcharge disputes via `ClaimsSpecialMCPServer`)
- **TRK-9831420** (Robert Harrison - Misrouting & freeze hazards)
- **TRK-2410294** (Fiona Sterling - High-value temperature spikes)
- **TRK-5829104** (Luxury apparel - Missing commercial invoice)
- **TRK-8829014** (Automobile cargo - Train derailment accident)

---

## 🚀 Local Installation & Setup Guide

Ensure you have **Node.js (v18 or higher)** installed on your machine.

### 1. Install Dependencies
Install all the required standard and development dependencies using npm:
```bash
npm install
```

### 2. Set Up Environment Variables
Create a local `.env` configuration file by copying the template file:
```bash
cp .env.example .env
```
Open `.env` in your editor and configure your credentials:
```env
GEMINI_API_KEY="your-actual-gemini-api-key-here"
# Optional Twilio integrations (leave defaults for local UI simulation)
TWILIO_ACCOUNT_SID="MY_TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="MY_TWILIO_AUTH_TOKEN"
TWILIO_INBOUND_NUMBER="YOUR_TWILIO_NUMBER"
TWILIO_ESCALATION_NUMBER="YOUR_ESCALATION_NUMBER"
```

### 3. Run the Local Development Server
Launch the application in development mode (which utilizes `tsx` for TypeScript execution of the server):
```bash
npm run dev
```
The server will boot and run on `http://localhost:3000`. Open your browser and navigate there to interact with the full-stack interface.

### 4. Build & Start for Production
To bundle and compile the application for production release:
```bash
# Build the React frontend with Vite and the Express backend with esbuild
npm run build

# Start the compiled CommonJS server bundle
npm run start
```
