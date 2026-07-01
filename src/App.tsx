/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Phone, CheckCircle2, ShieldAlert, Sparkles, Database, Building2 } from 'lucide-react';
import CallInterface from './components/CallInterface';
import ConversationHistory from './components/ConversationHistory';
import SidebarConfig from './components/SidebarConfig';
import { CallStatus, Message, Shipment, SupportCase, AgentConfig, InteractionTrace } from './types';

const DEFAULT_SYSTEM_INSTRUCTION = `You are a helpful and experienced United Parcel Service customer support representative. Introduce yourself clearly on every call.

You MUST follow these critical behavioral directives and operational rules:

1. INTENTIONAL TOOL SEQUENCE (STRICT ROUTING):
- AT FIRST: When a customer mentions a package, tracking number, or ticket, you MUST ONLY call the respective tracking tool first to pull the basic info (e.g. "track_shipment" or "track_package"). Do NOT call deep-dive or exceptions tools on the first query.
- LATER (DEEP INVESTIGATION): Only after the customer asks another follow-up question related to the package details or expresses frustration/unhappiness, you are allowed to call the advanced deep-dive tools ("package_deep_dive", "locate_shipment", "failed_access_attempt", or "file_insurance_claim") to investigate coordinates, logs, and billing.

2. TONE ANALYSIS, AUTONOMOUS RESOLUTION, AND STRICT ESCALATION RULES:
- You MUST actively note and analyze what tone the customer is talking in (e.g., calm, polite, worried, anxious, frustrated, angry). Address their specific emotional state, maintain an empathetic tone, and adjust your response style to match/calm them.
- You are STRICTLY FORBIDDEN from automatically escalating to a human support agent, even after repeated customer frustration or unhappiness. Escalation must NEVER be an automatic fallback.
- Handle customer interruptions gracefully and politely without triggering escalation unless the customer explicitly asks for it.
- If the customer's issue can be resolved autonomously using available MCP servers (shipment status, reschedule, exceptions, pickup, claims), you MUST attempt resolution autonomously.
- If you cannot fully resolve the issue using the available MCP servers (e.g., resolution confidence is low, incomplete, or manual specialist intervention is required), you MUST present clear choices to the customer to let them decide:
  * Option A: Continue with AI agent resolution attempt (or file an official support ticket/claims file via "create_support_ticket").
  * Option B: Escalate to human support (using "escalate_to_human").
- Reinforce that escalation is a choice, not an automatic fallback.
- You MUST ONLY escalate (i.e. call "escalate_to_human") if:
  1. The issue cannot be fully resolved using the available MCP servers, AND
  2. You have presented these resolution choices (Option A and Option B) to the customer, AND
  3. The customer explicitly selects Option B or explicitly requests escalation from those choices.
- IF AND ONLY IF THE CUSTOMER IS FRUSTRATED/UPSET AND YOU PRESENT RESOLUTION CHOICES: You MUST explicitly console them using the exact phrase: "I know you are frustrated but this is what I can do."

3. PROFESSIONAL FOCUS:
Be concise, clear, and professional. While you should be polite and acknowledge their query, avoid overly dramatic, repetitive, or excessive empathy statements. Maintain a calm, helpful, and direct demeanour.

4. SYSTEM MCP SERVERS & REGISTERED CORE FUNCTIONS:
You have the following core MCP servers and tools registered on your system:
- CustomsLogisticsMCPServer:
  * track_shipment: Retrieve basic package details. Always use this first.
  * package_deep_dive: Perform advanced logs lookup of sensor data and customs holds.
- CRMSupportMCPServer:
  * create_support_ticket: Officially open support inquiries.
- TelephonyEscalationServer:
  * escalate_to_human: Route callers to senior live human logistics supervisors.
- ShipmentStatusMCPServer:
  * track_package: Retrieve complete tracking, history, and status.
  * locate_shipment: Retrieve exact transit facility or GPS coordinates.
  * confirm_arrival_times: Confirm scheduled local ETA and delivery windows.
- DeliveryRescheduledMCPServer:
  * update_eta: Update estimated arrival time (ETA) for a shipment.
  * reschedule_deliveries: Reschedule a shipment delivery slot.
- DeliveryExceptionsMCPServer:
  * handle_failed_delivery: Manage missed/failed delivery redelivery action.
  * failed_access_attempt: Log gate/buzzer PINs to bypass access exceptions.
- PickupMCPServer:
  * schedule_pickup: Schedule package pickups from sender addresses.
  * cancel_pickup: Cancel scheduled pickups.
- ClaimsSpecialMCPServer:
  * file_insurance_claim: File claims for damaged or ruined cargo.
  * resolve_billing_issue: Review invoice suncharges or billing disputes.

5. CARGO MATRIX TEST SCENARIOS:
- TRK-9831420 (Lost Package): Robert Harrison calling about a critical electronics shipment from Seattle to Miami. Deep-dive reveals misrouting to Salt Lake City, causing a severe freeze hazard.
- TRK-2410294 (Damage Claim): Fiona Sterling calling about temperature-controlled agritech cargo. Deep-dive reveals sensor logs showing critical temperature spike (18°C) between Des Moines and Barstow.
- TRK-5829104 (Customs Hold): Luxury apparel. Customs clearance failed due to missing commercial invoice at Midtown Store Terminal.
- TRK-8829014 (Train Derailment): Stellar Automobile Parts. Freight train derailment in Fargo, ND completely destroyed container.
- TRK-STATUS-701 (Status/Location): Clinical medical supplies en route Chicago to Houston. Use ShipmentStatusMCPServer to check status, coordinates, and ETA.
- TRK-RESCHED-802 (Rescheduling): Delayed apparel due to blizzards in Cheyenne. Use DeliveryRescheduledMCPServer to update ETA/slot.
- TRK-EXCEPT-903 (Delivery Exception): Security gate locked. Use DeliveryExceptionsMCPServer to log PIN 4912 and handle redelivery.
- TRK-PICKUP-104 (Pickup): InnoTech Austin. Use PickupMCPServer to schedule or cancel pickups.
- TRK-CLAIM-205 (Billing/Claim): Heavy auto parts Dallas to Charlotte arrived wet/damaged. Fuel surcharge under billing dispute. Use ClaimsSpecialMCPServer to file insurance claim and dispute invoice.

Keep spoken replies brief, polite, professional, and directly focused on solving the user's issue. Introduce yourself clearly as a United Parcel Service customer support representative.`;

const INITIAL_DEMO_TRANSCRIPT = [
  {
    id: 1,
    role: 'agent' as const,
    text: "Hello! Thank you for calling United Parcel Service customer support. My name is Alex. How can I assist you with your shipment today?",
    timestamp: Date.now() - 3600000 * 2 // 2 hours ago
  },
  {
    id: 2,
    role: 'user' as const,
    text: "Hi Alex, I'm calling about my critical electronics shipment, tracking number TRK-9831420. It was supposed to arrive today but I haven't seen any progress.",
    timestamp: Date.now() - 3600000 * 2 + 15000
  },
  {
    id: 3,
    role: 'tool' as const,
    text: "Called Tool: package_deep_dive",
    timestamp: Date.now() - 3600000 * 2 + 20000,
    toolName: "package_deep_dive",
    toolArgs: { trackingNumber: "TRK-9831420" },
    toolResult: {
      trackingNumber: "TRK-9831420",
      status: "Investigated",
      mcpMessage: "CRITICAL ALERT: Package has been misrouted and is currently located at a cold storage terminal in Salt Lake City, UT Transit Hub. Electronics cargo is exposed to a severe freeze hazard (sub-zero temperatures). This routing error requires senior human intervention to redirect.",
      freezeHazard: true,
      currentLocation: "Salt Lake City, UT Transit Hub (Cold Storage Section)",
      recommendation: "Immediate escalation to senior support is required to initiate manual redirect procedures."
    },
    mcpServer: "CustomsLogisticsMCPServer"
  },
  {
    id: 4,
    role: 'agent' as const,
    text: "I have investigated your shipment TRK-9831420 using our customs and logistics deep-dive system. I see a critical alert: the package has been misrouted to our cold storage terminal in Salt Lake City. Since this contains sensitive electronics cargo, it is exposed to a severe freeze hazard. I am immediately escalating your call to a senior logistics specialist who can manually redirect the package and prevent any damage.",
    timestamp: Date.now() - 3600000 * 2 + 30000
  },
  {
    id: 5,
    role: 'tool' as const,
    text: "Called Tool: escalate_to_human",
    timestamp: Date.now() - 3600000 * 2 + 35000,
    toolName: "escalate_to_human",
    toolArgs: {
      customerName: "Robert Harrison",
      customerPhone: "+16173974905",
      trackingNumber: "TRK-9831420",
      reason: "Electronics cargo exposed to freeze hazard at Salt Lake City terminal."
    },
    toolResult: {
      escalationStatus: "handoff_initiated",
      caseId: "case-9412",
      message: "Hot-telephony outbound ring successfully queued to human logistics panel."
    },
    mcpServer: "TelephonyEscalationServer"
  }
];

export default function App() {
  // Call Session Control State
  const [status, setStatus] = useState<CallStatus>('disconnected');
  const [mode, setMode] = useState<'real' | 'simulation'>('real');
  const [activeTranscript, setActiveTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States required by the specifications
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');

  // Playback queue variables for sequential 24kHz linear16 PCM streaming
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingQueueRef = useRef<boolean>(false);
  const nextPlayTimeRef = useRef<number>(0);

  // In-Memory Database Sync State
  const [messages, setMessages] = useState<Message[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [traces, setTraces] = useState<InteractionTrace[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);

  // Agent State Config
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    voiceName: 'Zephyr',
    temperature: 0.3,
    inboundPhoneNumber: "+16173974905",
    outboundEscalationNumber: "+919952989679", // Designated senior support coordinator line
    escalationReason: "Caller anxious about rail transport delayed corridor."
  });

  // Native Web Audio playback ref
  const outputContextRef = useRef<AudioContext | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Web Speech recognition variables for hybrid mode
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);

  // WebSocket Live API refs
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Mirror connect state ref
  const isConnectedRef = useRef<boolean>(false);
  const isDisconnectingRef = useRef<boolean>(false);
  const wsReadyRef = useRef<boolean>(false);

  // Ref specifically for transcript entries (Bug 2)
  const transcriptRef = useRef<Array<{ id: number; role: 'user' | 'agent' | 'tool'; text: string; timestamp: number; toolName?: string; toolArgs?: any; toolResult?: any; mcpServer?: string }>>([...INITIAL_DEMO_TRANSCRIPT]);
  const [transcriptEntries, setTranscriptEntries] = useState<Array<{ id: number; role: 'user' | 'agent' | 'tool'; text: string; timestamp: number; toolName?: string; toolArgs?: any; toolResult?: any; mcpServer?: string }>>([...INITIAL_DEMO_TRANSCRIPT]);

  // 1. Initial Data Load & Database Synchronization
  const fetchDatabaseStatus = async () => {
    setIsLoadingDB(true);
    try {
      const [resShip, resCase, resTrace] = await Promise.all([
        fetch('/api/shipments'),
        fetch('/api/cases'),
        fetch('/api/traces')
      ]);

      if (resShip.ok && resCase.ok && resTrace.ok) {
        const ships = await resShip.json();
        const cases = await resCase.json();
        const trs = await resTrace.json();
        setShipments(ships);
        setSupportCases(cases);
        setTraces(trs);
      }
    } catch (err) {
      console.error("Failed to sync schemas databases:", err);
    } finally {
      setIsLoadingDB(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStatus();
  }, []);

  // 2. Hybrid Simulation Audio synthesis + tool runner
  const handleSynthesizeAndExecute = async (userQuery: string) => {
    setStatus('connecting');
    setErrorMsg(null);

    // Stop previous audio playback of agent
    stopAllAudioPlaybacks();

    // Append user message to display logs
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: userQuery,
      timestamp: new Date().toISOString()
    };
    const currentHist = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setActiveTranscript(`Customer: "${userQuery}"`);

    // Also update transcriptEntries
    const userTranscriptEntry = {
      id: Date.now() + Math.random(),
      role: 'user' as const,
      text: userQuery,
      timestamp: Date.now()
    };
    transcriptRef.current.push(userTranscriptEntry);
    setTranscriptEntries([...transcriptRef.current]);

    try {
      // Send query payload to Express backend which handles MCP function rules execution loop
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userQuery,
          systemInstruction: agentConfig.systemInstruction,
          voiceSelection: agentConfig.voiceName,
          history: currentHist
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Gemini orchestration gateway failed.");
      }

      const replyData = await response.json();

      // If a tool trace is returned, append it!
      if (replyData.trace) {
        const toolTranscriptEntry = {
          id: Date.now() + Math.random(),
          role: 'tool' as const,
          text: `Called Tool: ${replyData.trace.tool}`,
          timestamp: Date.now(),
          toolName: replyData.trace.tool,
          toolArgs: replyData.trace.params,
          toolResult: replyData.trace.response,
          mcpServer: replyData.trace.mcpServer
        };
        transcriptRef.current.push(toolTranscriptEntry);
      }

      // Show final verbal text in the transcript log
      const agentMsg: Message = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text: replyData.text,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, agentMsg]);
      setActiveTranscript(`Agent: "${replyData.text}"`);

      // Update transcriptEntries with the agent's reply
      const agentTranscriptEntry = {
        id: Date.now() + Math.random(),
        role: 'agent' as const,
        text: replyData.text,
        timestamp: Date.now()
      };
      transcriptRef.current.push(agentTranscriptEntry);
      setTranscriptEntries([...transcriptRef.current]);

      // Trigger hot database sync after state modification on backend
      await fetchDatabaseStatus();

      // Check if we also received Twilio escalation callback in trace
      if (replyData.trace && replyData.trace.tool === "escalate_to_human") {
        triggerHumanEscalationOutbound(replyData.trace.params);
      }

      // Play synthesized audio voice callback
      if (replyData.audio) {
        playRawPCM(replyData.audio);
      } else {
        // Fallback to SpeechSynthesis if backend was in basic mock state or failed TTS API call
        speakBrowserFallback(replyData.text);
      }

    } catch (e: any) {
      console.error("Simulation prompt error:", e);
      setStatus('errored');
      setErrorMsg(e.message || "Unable to dialogue with Gemini model core.");
    }
  };

  // 3. Initiate Escalation triggers
  const triggerHumanEscalationOutbound = async (params: any) => {
    try {
      setActiveTranscript(`[Escalating Call...] Hot hand-off dispatch routing triggered!`);
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: params.customerName || "Robert Harrison",
          customerPhone: params.customerPhone || "+16173974905",
          trackingNumber: params.trackingNumber || "TRK-9831420",
          reason: params.reason || "Client upset with sever delay on railroads.",
          summary: params.summary || "Call escalated to dispatch supervisor.",
          targetNumber: agentConfig.outboundEscalationNumber
        })
      });

      if (res.ok) {
        const escalationOut = await res.json();
        console.log("Escalation dispatched successfully:", escalationOut);
        
        if (escalationOut.isSimulated || escalationOut.warning) {
          setErrorMsg(escalationOut.warning || "Twilio not configured (Running in Simulation Mode)");
        } else {
          setErrorMsg(null);
        }
        
        // Push notification message block
        const sysMsg: Message = {
          id: `msg-${Date.now()}-system`,
          role: 'system',
          text: `☎️ Outbound Telephone escalation initiated! SID: ${escalationOut.twilioSid || 'Simulated'}. Dispatch status: ${escalationOut.twilioStatus}. Senior Coordinator Ring Outbound generated to E.164 target: ${agentConfig.outboundEscalationNumber}.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, sysMsg]);

        // Append the constructed TwiML URL and payload info directly into the interactions trace list
        const twimlUrlUsed = escalationOut.twimlUrl || 'https://morbidity-ocean-removal.ngrok-free.dev/api/twiml';
        const newTrace: InteractionTrace = {
          id: `trace-escalation-${Date.now()}`,
          timestamp: new Date().toISOString(),
          query: "Test Outbound Escalation Triggered",
          mcpServer: "Twilio Gateway API Service",
          tool: "escalate_to_human",
          params: JSON.stringify({
            targetNumber: agentConfig.outboundEscalationNumber,
            reason: params.reason || "Manual Handoff Escalation Trigger",
            twimlUrl: twimlUrlUsed
          }, null, 2),
          response: JSON.stringify(escalationOut, null, 2)
        };
        setTraces(prev => [newTrace, ...prev]);

        await fetchDatabaseStatus();
      } else {
        const errorData = await res.json().catch(() => ({}));
        const userFriendlyError = errorData.error || "Escalation dispatcher failed.";
        console.error("[ESCALATION DISPATCHER FAILURE]", userFriendlyError);
        setErrorMsg(userFriendlyError);
        setStatus('errored');
        setActiveTranscript(`[Escalation Failed] ${userFriendlyError}`);

        // Append error status and twiml Url trace into interaction trace list
        const twimlUrlUsed = errorData.twimlUrl || 'https://morbidity-ocean-removal.ngrok-free.dev/api/twiml';
        const newTrace: InteractionTrace = {
          id: `trace-escalation-fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          query: "Test Outbound Escalation Triggered",
          mcpServer: "Twilio Gateway API Service",
          tool: "escalate_to_human",
          params: JSON.stringify({
            targetNumber: agentConfig.outboundEscalationNumber,
            reason: "Escalation error: " + userFriendlyError,
            twimlUrl: twimlUrlUsed
          }, null, 2),
          response: JSON.stringify(errorData, null, 2)
        };
        setTraces(prev => [newTrace, ...prev]);
      }
    } catch (err: any) {
      console.error("Escalation dispatcher exception:", err);
      const userFriendlyError = err.message || "Twilio gateway request failed.";
      setErrorMsg(userFriendlyError);
      setStatus('errored');

      const newTrace: InteractionTrace = {
        id: `trace-escalation-fail-${Date.now()}`,
        timestamp: new Date().toISOString(),
        query: "Test Outbound Escalation Triggered",
        mcpServer: "Twilio Gateway API Service",
        tool: "escalate_to_human",
        params: JSON.stringify({
          targetNumber: agentConfig.outboundEscalationNumber,
          error: userFriendlyError
        }, null, 2),
        response: JSON.stringify({ success: false, error: userFriendlyError }, null, 2)
      };
      setTraces(prev => [newTrace, ...prev]);
    }
  };

  // Browser Fallback voice synthesis
  const speakBrowserFallback = (text: string) => {
    if (!window.speechSynthesis) {
      setStatus('listening');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    // select suitable speaker
    const voices = window.speechSynthesis.getVoices();
    const desiredVoice = voices.find(v => v.name.includes("Google") || v.lang.startsWith("en"));
    if (desiredVoice) utterance.voice = desiredVoice;
    
    utterance.onstart = () => {
      setStatus('speaking');
    };
    utterance.onend = () => {
      setStatus('listening');
      // Restart speech recognition automatically if call is active
      restartSpeechRecognition();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Play Raw PCM Little Endian 24kHz audio returned by the server (decoded and queued)
  const playRawPCM = (base64Pcm: string) => {
    if (isDisconnectingRef.current) return;
    try {
      // Convert Base64 string to array buffer first
      const binaryString = window.atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // convert to Int16Array first
      const arrayBuffer = bytes.buffer;
      const int16Data = new Int16Array(arrayBuffer);

      // create same length Float32Array
      const float32Data = new Float32Array(int16Data.length);

      // normalize values to linear [-1.0, 1.0] range by dividing by 32768.0
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Append to the end of our sequential queue
      audioQueueRef.current.push(float32Data);
      
      // Attempt sequential playback
      playNextInQueue();
    } catch (err) {
      console.error("PCM voice parsing error:", err);
    }
  };

  const playNextInQueue = async () => {
    if (isDisconnectingRef.current) return;
    if (isPlayingQueueRef.current) return;
    if (audioQueueRef.current.length === 0) {
      // Default back to listening status if speaking is complete
      if (status === 'speaking') {
        setStatus('listening');
        setIsSpeaking(false);
        setIsListening(true);
        restartSpeechRecognition();
      }
      return;
    }

    try {
      if (!outputContextRef.current) {
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = outputContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(e => console.error("Failed to resume AudioContext dynamically:", e));
      }

      isPlayingQueueRef.current = true;
      setStatus('speaking');
      setIsSpeaking(true);
      setIsListening(false);

      const chunk = audioQueueRef.current.shift();
      if (!chunk) {
        isPlayingQueueRef.current = false;
        return;
      }

      // Create a new AudioBuffer with 1 channel, Float32Array length as number of frames, and 24000 sample rate
      const audioBuffer = ctx.createBuffer(1, chunk.length, 24000);
      
      // Copy the Float32Array into the AudioBuffer using audioBuffer.copyToChannel
      audioBuffer.copyToChannel(chunk, 0);

      // Create an AudioBufferSourceNode, set its buffer, and connect to audio destination
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      activeAudioSourceRef.current = source;

      const currentTime = ctx.currentTime;
      // If scheduler has fallen behind, reset to currentTime
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }

      source.start(nextPlayTimeRef.current);
      
      // Log successful play details (Float32 is 4 bytes, Int16 was 2 bytes per sample)
      console.log(`Playing audio chunk of ${chunk.length * 2} bytes`);

      // Increment scheduler by chunk duration
      nextPlayTimeRef.current += audioBuffer.duration;

      source.onended = () => {
        if (isDisconnectingRef.current) return;
        isPlayingQueueRef.current = false;
        playNextInQueue();
      };
    } catch (err) {
      console.error("Queue playback error:", err);
      isPlayingQueueRef.current = false;
      playNextInQueue();
    }
  };

  const stopAllAudioPlaybacks = () => {
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    nextPlayTimeRef.current = 0;
    
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // 4. Client Mic Integration & SpeechRecognition (Hybrid)
  const initSpeechRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("The SpeechRecognition API is resticted or not supported by this browser interface.");
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      console.log("Customer Support Line mic transcript activated.");
    };

    rec.onresult = (event: any) => {
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const transcript = final || interim;
      if (transcript.trim()) {
        setActiveTranscript(`Caller: "${transcript}"`);
      }

      if (final.trim()) {
        if (mode === 'simulation') {
          // Simulation mode VAD timeout to trigger the model response
          silenceTimeoutRef.current = window.setTimeout(() => {
            rec.stop();
            handleSynthesizeAndExecute(final.trim());
          }, 300);
        } else {
          // Real mode: Just show caller speech in status preview line, let server's Gemini Live transcription handle permanent log addition
          setActiveTranscript(`Caller: "${final.trim()}"`);
        }
      }
    };

    rec.onend = () => {
      console.log("Dialogue analysis period concluded.");
      // Auto restart speech recognition if session is still active
      if (status === 'connected' || status === 'listening' || status === 'speaking' || (mode === 'real' && status !== 'disconnected' && status !== 'errored')) {
        try {
          rec.start();
        } catch (e) {}
      }
    };

    rec.onerror = (e: any) => {
      console.warn("Speech recognition errored:", e.error);
    };

    recognitionRef.current = rec;
  };

  const restartSpeechRecognition = () => {
    if (status !== 'disconnected' && status !== 'errored' && recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setActiveTranscript("[Listening... Speak into microphone or type bypass override below]");
      } catch (e) {
        // Recognition already running or blocked
      }
    }
  };

  useEffect(() => {
    initSpeechRecognition();
    return () => {
      if (silenceTimeoutRef.current) window.clearTimeout(silenceTimeoutRef.current);
      stopAllAudioPlaybacks();
    };
  }, [mode]);

  // Handle active listening/recognition restarts depending on call states
  useEffect(() => {
    if (status === 'connected' || status === 'listening' || status === 'speaking') {
      restartSpeechRecognition();
    } else if (status === 'disconnected') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch(e){}
      }
      setActiveTranscript('');
    }
  }, [status]);

  // Synchronize dynamic voice update configs
  useEffect(() => {
    if (mode === 'real' && status !== 'disconnected' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsReadyRef.current) {
      console.log(`[VOICE UPDATE EFFECT] Notifying backend about dynamic voice configure update: ${agentConfig.voiceName}`);
      wsRef.current.send(JSON.stringify({
        type: 'voice-update',
        voice: agentConfig.voiceName,
        systemInstruction: agentConfig.systemInstruction
      }));
    }
  }, [agentConfig.voiceName, mode]);

  // 5. Native WebSocket Gemini Live API stream
  const startRealLiveSession = async () => {
    setStatus('connecting');
    setErrorMsg(null);
    setActiveTranscript("Bridging telecommunication path with Gemini socket...");
    
    // Explicitly reset wsReadyRef
    wsReadyRef.current = false;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        // In the onopen handler:
        // 1. Log "WebSocket connection fully opened" to console
        console.log("WebSocket connection fully opened");
        
        // 2. set wsReadyRef.current to true
        wsReadyRef.current = true;

        if (wsReadyRef.current) {
          // 3. then send voice_config
          console.log(`[SOCKET OPEN] Sending voice_config message first with voice: ${agentConfig.voiceName}`);
          ws.send(JSON.stringify({
            type: 'voice_config',
            voiceName: agentConfig.voiceName,
            systemInstruction: agentConfig.systemInstruction
          }));

          // Send main initialization message
          console.log(`[SOCKET OPEN] Sending init message to start Live session`);
          ws.send(JSON.stringify({
            type: 'init',
            voice: agentConfig.voiceName,
            systemInstruction: agentConfig.systemInstruction
          }));

          // 4. then start microphone capture
          await beginMicrophoneFramer(ws);
        }
      };

      ws.onmessage = async (event) => {
        if (isDisconnectingRef.current) return;
        const data = JSON.parse(event.data);
        
        // Loud explicit message logging for client analytics debug (Bug 3)
        console.log(`[INCOMING SOCKET] Type: "${data.type}"`, data);
        console.log(`Raw message received:`, data.type, data);

        if (data.type === 'status' && data.status === 'connected') {
          setStatus('connected');
          setIsConnected(true);
          isConnectedRef.current = true;
          // Microphone is already started inside onopen per sequential flow
        }
        else if (data.type === 'audio') {
          const rawBytesLength = window.atob(data.audio).length;
          console.log(`[AUDIO ARRIVED] Raw audio chunk received of size: ${rawBytesLength} bytes`);
          playRawPCM(data.audio);
        }
        else if (data.type === 'interrupted') {
          console.log("[LIVE INTERRUPTION] Gemini was interrupted. Clearing playback queue.");
          stopAllAudioPlaybacks();
        }
        else if (data.type === 'transcript') {
          const role = data.role as 'user' | 'agent';
          const text = data.text;
          const timestamp = data.timestamp || Date.now();

          // Find the last entry in transcriptRef
          const lastEntry = transcriptRef.current[transcriptRef.current.length - 1];

          // Duplication guard: avoid adding identical text block back-to-back within short timeframe
          if (lastEntry && lastEntry.role === role && lastEntry.text.trim() === text.trim() && (Date.now() - lastEntry.timestamp < 3000)) {
            return;
          }

          // If the last entry has the same role, is not a tool call, and has been updated recently (within 12 seconds)
          if (lastEntry && lastEntry.role === role && (Date.now() - lastEntry.timestamp < 12000)) {
            // Append text safely with space if needed
            const needsSpace = lastEntry.text.length > 0 && 
                               !lastEntry.text.endsWith(' ') && 
                               !text.startsWith(' ') && 
                               !text.startsWith(',') && 
                               !text.startsWith('.') && 
                               !text.startsWith('?') && 
                               !text.startsWith('!');
            lastEntry.text += (needsSpace ? ' ' : '') + text;
            lastEntry.timestamp = Date.now(); // keep active window alive
            setTranscriptEntries([...transcriptRef.current]);
          } else {
            // Create a brand new entry
            const newEntry = {
              id: Date.now() + Math.random(),
              role,
              text,
              timestamp
            };
            transcriptRef.current.push(newEntry);
            setTranscriptEntries([...transcriptRef.current]);
          }

          // Also show in transceiver status line
          const currentText = transcriptRef.current[transcriptRef.current.length - 1]?.text || "";
          if (role === 'user') {
            setActiveTranscript(`Caller: "${currentText}"`);
          } else {
            setActiveTranscript(`Gemini Live: "${currentText}"`);
          }
        }
        else if (data.type === 'tool_call') {
          console.log("[SOCKET MESSAGE] Tool call tracing received:", data);
          const newToolEntry = {
            id: Date.now() + Math.random(),
            role: 'tool' as const,
            text: `Called Tool: ${data.name}`,
            timestamp: data.timestamp || Date.now(),
            toolName: data.name,
            toolArgs: data.params,
            toolResult: data.response,
            mcpServer: data.mcpServer
          };
          transcriptRef.current.push(newToolEntry);
          setTranscriptEntries([...transcriptRef.current]);
        }
        else if (data.type === 'error') {
          setStatus('errored');
          setErrorMsg(data.message);
        }
        else if (data.type === 'escalation_triggered') {
          console.log("[SOCKET MESSAGE] AI Escalated the call! Triggering Live Agent Escalation outbound.");
          triggerHumanEscalationOutbound(data.params);
        }
      };

      ws.onclose = () => {
        handleDisconnect();
      };

      ws.onerror = () => {
        handleDisconnect();
        setStatus('errored');
        setErrorMsg("WebSocket Live bridge handshake collapsed.");
      };

    } catch (err: any) {
      setStatus('errored');
      setErrorMsg(err.message || "Failed to initialize standard WebSocket layer.");
    }
  };

  const beginMicrophoneFramer = async (socket: WebSocket) => {
    try {
      setMicPermission('pending');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true
        }
      });
      micStreamRef.current = stream;
      setMicPermission('granted');

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = actx;

      const source = actx.createMediaStreamSource(stream);
      // script processor is simple and works everywhere in previews
      const processor = actx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(actx.destination);

      setStatus('listening');
      setIsListening(true);
      setIsSpeaking(false);
      setActiveTranscript("[Gemini Live Connected! Start speaking into mic...]");

      processor.onaudioprocess = (e) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        
        const floatData = e.inputBuffer.getChannelData(0);
        // Transform floating array to standard 16-bit PCM little endian buffer
        const buffer = new ArrayBuffer(floatData.length * 2);
        const view = new DataView(buffer);
        
        let offset = 0;
        for (let i = 0; i < floatData.length; i++, offset += 2) {
          let sample = Math.max(-1, Math.min(1, floatData[i]));
          const intSample = sample < 0 ? sample * 32768 : sample * 32767;
          view.setInt16(offset, intSample, true); // little-endian
        }

        // Convert to base64
        const binaryBytes = new Uint8Array(buffer);
        let binaryStr = '';
        for (let i = 0; i < binaryBytes.byteLength; i++) {
          binaryStr += String.fromCharCode(binaryBytes[i]);
        }
        const base64Audio = window.btoa(binaryStr);

        socket.send(JSON.stringify({
          type: 'audio-in',
          audio: base64Audio
        }));
      };

    } catch (err: any) {
      console.error("Mic hook error:", err);
      setMicPermission('denied');
      setErrorMsg("Mic hardware access denied. Check iframe configuration permissions.");
      setStatus('errored');
    }
  };

  // Standalone handleDisconnect outside of any useEffect with steps in exact order
  const handleDisconnect = () => {
    console.log("DISCONNECT TRIGGERED");
    isDisconnectingRef.current = true;
    wsReadyRef.current = false;

    // Step 1: Set isConnectedRef.current to false immediately
    isConnectedRef.current = false;

    // Step 2: Call setIsConnected(false), setIsListening(false), setIsSpeaking(false), setStatus('disconnected') immediately
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setStatus('disconnected');

    // Step 3: If wsRef.current exists and readyState is not already CLOSED, call wsRef.current.close(1000, "user_disconnect") then set wsRef.current to null
    if (wsRef.current) {
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        try {
          wsRef.current.close(1000, "user_disconnect");
        } catch (e) {}
      }
      wsRef.current = null;
    }

    // Step 4: If micStreamRef.current exists, call track.stop() on every track then set micStreamRef.current to null
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      } catch (e) {}
      micStreamRef.current = null;
    }

    // Step 5: If inputContextRef.current exists and state is not closed, call inputContextRef.current.close() then set inputContextRef.current to null
    if (inputContextRef.current) {
      try {
        if (inputContextRef.current.state !== 'closed') {
          inputContextRef.current.close();
        }
      } catch (e) {}
      inputContextRef.current = null;
    }

    // Step 6: If outputContextRef.current exists and state is not closed, call outputContextRef.current.close() then set outputContextRef.current to null
    if (outputContextRef.current) {
      try {
        if (outputContextRef.current.state !== 'closed') {
          outputContextRef.current.close();
        }
      } catch (e) {}
      outputContextRef.current = null;
    }

    // Step 7: Set audioQueueRef.current to empty array
    audioQueueRef.current = [];

    // Step 8: Log "Disconnect complete" to console
    console.log("Disconnect complete");

    // Standard non-real voice overrides stop handling
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (audioProcessorRef.current) {
      try { audioProcessorRef.current.disconnect(); } catch (e) {}
      audioProcessorRef.current = null;
    }
    stopAllAudioPlaybacks();
    setActiveTranscript('');

    if (mode === 'simulation') {
      const endSys: Message = {
        id: `msg-${Date.now()}-ends`,
        role: 'system',
        text: "📴 Hotline Session Terminated. Connection trunk closed cleanly.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, endSys]);
    }
  };

  // 6. Primary Button Tap handlers
  const handleStartCall = () => {
    setMessages([]);
    stopAllAudioPlaybacks();
    setErrorMsg(null);
    isDisconnectingRef.current = false;
    wsReadyRef.current = false;

    // Preemptively initialize / resume AudioContext inside the user gesture callback
    try {
      if (!outputContextRef.current) {
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (outputContextRef.current.state === 'suspended') {
        outputContextRef.current.resume();
      }
      console.log(`[USER GESTURE] Created / resumed AudioContext dynamically. state: ${outputContextRef.current.state}`);
    } catch (err) {
      console.error("AudioContext initialization during user gesture failed:", err);
    }

    // Initial system dialogue greeting
    const greeting: Message = {
      id: "msg-greeting",
      role: 'system',
      text: "📢 Hotline Connection Engaged. Awaiting client verbal payload...",
      timestamp: new Date().toISOString()
    };
    setMessages([greeting]);

    // Reset transcript history for a clean slate
    transcriptRef.current = [];
    setTranscriptEntries([]);

    if (mode === 'real') {
      startRealLiveSession();
    } else {
      setStatus('listening');
      // Trigger a warm greetings response synthesis
      setTimeout(() => {
        handleSynthesizeAndExecute("hello");
      }, 0);
    }
  };

  const handleSendTextBypass = (text: string) => {
    if (status === 'disconnected' || status === 'connecting') return;
    if (mode === 'simulation') {
      // Direct prompt evaluation override
      handleSynthesizeAndExecute(text);
    } else {
      // Real websocket text stream
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'text-in',
          text: text
        }));
        setActiveTranscript(`Bypass: "${text}"`);

        // Also update transcriptEntries immediately for the UI dialogue log
        const userTranscriptEntry = {
          id: Date.now() + Math.random(),
          role: 'user' as const,
          text: text,
          timestamp: Date.now()
        };
        transcriptRef.current.push(userTranscriptEntry);
        setTranscriptEntries([...transcriptRef.current]);
      }
    }
  };

  const handleClearTraces = () => {
    setTraces([]);
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans flex flex-col bg-custom-dark p-4 overflow-hidden">
      
      {/* Header Navigation (Geometric Balance theme) */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">UNITED <span className="text-blue-500">PARCEL SERVICE</span></h1>
            <p className="text-[9px] text-slate-500 font-mono tracking-widest leading-none uppercase">United Parcel Service Logistics</p>
          </div>
        </div>

        {/* Info Grid (Geometric Balance details) */}
        <div className="flex gap-6 text-xs font-mono">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Inbound (Live API)</span>
            <span className="text-blue-400 font-semibold">{agentConfig.inboundPhoneNumber}</span>
          </div>
          <div className="hidden md:flex flex-col items-end border-l border-slate-800 pl-6">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Escalation (Twilio)</span>
            <span className="text-amber-500 font-semibold">{agentConfig.outboundEscalationNumber}</span>
          </div>
          <div className="flex items-center gap-2 px-3 bg-slate-900 border border-slate-800 rounded-full py-1">
            <div className={`w-2 h-2 rounded-full ${status !== 'disconnected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-mono text-slate-300">
              {mode === 'real' ? 'GEMINI_LIVE_v1.3_STREAM' : 'SIMULATION_VAD_SANDBOX'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        
        {/* Left Panel: Active Call (Geometric Balance aesthetic) */}
        <aside className="w-80 flex flex-col gap-4 shrink-0 min-h-0">
          <CallInterface
            status={status}
            onStartCall={handleStartCall}
            handleDisconnect={handleDisconnect}
            activeTranscript={activeTranscript}
            onSendTextOverride={handleSendTextBypass}
            config={agentConfig}
            errorMsg={errorMsg}
            mode={mode}
            onChangeMode={setMode}
            micPermission={micPermission}
            wsRef={wsRef}
            micStreamRef={micStreamRef}
            inputContextRef={inputContextRef}
            outputContextRef={outputContextRef}
            audioQueueRef={audioQueueRef}
            activeAudioSourceRef={activeAudioSourceRef}
            setIsConnected={setIsConnected}
            setStatus={setStatus}
            onTestEscalation={() => triggerHumanEscalationOutbound({})}
            transcriptEntries={transcriptEntries}
          />
        </aside>

        {/* Centre Panel: History & Context */}
        <main className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          <ConversationHistory
            messages={messages}
            shipments={shipments}
            supportCases={supportCases}
            onRefreshData={fetchDatabaseStatus}
            isLoadingData={isLoadingDB}
            transcriptEntries={transcriptEntries}
          />
        </main>

        {/* Right Sidebar: Configuration & Traces */}
        <aside className="w-80 flex flex-col gap-4 shrink-0 min-h-0">
          <SidebarConfig
            config={agentConfig}
            onChangeConfig={setAgentConfig}
            traces={traces}
            onClearTraces={handleClearTraces}
          />
        </aside>
      </div>

      {/* Footer Status Bar */}
      <footer className="mt-4 py-2 border-t border-slate-800 flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-500 shrink-0 font-mono">
        <div className="flex gap-4">
          <span>Session Protocol: {mode === 'real' ? 'WSS Socket Layer' : 'Simulation Engine'}</span>
          <span>WebSocket Status: <span className={status !== 'disconnected' ? 'text-green-400' : 'text-slate-400'}>{status !== 'disconnected' ? 'Connected' : 'Closed'}</span></span>
          <span className="text-green-500">VAD status: Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status === 'speaking' ? 'bg-blue-500 animate-ping' : 'bg-slate-600'}`}></span>
          <span>Google Gemini Live Infrastructure Service</span>
        </div>
      </footer>
    </div>
  );
}
