/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { INITIAL_SHIPMENTS, INITIAL_CASES } from './src/utils/mockData.ts';
import { Shipment, SupportCase, InteractionTrace, AgentConfig } from './src/types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());

// Main in-memory databases initialized from initial datasets
let shipmentsDB: Shipment[] = [...INITIAL_SHIPMENTS];
let casesDB: SupportCase[] = [...INITIAL_CASES];
let interactionTraces: InteractionTrace[] = [];

// Lazy loading for Gemini client
let geminiClientCache: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClientCache) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is not defined in the environment variables. Live voice features will fall back to simulation.");
    }
    geminiClientCache = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClientCache;
}

// Inbound customer support line configuration
const INBOUND_SUPPORT_NUMBER = process.env.TWILIO_INBOUND_NUMBER || "+16173974905";

// Define logistics tool schemas for Gemini Function Calling
const trackShipmentDeclaration = {
  name: "track_shipment",
  description: "Retrieve complete tracking, history, ETA, locations, notes, and carrier data for a specific shipment.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference starting with 'TRK-' (e.g. TRK-9831420)."
      }
    },
    required: ["trackingNumber"]
  }
};

const updateShippingNotesDeclaration = {
  name: "update_shipping_notes",
  description: "Append a custom note, delivery instructions, gate code, or custom directions to a specific tracking order.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference starting with 'TRK-' (e.g. TRK-9831420)."
      },
      notes: {
        type: Type.STRING,
        description: "The custom notes to be appended."
      }
    },
    required: ["trackingNumber", "notes"]
  }
};

const createSupportTicketDeclaration = {
  name: "create_support_ticket",
  description: "Create an official logistics support ticket for customer issues, lost packages, damage, or delivery delays.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The tracking number associated with the claim, if any."
      },
      customerName: {
        type: Type.STRING,
        description: "The caller's full name."
      },
      customerPhone: {
        type: Type.STRING,
        description: "The contact telephone number of the customer."
      },
      subject: {
        type: Type.STRING,
        description: "High-level summary of the issue (e.g., 'Delay concern', 'Damaged package')."
      },
      notes: {
        type: Type.STRING,
        description: "Specific details, context, or customer comments."
      }
    },
    required: ["customerName", "customerPhone", "subject", "notes"]
  }
};

const escalateToHumanDeclaration = {
  name: "escalate_to_human",
  description: "Initiate immediate connection and hot-handoff escalation to a senior human logistics coordinator, dispatching an outbound phone call with full chat context.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: {
        type: Type.STRING,
        description: "The caller's name."
      },
      customerPhone: {
        type: Type.STRING,
        description: "The caller's direct contact phone number for reference."
      },
      trackingNumber: {
        type: Type.STRING,
        description: "The active tracking reference context, if discussed."
      },
      reason: {
        type: Type.STRING,
        description: "The core reason for triggering escalation (e.g., 'Anxious about major rail delay', 'Upset with damage claim')."
      },
      summary: {
        type: Type.STRING,
        description: "A summary of what was discussed so far during this call, to be transmitted on-screen for the human agent."
      }
    },
    required: ["customerName", "customerPhone", "reason", "summary"]
  }
};

const packageDeepDiveDeclaration = {
  name: "package_deep_dive",
  description: "Perform an advanced deep-dive investigation into backend shipment data, sensor logs, temperature logs, route history, and customs details for a specific package.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference starting with 'TRK-' (e.g. TRK-9831420)."
      }
    },
    required: ["trackingNumber"]
  }
};

const PackageDeepDiveDeclaration = {
  name: "PackageDeepDive",
  description: "Perform an advanced deep-dive investigation into backend shipment data, sensor logs, temperature logs, route history, and customs details for a specific package.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference starting with 'TRK-' (e.g. TRK-9831420)."
      }
    },
    required: ["trackingNumber"]
  }
};

// --- NEW MCP SERVER FUNCTION DECLARATIONS ---

// 1. Shipment Status MCP Server Functions
const trackPackageDeclaration = {
  name: "track_package",
  description: "Retrieve complete tracking, history, ETA, locations, and status for a package. Maps to ShipmentStatusMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking number (e.g. TRK-STATUS-701)."
      }
    },
    required: ["trackingNumber"]
  }
};

const locateShipmentDeclaration = {
  name: "locate_shipment",
  description: "Retrieve the exact facility, routing gate, or GPS coordinates for a cargo package. Maps to ShipmentStatusMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference."
      }
    },
    required: ["trackingNumber"]
  }
};

const confirmArrivalTimeDeclaration = {
  name: "confirm_arrival_times",
  description: "Retrieve precise estimated arrival date, local hub scan times, and delivery window. Maps to ShipmentStatusMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking reference."
      }
    },
    required: ["trackingNumber"]
  }
};

// 2. Delivery Rescheduled MCP Server Functions
const updateEtaDeclaration = {
  name: "update_eta",
  description: "Update the expected arrival date/time for a package due to user request or routing adjustments. Maps to DeliveryRescheduledMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking number."
      },
      newEta: {
        type: Type.STRING,
        description: "The new requested ETA date-time string (e.g., '2026-06-28T10:00:00-07:00')."
      }
    },
    required: ["trackingNumber", "newEta"]
  }
};

const rescheduleDeliveriesDeclaration = {
  name: "reschedule_deliveries",
  description: "Reschedule shipment delivery to an alternative date, morning/afternoon slot, or delay period. Maps to DeliveryRescheduledMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking number."
      },
      requestedSlot: {
        type: Type.STRING,
        description: "Alternative date or time slot requested by customer."
      }
    },
    required: ["trackingNumber", "requestedSlot"]
  }
};

// 3. Delivery Exceptions MCP Server Functions
const handleFailedDeliveryDeclaration = {
  name: "handle_failed_delivery",
  description: "Manage missed deliveries or failed delivery attempts by selecting alternative delivery routes or holds. Maps to DeliveryExceptionsMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking number."
      },
      action: {
        type: Type.STRING,
        description: "Action requested: 'redeliver', 'hold_at_terminal', 'change_address'."
      }
    },
    required: ["trackingNumber", "action"]
  }
};

const failedAccessAttemptDeclaration = {
  name: "failed_access_attempt",
  description: "Log door codes, buzzer pins, gate instructions, or locked complex notes to bypass failed access attempts. Maps to DeliveryExceptionsMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The unique tracking number."
      },
      accessDetails: {
        type: Type.STRING,
        description: "Instructions or codes to resolve secure gate locked issues (e.g. 'Gate Code 4912')."
      }
    },
    required: ["trackingNumber", "accessDetails"]
  }
};

// 4. Pickup MCP Server Functions
const schedulePickupDeclaration = {
  name: "schedule_pickup",
  description: "Schedule a commercial or residential cargo package pickup from a sender address. Maps to PickupMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pickupAddress: {
        type: Type.STRING,
        description: "The full address for package pickup."
      },
      pickupTimeSlot: {
        type: Type.STRING,
        description: "Requested time slot for pickup (e.g., 'Morning 9AM-12PM')."
      },
      weight: {
        type: Type.STRING,
        description: "Approximate cargo weight (e.g. '5.5 kg')."
      }
    },
    required: ["pickupAddress", "pickupTimeSlot"]
  }
};

const cancelPickupDeclaration = {
  name: "cancel_pickup",
  description: "Cancel a previously scheduled pickup request using a pickup ID. Maps to PickupMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pickupId: {
        type: Type.STRING,
        description: "The pickup confirmation ID."
      }
    },
    required: ["pickupId"]
  }
};

// 5. Claims / Special MCP Server Functions
const fileInsuranceClaimDeclaration = {
  name: "file_insurance_claim",
  description: "Initiate cargo insurance claim for a damaged, ruined, wet, lost, or train-derailed shipment. Maps to ClaimsSpecialMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingNumber: {
        type: Type.STRING,
        description: "The tracking number associated with the claim."
      },
      customerName: {
        type: Type.STRING,
        description: "Full name of the claimant."
      },
      claimValue: {
        type: Type.STRING,
        description: "Requested monetary compensation value (e.g. '$1200')."
      },
      reason: {
        type: Type.STRING,
        description: "Detailed reason for compensation: 'damaged', 'lost_in_transit', 'ruined_temperature'."
      }
    },
    required: ["trackingNumber", "customerName", "claimValue", "reason"]
  }
};

const resolveBillingIssueDeclaration = {
  name: "resolve_billing_issue",
  description: "Review, file disputes, or log issues regarding shipping invoices, fuel surcharges, or incorrect billing. Maps to ClaimsSpecialMCPServer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      invoiceNumber: {
        type: Type.STRING,
        description: "The invoice ID or tracking reference under billing dispute."
      },
      disputeDetails: {
        type: Type.STRING,
        description: "Description of the invoice billing discrepancy."
      }
    },
    required: ["invoiceNumber", "disputeDetails"]
  }
};

function executePackageDeepDive(trackingNumber: string): any {
  const trk = trackingNumber?.toUpperCase()?.trim();
  if (!trk) {
    return { error: "A valid tracking number must be specified for deep-dive investigation." };
  }
  
  if (trk === "TRK-9831420") {
    return {
      trackingNumber: trk,
      status: "Investigated",
      mcpMessage: "CRITICAL ALERT: Package has been misrouted and is currently located at a cold storage terminal in Salt Lake City, UT Transit Hub. Electronics cargo is exposed to a severe freeze hazard (sub-zero temperatures). This routing error requires senior human intervention to redirect.",
      freezeHazard: true,
      currentLocation: "Salt Lake City, UT Transit Hub (Cold Storage Section)",
      recommendation: "Immediate escalation to senior support is required to initiate manual redirect procedures."
    };
  } else if (trk === "TRK-2410294") {
    return {
      trackingNumber: trk,
      status: "Investigated",
      mcpMessage: "CRITICAL LOG UPDATE: Temperature sensor logs indicate a severe and persistent temperature spike of 18°C occurred during the transit phase between Des Moines and the Barstow, CA Terminal. The temperature-controlled container threshold of 4-8°C was violated for over 14 hours. The organic agritech cargo is fully compromised and ruined.",
      temperatureViolation: true,
      peakTemperature: "18.2°C",
      allowedRange: "4.0°C - 8.0°C",
      recommendation: "Ruined cargo. Immediate escalation to handle damage claim and senior support options."
    };
  } else if (trk === "TRK-5829104") {
    return {
      trackingNumber: trk,
      status: "Investigated",
      mcpMessage: "HOLD NOTICE: Customs clearance has failed at Midtown Store Terminal. Official clearance logs show the shipment was flagged due to a missing commercial invoice. The cargo has been placed in secure storage and cannot proceed until a valid invoice is submitted.",
      customsHold: true,
      holdReason: "Missing Commercial Invoice",
      terminal: "Midtown Store Terminal (MST-4)",
      recommendation: "Ask customer to provide original commercial invoice. If the customer is unable or gets frustrated, escalate."
    };
  } else if (trk === "TRK-8829014") {
    return {
      trackingNumber: trk,
      status: "Investigated",
      mcpMessage: "CRITICAL ACCIDENT REPORT: Our investigation reveals this heavy freight container was involved in a severe regional train derailment near Fargo, ND Rail Yard. Container structural integrity was completely lost. The overweight automobile parts package is confirmed to be severely damaged and physically destroyed in the wreckage.",
      derailmentIncident: true,
      location: "Fargo, ND Rail Yard",
      cargoCondition: "Severely Damaged / Destroyed",
      recommendation: "Immediate escalation is required to initiate loss compensation procedures with senior coordinators."
    };
  } else {
    // Fallback for general tracking numbers
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      return {
        trackingNumber: trk,
        status: "Investigated",
        mcpMessage: `Standard package diagnostics complete for ${trk}. Current status is ${ship.status}. Last scanned at ${ship.history[0]?.location || 'N/A'}. No critical temperature or routing hazards detected in standard backend logs.`,
        recommendation: "Resolve standard inquiry or escalate if the client remains unsatisfied."
      };
    } else {
      return {
        error: `Tracking reference ${trk} was not found in the active registries. Cannot perform deep-dive.`
      };
    }
  }
}

function executeNewMCPTools(name: string, args: any): { toolResult: any; mcpServer: string } | null {
  let toolResult: any = null;
  let mcpServer = "";

  if (name === "track_package") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    toolResult = ship ? ship : { error: `Tracking reference ${trk} was not found in active registries.` };
    mcpServer = "ShipmentStatusMCPServer";
  }
  else if (name === "locate_shipment") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      const lastLoc = ship.history[0]?.location || "Transit Hub Gateway";
      const desc = ship.history[0]?.description || "En route";
      toolResult = {
        trackingNumber: trk,
        carrier: ship.carrier,
        status: ship.status,
        lastKnownLocation: lastLoc,
        locationDetails: `Scanned and verified at ${lastLoc} gateway. Event details: "${desc}".`,
        gpsCoordinates: trk === "TRK-STATUS-701" ? "Latitude 38.6272, Longitude -90.1978 (St. Louis Hub)" : "GPS Locked via standard routing nodes"
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "ShipmentStatusMCPServer";
  }
  else if (name === "confirm_arrival_times") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      toolResult = {
        trackingNumber: trk,
        carrier: ship.carrier,
        eta: ship.eta,
        deliveryWindow: "09:00 AM - 01:00 PM local time on schedule date",
        arrivalVerification: `Estimated arrival confirmed for ${new Date(ship.eta).toLocaleDateString()} ${new Date(ship.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "ShipmentStatusMCPServer";
  }
  else if (name === "update_eta") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const newEta = args.newEta as string;
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      ship.eta = newEta;
      ship.lastUpdated = new Date().toISOString();
      ship.history.unshift({
        timestamp: ship.lastUpdated,
        location: "Delivery Rescheduled Hub",
        description: `ETA updated via DeliveryRescheduledMCPServer to ${newEta}`
      });
      toolResult = {
        success: true,
        trackingNumber: trk,
        updatedEta: newEta,
        carrier: ship.carrier,
        status: ship.status
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "DeliveryRescheduledMCPServer";
  }
  else if (name === "reschedule_deliveries") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const slot = args.requestedSlot as string;
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      ship.lastUpdated = new Date().toISOString();
      ship.history.unshift({
        timestamp: ship.lastUpdated,
        location: "Delivery Rescheduled Hub",
        description: `Delivery rescheduled via DeliveryRescheduledMCPServer to slot: ${slot}`
      });
      toolResult = {
        success: true,
        trackingNumber: trk,
        scheduledSlot: slot,
        status: "Rescheduled",
        confirmation: "The courier dispatcher has locked in this delivery time slot successfully."
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "DeliveryRescheduledMCPServer";
  }
  else if (name === "handle_failed_delivery") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const act = args.action as string;
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      ship.status = act === 'hold_at_terminal' ? 'held' : 'in_transit';
      ship.lastUpdated = new Date().toISOString();
      ship.history.unshift({
        timestamp: ship.lastUpdated,
        location: "Delivery Exceptions Terminal",
        description: `Failed delivery exception resolved via DeliveryExceptionsMCPServer: designated action "${act}"`
      });
      toolResult = {
        success: true,
        trackingNumber: trk,
        status: ship.status,
        actionTaken: act,
        message: `Exception logged. Delivery agent instructions updated for tracking reference ${trk}.`
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "DeliveryExceptionsMCPServer";
  }
  else if (name === "failed_access_attempt") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const details = args.accessDetails as string;
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      ship.notes = ship.notes ? `${ship.notes} | Access: ${details}` : `Access: ${details}`;
      ship.lastUpdated = new Date().toISOString();
      ship.history.unshift({
        timestamp: ship.lastUpdated,
        location: "Delivery Exceptions Terminal",
        description: `Gate instructions updated via DeliveryExceptionsMCPServer: ${details}`
      });
      toolResult = {
        success: true,
        trackingNumber: trk,
        loggedAccessDetails: details,
        message: "Gate / buzzer PIN successfully registered. Next delivery attempt scheduled."
      };
    } else {
      toolResult = { error: `Shipment ${trk} not found.` };
    }
    mcpServer = "DeliveryExceptionsMCPServer";
  }
  else if (name === "schedule_pickup") {
    const pickupId = `PKP-${Math.floor(Math.random() * 90000 + 10000)}`;
    toolResult = {
      success: true,
      pickupId,
      pickupAddress: args.pickupAddress,
      pickupTimeSlot: args.pickupTimeSlot,
      weight: args.weight || "N/A",
      status: "Scheduled",
      carrierAssigned: "UPS Ground Pickup Fleet",
      message: "Pickup appointment successfully created under PickupMCPServer controller."
    };
    mcpServer = "PickupMCPServer";
  }
  else if (name === "cancel_pickup") {
    toolResult = {
      success: true,
      pickupId: args.pickupId,
      status: "Cancelled",
      message: "Scheduled courier pickup cancellation confirmed under PickupMCPServer controller."
    };
    mcpServer = "PickupMCPServer";
  }
  else if (name === "file_insurance_claim") {
    const trk = (args.trackingNumber as string)?.toUpperCase()?.trim();
    const claimId = `CLM-${Math.floor(Math.random() * 90000 + 10000)}`;
    const ship = shipmentsDB.find(s => s.trackingNumber === trk);
    if (ship) {
      ship.status = 'damaged';
      ship.notes = ship.notes ? `${ship.notes} | Insurance Claim ${claimId} Filed` : `Insurance Claim ${claimId} Filed`;
      ship.lastUpdated = new Date().toISOString();
      ship.history.unshift({
        timestamp: ship.lastUpdated,
        location: "Claims Processing Bureau",
        description: `Official cargo insurance claim filed under ID: ${claimId}. Value: ${args.claimValue}. Reason: ${args.reason}.`
      });
    }
    toolResult = {
      success: true,
      claimId,
      trackingNumber: trk,
      customerName: args.customerName,
      claimValue: args.claimValue,
      reason: args.reason,
      claimStatus: "Submitted & Auditing under ClaimsSpecialMCPServer"
    };
    mcpServer = "ClaimsSpecialMCPServer";
  }
  else if (name === "resolve_billing_issue") {
    toolResult = {
      success: true,
      invoiceNumber: args.invoiceNumber,
      disputeDetails: args.disputeDetails,
      resolutionStatus: "Pending Audit under ClaimsSpecialMCPServer",
      billingCreditApplied: "$45.00",
      resolutionNotice: "Surcharge dispute filed successfully. A supervisor credit of $45 has been provisionally applied."
    };
    mcpServer = "ClaimsSpecialMCPServer";
  }

  if (mcpServer) {
    return { toolResult, mcpServer };
  }
  return null;
}

// --- REST ENDPOINTS ---

// Get current database status
app.get('/api/shipments', (req, res) => {
  res.json(shipmentsDB);
});

app.get('/api/cases', (req, res) => {
  res.json(casesDB);
});

app.get('/api/traces', (req, res) => {
  res.json(interactionTraces);
});

// Health check endpoint returning status ok and APP_URL
app.get('/api/health', (req, res) => {
  res.json({
    status: "ok",
    APP_URL: process.env.APP_URL || 'https://morbidity-ocean-removal.ngrok-free.dev'
  });
});

// Outbound TwiML instructions provider
app.all('/api/twiml', (req, res) => {
  res.setHeader('Content-Type', 'text/xml');
  console.log(`[TWIML REQ] Method: ${req.method}, Headers: ${JSON.stringify(req.headers)}, Query: ${JSON.stringify(req.query)}`);
  
  const customerName = (req.query.customerName as string) || (req.body.customerName as string) || 'Customer';
  const customerPhone = (req.query.customerPhone as string) || (req.body.customerPhone as string) || '';
  const reason = (req.query.reason as string) || (req.body.reason as string) || 'Logistics Escalation';
  const summary = (req.query.summary as string) || (req.body.summary as string) || '';
  const targetNumber = (req.query.targetNumber as string) || (req.body.targetNumber as string) || '';

  const cleanNum = (num: string) => num.replace(/\D/g, '');
  const cleanCustomer = cleanNum(customerPhone);
  const cleanTarget = cleanNum(targetNumber || process.env.TWILIO_ESCALATION_NUMBER || '919952989679');

  const isLoop = cleanCustomer !== '' && cleanTarget !== '' && (cleanCustomer === cleanTarget);
  const isInboundFallback = cleanCustomer.includes('6173974905') || cleanCustomer === '';

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  if (isLoop || !customerPhone || customerPhone === 'undefined' || isInboundFallback) {
    twiml += `  <Say voice="alice">Hello Supervisor. The Logistics AI Agent has triggered a hot handoff escalation for client ${customerName}. The customer has reported the following concern: ${reason}. Summary is: ${summary}. Please check your active supervisor dashboard system to review the complete diagnostic trace logs.</Say>\n`;
  } else {
    twiml += `  <Say voice="alice">Please hold call supervisor, you are being connected to ${customerName} at ${customerPhone}.</Say>\n`;
    twiml += `  <Dial>${customerPhone}</Dial>\n`;
  }
  twiml += `</Response>`;
  
  res.send(twiml);
});

// Outbound Handoff Escalation API
app.post('/api/escalate', async (req, res) => {
  const { customerName, customerPhone, trackingNumber, reason, summary, targetNumber } = req.body;
  
  let appUrl = process.env.APP_URL;
  if (!appUrl || appUrl.includes('morbidity-ocean-removal') || appUrl === '') {
    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    appUrl = `${protocol}://${req.get('host')}`;
  }
  
  const activeShipment = trackingNumber ? shipmentsDB.find(s => s.trackingNumber === trackingNumber) : null;

  // Resolve caller phone number from casesDB, shipment info, or fallback to inbound Twilio customer support line (E.164: +16173974905)
  let resolvedCustomerPhone = customerPhone;
  if (!resolvedCustomerPhone || resolvedCustomerPhone.trim() === "" || resolvedCustomerPhone === "undefined") {
    const anyCase = casesDB.find(c => c.customerPhone && c.customerPhone.trim() !== "");
    if (anyCase) {
      resolvedCustomerPhone = anyCase.customerPhone;
    } else {
      resolvedCustomerPhone = "+16173974905";
    }
  }

  const twilioEscalationNumber = process.env.TWILIO_ESCALATION_NUMBER || "+919952989679";
  const destination = targetNumber || twilioEscalationNumber;

  const paramName = encodeURIComponent(customerName || 'Customer');
  const paramPhone = encodeURIComponent(resolvedCustomerPhone || '');
  const paramReason = encodeURIComponent(reason || 'Logistics Escalation');
  const paramSummary = encodeURIComponent(summary || '');
  const paramTarget = encodeURIComponent(destination || '');

  const twimlUrl = `${appUrl}/api/twiml?customerName=${paramName}&customerPhone=${paramPhone}&reason=${paramReason}&summary=${paramSummary}&targetNumber=${paramTarget}`;
  console.log(`Constructed twimlUrl: ${twimlUrl}`);

  console.log(`[ESCALATION RECEIVED] Handing off to human coordinator at: ${destination}`);
  console.log(`[CONTEXT] Caller: ${customerName} (${resolvedCustomerPhone}), Tracking: ${trackingNumber || 'None'}`);
  console.log(`[REASON] ${reason}`);
  console.log(`[SUMMARY] ${summary}`);

  // Create an automated ticket with status 'escalated'
  const newCaseId = `case-${Date.now().toString().slice(-4)}`;
  const escalatedCase: SupportCase = {
    id: newCaseId,
    shipmentId: activeShipment?.id,
    subject: `Escalated: ${reason}`,
    customerName: customerName || "Inbound Caller",
    customerPhone: resolvedCustomerPhone,
    status: 'escalated',
    createdTime: new Date().toISOString(),
    notes: `Handoff Session summary: ${summary}`
  };
  casesDB.unshift(escalatedCase);

  const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioInboundNumber = process.env.TWILIO_INBOUND_NUMBER || "+16173974905";

  const maskToken = (token?: string) => {
    if (!token) return 'undefined';
    if (token.length <= 4) return token;
    return '*'.repeat(token.length - 4) + token.slice(-4);
  };

  const isConfigured = twilioSidEnv && twilioSidEnv !== "" && twilioAuthToken && twilioAuthToken !== "" &&
    twilioSidEnv !== "MY_TWILIO_ACCOUNT_SID" && twilioAuthToken !== "MY_TWILIO_AUTH_TOKEN" &&
    twilioSidEnv !== "MOCK_SID" && twilioAuthToken !== "MOCK_TOKEN";

  if (!isConfigured) {
    console.warn(`[TWILIO WARNING] Twilio credentials missing or mock. Falling back to outbound simulation dispatcher.`);
    return res.json({
      success: true,
      caseId: newCaseId,
      twilioStatus: "simulated",
      twilioSid: `MOCK-${Date.now().toString().slice(-6)}`,
      escalationDetails: escalatedCase,
      isSimulated: true,
      twimlUrl: twimlUrl,
      warning: "Twilio not configured"
    });
  }

  // Masked console logging BEFORE dispatching Twilio create api call (Bug 2)
  console.log(`[TWILIO DIAGNOSTICS] TWILIO_ACCOUNT_SID: ${twilioSidEnv}, TWILIO_AUTH_TOKEN: ${maskToken(twilioAuthToken)}, TWILIO_INBOUND_NUMBER: ${twilioInboundNumber}, TWILIO_ESCALATION_NUMBER: ${twilioEscalationNumber}`);

  try {
    // Lazy instance twilio package inside function at call time (Bug 2)
    console.log(`Lazy instantiating Twilio Client for destination: ${destination}...`);
    const twilioModule = await import('twilio');
    const client = twilioModule.default(twilioSidEnv, twilioAuthToken);

    console.log(`Dispatching call with twimlUrl: ${twimlUrl}`);
    const outboundCall = await client.calls.create({
      url: twimlUrl,
      to: destination,
      from: twilioInboundNumber,
      method: 'GET'
    });

    console.log(`[TWILIO SUCCESS] Twilio outbound call created successfully! SID: ${outboundCall.sid}`);
    console.log(`[TWILIO PAYLOAD] Outbound call API response:`, JSON.stringify(outboundCall, null, 2));

    return res.json({
      success: true,
      caseId: newCaseId,
      twilioStatus: "initiated",
      twilioSid: outboundCall.sid,
      escalationDetails: escalatedCase,
      twimlUrl: twimlUrl
    });

  } catch (error: any) {
    console.error("[TWILIO FAILURE DETECTED] Failed to dispatch real Twilio call routing request!");
    console.error("[TWILIO ERROR DETAILS] Complete error object:", error);

    return res.status(500).json({
      success: false,
      error: `Twilio gateway failed: ${error.message || error}`,
      caseId: newCaseId,
      twilioStatus: "failed",
      twilioSid: `FAIL-${Date.now().toString().slice(-6)}`,
      escalationDetails: escalatedCase,
      twimlUrl: twimlUrl
    });
  }
});

// Chat Tool Loop Orchestration Endpoint (MCP Emulator)
app.post('/api/gemini/chat', async (req, res) => {
  const { prompt, currentContext, systemInstruction, voiceSelection, history } = req.body;
  console.log(`[API CHAT] User: "${prompt}"`);

  const ai = getGeminiClient();
  const apiKey = process.env.GEMINI_API_KEY;

  let currentQuery = prompt;
  let traceLog: { mcpServer: string; tool: string; params: string; response: string } | null = null;

  try {
    // 1. Check if we have an API Key present
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "MOCK_KEY") {
      // In simulation fallback when no real key is configured, perform a lightweight manual parse to keep tools working!
      console.log("No valid Gemini API key. Running locally styled rule parser...");
      let responseText = "I apologize, but my live systems are starting up. How can I assist you?";
      
      const lower = prompt.toLowerCase();
      const isFrustrated = lower.includes('frustrated') || lower.includes('angry') || lower.includes('upset') || lower.includes('mad') || lower.includes('annoyed');
      const isFollowUp = lower.includes('why') || lower.includes('detail') || lower.includes('deep dive') || lower.includes('sensor') || lower.includes('logs') || lower.includes('hazard') || lower.includes('accident') || lower.includes('happen');

      // Check if a tracking number is in the prompt or in history
      let foundTrk = lower.match(/trk-\d+/i)?.[0]?.toUpperCase();
      if (!foundTrk && history && history.length > 0) {
        for (const msg of history) {
          const m = msg.text.toLowerCase().match(/trk-\d+/i);
          if (m) {
            foundTrk = m[0].toUpperCase();
            break;
          }
        }
      }
      if (!foundTrk) {
        foundTrk = "TRK-9831420"; // default fallback for test cases
      }

      // Check history to see if track_shipment was already called for this tracking number
      let hasTrackedBefore = false;
      if (history && history.length > 0) {
        hasTrackedBefore = history.some((msg: any) => msg.text.toLowerCase().includes('retrieved shipment') || msg.text.toLowerCase().includes('status is') || msg.text.toLowerCase().includes('retrieved the basic shipment'));
      }

      // Determine if choices were previously presented to the customer in this session
      const prevAgentMsg = history && history.length > 0 
        ? [...history].reverse().find((msg: any) => msg.role === 'agent' || msg.role === 'model') 
        : null;
      const choicesWerePresented = prevAgentMsg && (
        prevAgentMsg.text.includes('Option A') || 
        prevAgentMsg.text.includes('Which option would you prefer') ||
        prevAgentMsg.text.includes('Which of these options would you prefer')
      );

      // Determine tone and add tone acknowledgment
      let toneNote = "I notice you are speaking in a calm and cooperative tone.";
      if (isFrustrated) {
        toneNote = "I notice that you are speaking in a frustrated and upset tone.";
      } else if (lower.includes('worry') || lower.includes('anxious') || lower.includes('fear') || lower.includes('scared') || lower.includes('urgent')) {
        toneNote = "I notice you are speaking in an anxious and concerned tone.";
      }

      const isComplex = ["TRK-9831420", "TRK-2410294", "TRK-5829104", "TRK-8829014", "TRK-CLAIM-205"].includes(foundTrk);

      // Check explicit selections when options are active
      const explicitlyRequestsEscalation = choicesWerePresented && (
        lower.includes('option b') || 
        lower.includes('escalate') || 
        lower.includes('human') || 
        lower.includes('supervisor') || 
        lower.includes('manager')
      );

      const explicitlyRequestsTicket = lower.includes('option a') || (choicesWerePresented && (
        lower.includes('ticket') || 
        lower.includes('create support') || 
        lower.includes('raise a ticket') || 
        lower.includes('file a claim') ||
        lower.includes('continue with ai')
      ));

      if (explicitlyRequestsEscalation) {
        // Escalate only on explicit selection of Option B
        const newTicketId = `case-${Date.now().toString().slice(-4)}`;
        traceLog = {
          mcpServer: "TelephonyEscalationServer",
          tool: "escalate_to_human",
          params: JSON.stringify({ customerName: "Robert Harrison", customerPhone: "+16173974905", reason: "Upset with transport delays", summary: "Handoff triggered." }),
          response: JSON.stringify({ escalationStatus: "simulated-handoff", caseId: newTicketId })
        };
        responseText = `${toneNote} I understand. I am escalating this call immediately to our Logistics Dispatch Manager (Option B). An outbound phone ring is being generated to their desk now. Please remain on the line!`;
      } else if (explicitlyRequestsTicket) {
        // Handle Option A
        const newTicketId = `case-${Date.now().toString().slice(-4)}`;
        const testCase: SupportCase = {
          id: newTicketId,
          subject: "Damaged cargo or delay grievance",
          customerName: "Robert Harrison",
          customerPhone: "+16173974905",
          status: 'open',
          createdTime: new Date().toISOString(),
          notes: `Created automatically by Voice Assistant: ${prompt}`
        };
        casesDB.unshift(testCase);
        traceLog = {
          mcpServer: "CRMSupportMCPServer",
          tool: "create_support_ticket",
          params: JSON.stringify({ customerName: "Robert Harrison", customerPhone: "+16173974905", subject: "Inquiry via Voice Assistance", notes: prompt }),
          response: JSON.stringify(testCase)
        };
        responseText = `${toneNote} Certainly! I have selected Option A. I have successfully raised an official support ticket for you under reference ${newTicketId} and will continue handling this autonomously.`;
      } else if ((isFrustrated || isFollowUp || hasTrackedBefore) && (lower.includes('track') || lower.includes('trk') || lower.includes('package') || lower.includes('shipment') || lower.includes('why') || lower.includes('detail') || lower.includes('deep dive') || lower.includes('sensor') || lower.includes('logs') || lower.includes('hazard') || lower.includes('accident'))) {
        // Trigger package_deep_dive
        const deepDiveResult = executePackageDeepDive(foundTrk);
        traceLog = {
          mcpServer: "CustomsLogisticsMCPServer",
          tool: "package_deep_dive",
          params: JSON.stringify({ trackingNumber: foundTrk }),
          response: JSON.stringify(deepDiveResult)
        };

        if (isComplex) {
          responseText = `${toneNote} I have run an advanced deep-dive investigation. ${deepDiveResult.mcpMessage || "I'm checking the logs."} Because this issue requires special handling, my resolution confidence is incomplete. I can present the following options:
Option A: Continue with AI agent resolution attempt (I can raise an official support ticket to file a claim).
Option B: Escalate to human support.
Which option would you prefer?`;
        } else {
          responseText = `${toneNote} I've initiated an advanced deep-dive investigation on ${foundTrk}. Here are the backend logs: ${deepDiveResult.mcpMessage || "No additional logs found."}`;
        }
      } else if (lower.includes('track') || lower.includes('trk') || lower.includes('package') || lower.includes('shipment')) {
        // Standard initial track_shipment tool call
        const ship = shipmentsDB.find(s => s.trackingNumber === foundTrk || s.trackingNumber.toLowerCase().includes(foundTrk.toLowerCase()));
        traceLog = {
          mcpServer: "CustomsLogisticsMCPServer",
          tool: "track_shipment",
          params: JSON.stringify({ trackingNumber: foundTrk }),
          response: ship ? JSON.stringify(ship) : JSON.stringify({ error: "Shipment not found in registry" })
        };

        if (ship) {
          responseText = `${toneNote} I have retrieved the basic shipment info for ${foundTrk}. The status is ${ship.status.replace('_', ' ')}. It is currently handled by ${ship.carrier} with a scheduled arrival of ${new Date(ship.eta).toLocaleDateString()}. The latest event was at the ${ship.history[0]?.location}, stating: "${ship.history[0]?.description}".`;
        } else {
          responseText = `${toneNote} I looked up that tracking reference ${foundTrk} in the logistics customs server, but unfortunately, there are no shipment matches. Let me know if you would like me to check order ranges.`;
        }
      } else if (lower.includes('note') || lower.includes('appended') || lower.includes('append')) {
        const noteText = prompt.substring(prompt.indexOf('note') + 4).trim() || "Add gate code 2441";
        const ship = shipmentsDB.find(s => s.trackingNumber === foundTrk);
        if (ship) {
          ship.notes = `${ship.notes ? ship.notes + ' | ' : ''}${noteText}`;
          ship.lastUpdated = new Date().toISOString();
          ship.history.unshift({
            timestamp: ship.lastUpdated,
            location: "Customer Services",
            description: `Customer note added: ${noteText}`
          });
          traceLog = {
            mcpServer: "CustomsLogisticsMCPServer",
            tool: "update_shipping_notes",
            params: JSON.stringify({ trackingNumber: foundTrk, notes: noteText }),
            response: JSON.stringify({ success: true, trackingNumber: foundTrk, updatedNotes: ship.notes })
          };
          responseText = `I have successfully updated the delivery documentation for ${foundTrk}. I added the note: "${noteText}". Our courier dispatcher will see this immediately.`;
        } else {
          responseText = `I tried updating the notes, but I couldn't find a shipment matching ${foundTrk}.`;
        }
      } else {
        if (isFrustrated) {
          responseText = `${toneNote} I know you are frustrated but this is what I can do: I can either help you raise an official support ticket (Option A) or escalate you to a live human customer support agent (Option B). Escalation is entirely your choice. Which option would you prefer?`;
        } else if (choicesWerePresented) {
          responseText = `${toneNote} To proceed, please let me know which of the options you would prefer: Option A to continue autonomously and open a ticket, or Option B to escalate to a live human supervisor.`;
        } else {
          responseText = `${toneNote} Hello! I am your Logistics Voice Assistant. I can track shipments, update cargo instructions, draft support tickets, or connect you to our dispatch unit. For example, you can say 'What is the status of shipment TRK-9831420?'.`;
        }
      }

      // Log the trace
      if (traceLog) {
        const finalTrace: InteractionTrace = {
          id: `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          query: currentQuery,
          mcpServer: traceLog.mcpServer,
          tool: traceLog.tool,
          params: traceLog.params,
          response: traceLog.response
        };
        interactionTraces.unshift(finalTrace);
      }

      // Generate a mock response package
      return res.json({
        text: responseText,
        trace: traceLog ? {
          mcpServer: traceLog.mcpServer,
          tool: traceLog.tool,
          params: JSON.parse(traceLog.params),
          response: JSON.parse(traceLog.response)
        } : null,
        audio: null // Will construct simulated TTS on client side using Web Speech synthesizer
      });
    }

    // 2. Real API Flow with built-in tool config
    console.log("Valid GEMINI_API_KEY found, invoking ai.models.generateContent with function declarations...");
    
    // Convert history into GoogleGenAI standard Content objects
    const contentsPayload = history && history.length > 0 
      ? history.map((m: any) => ({
          role: m.role === 'agent' ? 'model' : m.role,
          parts: [{ text: m.text }]
        }))
      : [];
    
    // Add the current prompt
    contentsPayload.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contentsPayload,
      config: {
        systemInstruction: systemInstruction || "You are a United Parcel Service customer support representative. Keep spoken replies brief and highly professional.",
        temperature: 0.2, // low temperature for precise function execution
        tools: [
          {
            functionDeclarations: [
              trackShipmentDeclaration,
              updateShippingNotesDeclaration,
              createSupportTicketDeclaration,
              escalateToHumanDeclaration,
              packageDeepDiveDeclaration,
              PackageDeepDiveDeclaration,
              trackPackageDeclaration,
              locateShipmentDeclaration,
              confirmArrivalTimeDeclaration,
              updateEtaDeclaration,
              rescheduleDeliveriesDeclaration,
              handleFailedDeliveryDeclaration,
              failedAccessAttemptDeclaration,
              schedulePickupDeclaration,
              cancelPickupDeclaration,
              fileInsuranceClaimDeclaration,
              resolveBillingIssueDeclaration
            ]
          }
        ]
      }
    });

    let finalReply = response.text || "";
    let functionTrace: any = null;

    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const { name, args } = call;
      console.log(`[FUNCTION CALL DETECTED] ${name}:`, args);

      let toolResult: any = null;
      let mcpServer = "CustomsLogisticsMCPServer";

      // Execute requested logistics tool on the in-memory database
      if (name === "track_shipment") {
        const trk = (args.trackingNumber as string)?.toUpperCase();
        const ship = shipmentsDB.find(s => s.trackingNumber === trk);
        toolResult = ship ? ship : { error: `Tracking reference ${trk} was not found in active registries.` };
      } 
      else if (name === "update_shipping_notes") {
        const trk = (args.trackingNumber as string)?.toUpperCase();
        const customNote = args.notes as string;
        const ship = shipmentsDB.find(s => s.trackingNumber === trk);
        if (ship) {
          ship.notes = ship.notes ? `${ship.notes} | ${customNote}` : customNote;
          ship.lastUpdated = new Date().toISOString();
          ship.history.unshift({
            timestamp: ship.lastUpdated,
            location: "Customer Services Desk",
            description: `Document updated: ${customNote}`
          });
          toolResult = { success: true, trackingNumber: trk, updatedNotes: ship.notes };
        } else {
          toolResult = { error: `Shipment ${trk} not found.` };
        }
      } 
      else if (name === "create_support_ticket") {
        const ticketId = `case-${Date.now().toString().slice(-4)}`;
        const testCase: SupportCase = {
          id: ticketId,
          shipmentId: args.trackingNumber ? shipmentsDB.find(s => s.trackingNumber === args.trackingNumber)?.id : undefined,
          subject: args.subject as string,
          customerName: args.customerName as string,
          customerPhone: args.customerPhone as string,
          status: 'open',
          createdTime: new Date().toISOString(),
          notes: args.notes as string
        };
        casesDB.unshift(testCase);
        toolResult = testCase;
        mcpServer = "CRMSupportMCPServer";
      } 
      else if (name === "escalate_to_human") {
        const ticketId = `case-${Date.now().toString().slice(-4)}`;
        toolResult = {
          escalationStatus: "handoff_initiated",
          caseId: ticketId,
          message: "Hot-telephony outbound ring successfully queued to human logistics panel."
        };
        mcpServer = "TelephonyEscalationServer";
      }
      else if (name === "package_deep_dive" || name === "PackageDeepDive") {
        const trk = args.trackingNumber as string;
        toolResult = executePackageDeepDive(trk);
        mcpServer = "CustomsLogisticsMCPServer";
      }
      else {
        const mcpRes = executeNewMCPTools(name, args);
        if (mcpRes) {
          toolResult = mcpRes.toolResult;
          mcpServer = mcpRes.mcpServer;
        }
      }

      // Log Interaction Trace
      functionTrace = {
        id: `trace-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        query: currentQuery,
        mcpServer,
        tool: name,
        params: args,
        response: toolResult
      };
      
      interactionTraces.unshift(functionTrace);

      // Now send the tool result back to Gemini so it can formulate the final natural spoken response!
      const previousContent = response.candidates?.[0]?.content;
      const toolResponsePart = {
        functionResponse: {
          name,
          response: { result: toolResult }
        }
      };

      const secondRunResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          ...contentsPayload,
          previousContent,
          {
            role: 'user', // representing tool output response
            parts: [toolResponsePart]
          }
        ],
        config: {
          systemInstruction: systemInstruction || "You are a United Parcel Service customer support representative. Keep spoken replies brief and highly professional.",
        }
      });

      finalReply = secondRunResponse.text || "";
    }

    // 3. Optional: Generate speech for the reply in high fidelity using gemini-3.1-flash-tts-preview
    let base64Audio: string | null = null;
    try {
      console.log(`Generating TTS audio voice payload with model gemini-3.1-flash-tts-preview & voice: ${voiceSelection || 'Zephyr'}...`);
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say clearly: ${finalReply}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceSelection || 'Zephyr' },
            },
          },
        },
      });

      base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      console.log("Speech payload compiled standard sample 24000 PCM successfully!");
    } catch (ttsErr) {
      console.warn("Speech synthesis model errored or was busy:", ttsErr);
    }

    res.json({
      text: finalReply,
      trace: functionTrace ? {
        mcpServer: functionTrace.mcpServer,
        tool: functionTrace.tool,
        params: functionTrace.params,
        response: functionTrace.response
      } : null,
      audio: base64Audio
    });

  } catch (err: any) {
    console.error("Gemini Chat controller exception:", err);
    res.status(500).json({ error: err.message || "An error occurred dialoguing with safety protocols." });
  }
});

// --- MAIN SERVER RUN ---
const server = http.createServer(app);

// Initialize WebSocket server (bridges raw audio in-case the user connects with a true Live Handshake!)
const wss = new WebSocketServer({ noServer: true });

// Handle standard HTTP Upgrade for WebSocket on port 3000
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[WEBSOCKET CONNECTION] Client connected to live audio socket bridge.');
  let geminiSession: any = null;
  let activeVoiceName = 'Puck'; // default voice of the session setup is Puck

  let isGeminiInitialized = false;
  const connectionTimeout = setTimeout(() => {
    if (!isGeminiInitialized && clientWs.readyState === WebSocket.OPEN) {
      console.log("[CONNECTION TIMEOUT] Gemini Live session failed to initialize within 10 seconds. Closing connection cleanly.");
      try {
        clientWs.send(JSON.stringify({
          type: 'error',
          message: 'Gemini Live Session initialization timed out after 10 seconds.'
        }));
        clientWs.close(1008, "handshake_timeout");
      } catch (e) {}
    }
  }, 10000);

  // Dedicated function for transcript emission
  const emitTranscript = (role: 'user' | 'agent', text: string) => {
    const transcriptObj = {
      type: 'transcript',
      role,
      text,
      timestamp: Date.now()
    };
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(transcriptObj));
      console.log(`Transcript emitted: role=${role} text=${text}`);
    }
  };

  // Helper to cleanly create/re-create a Gemini session
  const startGeminiLive = async (voiceName: string, systemInstruction: string) => {
    // 1. Session Guard: Ensure there is only ever one active Gemini Live session
    if (geminiSession) {
      console.log(`[SESSION GUARD] Tearing down active Gemini Live session before starting new one.`);
      try {
        await geminiSession.close();
      } catch (e) {
        console.error("Error closing old gemini session:", e);
      }
      geminiSession = null;
    }

    const ai = getGeminiClient();
    const resolvedVoice = voiceName || activeVoiceName || 'Puck';
    
    // 2. Console log confirming which single voice name is being used (Bug 5)
    console.log(`[VERIFICATION] Starting Gemini Live API connection. Using single voice: ${resolvedVoice}`);

    try {
      geminiSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: resolvedVoice } },
          },
          systemInstruction: systemInstruction || "You are a United Parcel Service customer support representative. Keep spoken replies brief and highly professional.",
          automaticActivityDetection: {
            silenceDurationMs: 300,
            silence_duration_ms: 300
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                trackShipmentDeclaration,
                updateShippingNotesDeclaration,
                createSupportTicketDeclaration,
                escalateToHumanDeclaration,
                packageDeepDiveDeclaration,
                PackageDeepDiveDeclaration,
                trackPackageDeclaration,
                locateShipmentDeclaration,
                confirmArrivalTimeDeclaration,
                updateEtaDeclaration,
                rescheduleDeliveriesDeclaration,
                handleFailedDeliveryDeclaration,
                failedAccessAttemptDeclaration,
                schedulePickupDeclaration,
                cancelPickupDeclaration,
                fileInsuranceClaimDeclaration,
                resolveBillingIssueDeclaration
              ]
            }
          ]
        } as any,
        callbacks: {
          onmessage: async (msg: any) => {
            // Check for tool calls first:
            if (msg.toolCall?.functionCalls?.length > 0) {
              const responses: any[] = [];
              
              for (const call of msg.toolCall.functionCalls) {
                const name = call.name;
                const args = call.args || call.arguments;
                const callId = call.id;
                console.log(`[LIVE WEBSOCKET FUNCTION CALL] Received: ${name}`, args);
                
                let toolResult: any = null;
                let mcpServer = "CustomsLogisticsMCPServer";

                if (name === "track_shipment") {
                  const trk = (args.trackingNumber as string)?.toUpperCase();
                  const ship = shipmentsDB.find(s => s.trackingNumber === trk);
                  toolResult = ship ? ship : { error: `Tracking reference ${trk} was not found in active registries.` };
                }
                else if (name === "update_shipping_notes") {
                  const trk = (args.trackingNumber as string)?.toUpperCase();
                  const customNote = args.notes as string;
                  const ship = shipmentsDB.find(s => s.trackingNumber === trk);
                  if (ship) {
                    ship.notes = ship.notes ? `${ship.notes} | ${customNote}` : customNote;
                    ship.lastUpdated = new Date().toISOString();
                    ship.history.unshift({
                      timestamp: ship.lastUpdated,
                      location: "Customer Services Desk",
                      description: `Document updated: ${customNote}`
                    });
                    toolResult = { success: true, trackingNumber: trk, updatedNotes: ship.notes };
                  } else {
                    toolResult = { error: `Shipment ${trk} not found.` };
                  }
                }
                else if (name === "create_support_ticket") {
                  const ticketId = `case-${Date.now().toString().slice(-4)}`;
                  const testCase: SupportCase = {
                    id: ticketId,
                    shipmentId: args.trackingNumber ? shipmentsDB.find(s => s.trackingNumber === args.trackingNumber)?.id : undefined,
                    subject: args.subject as string,
                    customerName: args.customerName as string,
                    customerPhone: args.customerPhone as string,
                    status: 'open',
                    createdTime: new Date().toISOString(),
                    notes: args.notes as string
                  };
                  casesDB.unshift(testCase);
                  toolResult = testCase;
                  mcpServer = "CRMSupportMCPServer";
                }
                else if (name === "escalate_to_human") {
                  const ticketId = `case-${Date.now().toString().slice(-4)}`;
                  toolResult = {
                    escalationStatus: "handoff_initiated",
                    caseId: ticketId,
                    message: "Hot-telephony outbound ring successfully queued to human logistics panel."
                  };
                  mcpServer = "TelephonyEscalationServer";
                  
                  // Emit to WebSocket so client frontend triggers and renders the escalation immediately:
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: 'escalation_triggered',
                      params: {
                        customerName: args.customerName,
                        customerPhone: args.customerPhone,
                        trackingNumber: args.trackingNumber,
                        reason: args.reason,
                        summary: args.summary
                      }
                    }));
                  }
                }
                else if (name === "package_deep_dive" || name === "PackageDeepDive") {
                  const trk = args.trackingNumber as string;
                  toolResult = executePackageDeepDive(trk);
                  mcpServer = "CustomsLogisticsMCPServer";
                }
                else {
                  const mcpRes = executeNewMCPTools(name, args);
                  if (mcpRes) {
                    toolResult = mcpRes.toolResult;
                    mcpServer = mcpRes.mcpServer;
                  }
                }

                // Emit to clientWs so the frontend dialogue stream displays the tool execution:
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'tool_call',
                    name,
                    params: args,
                    response: toolResult,
                    mcpServer,
                    timestamp: Date.now()
                  }));
                }

                // Add to interaction traces DB:
                const liveTrace = {
                  id: `trace-live-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  timestamp: new Date().toISOString(),
                  query: "Realtime Voice Interaction Call",
                  mcpServer,
                  tool: name,
                  params: JSON.stringify(args, null, 2),
                  response: JSON.stringify(toolResult, null, 2)
                };
                interactionTraces.unshift(liveTrace);

                responses.push({
                  id: callId,
                  name: name,
                  response: { output: toolResult }
                });
              }

              // Send responses back to Gemini session so it can proceed
              try {
                await geminiSession.sendToolResponse({
                  functionResponses: responses
                });
                console.log(`[LIVE WEBSOCKET FUNCTION CALL] Tool response sent successfully for:`, responses.map(r => r.name));
              } catch (sendErr) {
                console.error("Failed to send tool response to Gemini Live Session:", sendErr);
              }
            }

            // A. User speech transcription capturing
            const userText = msg.serverContent?.userTurn?.parts?.[0]?.text || msg.serverContent?.userTurn?.parts?.find((p: any) => p.text)?.text;
            if (userText) {
              console.log(`[USER TRANSCRIPT] ${userText}`);
              emitTranscript('user', userText);
            }

            // B. Gemini voice content text response capturing
            const text = msg.serverContent?.modelTurn?.parts?.[0]?.text || msg.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
            if (text) {
              console.log(`[AGENT TRANSCRIPT] ${text}`);
              emitTranscript('agent', text);
            }

            // C. Bridge raw Gemini output audio bytes directly over WebSocket
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'audio', audio }));
              }
            }

            if (msg.serverContent?.interrupted) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }
            }
          }
        }
      });

      console.log(`Gemini Live API WebSocket Connected successfully! Confirmed voice state is set to: ${resolvedVoice}`);
      isGeminiInitialized = true;
      clearTimeout(connectionTimeout);

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
      }

      // Promptly send the initial greeting prompt to the Gemini Live session immediately upon connection (Bug 4)
      const initialGreetingPrompt = "Hello customer! Please greet the United Parcel Service caller immediately and ask how we can assist with their shipments, logistics or delays today.";
      console.log(`[INITIAL GREETING PROMPT SEND] Sending text: "${initialGreetingPrompt}"`);
      try {
        await geminiSession.sendRealtimeInput({ text: initialGreetingPrompt });
      } catch (sendErr) {
        console.error("Failed to send initial greeting prompt:", sendErr);
      }

    } catch (err: any) {
      console.error("Gemini Live connection failure:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', message: `Gemini live handshake failed: ${err.message}` }));
      }
    }
  };

  clientWs.on('message', async (messageData) => {
    try {
      const parsed = JSON.parse(messageData.toString());

      // Store selection in session-level variable (Bug 5)
      if (parsed.type === 'voice_config') {
        const selectedVoice = parsed.voiceName || 'Puck';
        console.log(`[VOICE_CONFIG MESSAGE] Storing active voice in session variable: ${selectedVoice}`);
        activeVoiceName = selectedVoice;
        
        // If session is already running, re-initialize to apply voiceName
        if (geminiSession) {
          console.log(`[VOICE_CONFIG] Dynamic voice update on active call. Restarting session with ${selectedVoice}...`);
          await startGeminiLive(activeVoiceName, parsed.systemInstruction || "");
        }
      }

      // Client configures the active real session
      if (parsed.type === 'init') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "MOCK_KEY") {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              message: 'No real Gemini API Key defined on server. Please use simulation mode to test voice interactions.'
            }));
          }
          return;
        }

        const voiceSetting = parsed.voice || activeVoiceName || "Puck";
        activeVoiceName = voiceSetting;
        await startGeminiLive(voiceSetting, parsed.systemInstruction);
      }

      // Voice config update dynamically during active call
      if (parsed.type === 'voice-update') {
        const newVoice = parsed.voice || "Puck";
        activeVoiceName = newVoice;
        console.log(`[VOICE UPDATE] Changing voice in real-time to: ${newVoice}`);
        await startGeminiLive(newVoice, parsed.systemInstruction);
      }

      // Live Audio data streaming
      if (parsed.type === 'audio-in' && geminiSession) {
        geminiSession.sendRealtimeInput({
          audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" }
        });
      }

      // Live Text input streaming/bypass
      if (parsed.type === 'text-in' && geminiSession) {
        console.log(`[SOCKET MESSAGE] Forwarding client text-in bypass to Gemini Live: "${parsed.text}"`);
        try {
          await geminiSession.sendRealtimeInput({ text: parsed.text });
        } catch (sendErr) {
          console.error("Failed to send text-in input to Gemini Live Session:", sendErr);
        }
      }

      // Terminate connection
      if (parsed.type === 'close') {
        if (geminiSession) {
          try {
            await geminiSession.close();
          } catch (_) {}
          geminiSession = null;
        }
      }

    } catch (wsErr: any) {
      console.error("WS error on parse:", wsErr);
    }
  });

  clientWs.on('close', async (code, reason) => {
    clearTimeout(connectionTimeout);
    // Step 1: Log "WebSocket closed with code X reason Y"
    console.log(`WebSocket closed with code ${code} reason ${reason?.toString() || ""}`);

    // Step 2: If geminiSession exists call geminiSession.close() wrapped in try catch and log any error
    if (geminiSession) {
      try {
        await geminiSession.close();
      } catch (err: any) {
        console.error("Error closing old gemini session inside close hook:", err);
      }
    }

    // Step 3: Set geminiSession to null
    geminiSession = null;

    // Step 4: Set all other session variables to null including voiceName, callerNumber, and any audio stream references
    activeVoiceName = null as any;
    let voiceName: any = null;
    let callerNumber: any = null;
    let audioStreamRef: any = null;

    // Step 5: Log "Backend session fully cleaned up"
    console.log("Backend session fully cleaned up");
  });
});

// Configure Vite Node dev server middleware
async function startAppServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    // Dynamically import Vite server creators
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files serving loaded from /dist.");
  }

  const appUrlStartup = process.env.APP_URL || 'https://morbidity-ocean-removal.ngrok-free.dev';
  console.log(`[STARTUP] Full APP_URL value configured: ${appUrlStartup}`);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`======== Logistics Voice Agent Hub running at: http://localhost:${PORT} ========`);
  });
}

startAppServer();
