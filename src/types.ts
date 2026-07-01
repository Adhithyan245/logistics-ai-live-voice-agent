/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CallStatus = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'errored';

export interface ShipmentEvent {
  timestamp: string;
  location: string;
  description: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  sender: string;
  recipient: string;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delayed' | 'lost' | 'held' | 'damaged';
  origin: string;
  destination: string;
  carrier: string;
  eta: string;
  weight: string;
  lastUpdated: string;
  notes?: string;
  history: ShipmentEvent[];
}

export interface SupportCase {
  id: string;
  shipmentId?: string;
  subject: string;
  customerName: string;
  customerPhone: string;
  status: 'open' | 'resolved' | 'escalated';
  createdTime: string;
  notes?: string;
}

export interface InteractionTrace {
  id: string;
  timestamp: string;
  query: string;
  mcpServer: string;
  tool: string;
  params: string;
  response: string;
}

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isAudioPlayed?: boolean;
}

export interface AgentConfig {
  systemInstruction: string;
  voiceName: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  temperature: number;
  inboundPhoneNumber: string;
  outboundEscalationNumber: string;
  escalationReason: string;
}
