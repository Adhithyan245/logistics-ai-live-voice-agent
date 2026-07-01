/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Truck, ClipboardList, Clock, ArrowDownUp, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Message, Shipment, SupportCase } from '../types';

interface ConversationHistoryProps {
  messages: Message[];
  shipments: Shipment[];
  supportCases: SupportCase[];
  onRefreshData: () => void;
  isLoadingData: boolean;
  transcriptEntries?: Array<{
    id: number;
    role: 'user' | 'agent' | 'tool';
    text: string;
    timestamp: number;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    mcpServer?: string;
  }>;
}

type TabType = 'dialogue' | 'shipments' | 'cases';

export default function ConversationHistory({
  messages,
  shipments,
  supportCases,
  onRefreshData,
  isLoadingData,
  transcriptEntries = []
}: ConversationHistoryProps) {
  // Ensure 'dialogue' is the default active tab state when mounted
  const [activeTab, setActiveTab] = useState<TabType>('dialogue');
  
  // Dedicated ref to scroll custom transcripts smoothly
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'dialogue') {
      transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptEntries, activeTab]);

  const getStatusBadge = (status: Shipment['status']) => {
    switch (status) {
      case 'pending':
        return <span className="bg-slate-950 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-800">PENDING</span>;
      case 'in_transit':
        return <span className="bg-blue-950/40 text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-800/40 animate-pulse">IN TRANSIT</span>;
      case 'out_for_delivery':
        return <span className="bg-amber-950/40 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-800/40">OUT FOR DELIVERY</span>;
      case 'delivered':
        return <span className="bg-emerald-950 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-800/40">DELIVERED</span>;
      case 'delayed':
        return <span className="bg-rose-950 text-rose-400 text-[10px] font-mono px-2 py-0.5 rounded border border-rose-800/40">DELAYED</span>;
      case 'lost':
        return <span className="bg-red-950 text-red-400 text-[10px] font-mono px-2 py-0.5 rounded border border-red-800/40 animate-pulse">LOST</span>;
      case 'held':
        return <span className="bg-purple-950 text-purple-400 text-[10px] font-mono px-2 py-0.5 rounded border border-purple-800/40">HELD</span>;
      case 'damaged':
        return <span className="bg-orange-950 text-orange-400 text-[10px] font-mono px-2 py-0.5 rounded border border-orange-800/40">DAMAGED</span>;
      default:
        return null;
    }
  };

  const getCaseStatusBadge = (status: SupportCase['status']) => {
    switch (status) {
      case 'open':
        return <span className="bg-blue-950 text-blue-300 text-[9px] font-mono px-2 py-0.5 rounded border border-blue-800/60">OPEN</span>;
      case 'resolved':
        return <span className="bg-slate-950 text-slate-400 text-[9px] font-mono px-2 py-0.5 rounded border border-slate-800">RESOLVED</span>;
      case 'escalated':
        return <span className="bg-rose-950 text-rose-300 text-[9px] font-mono px-2 py-0.5 rounded border border-rose-800 animate-pulse">ESCALATED</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl overflow-hidden relative">
      
      {/* Top Controller Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-4 z-10">
        
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('dialogue')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all ${
              activeTab === 'dialogue' ? 'bg-blue-600 text-white font-medium shadow-md border border-blue-400/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>DIALOGUE STREAM</span>
          </button>

          <button
            onClick={() => setActiveTab('shipments')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all ${
              activeTab === 'shipments' ? 'bg-blue-600 text-white font-medium shadow-md border border-blue-400/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>CARGO MATRIX ({shipments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cases')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono tracking-wider transition-all ${
              activeTab === 'cases' ? 'bg-blue-600 text-white font-medium shadow-md border border-blue-400/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>TICKETS ({supportCases.length})</span>
          </button>
        </div>

        {/* Database Refresh action */}
        <button
          onClick={onRefreshData}
          disabled={isLoadingData}
          className="flex items-center space-x-1 font-mono text-[10px] text-blue-400 hover:text-blue-300 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed bg-slate-950 hover:bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md self-end transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingData ? 'animate-spin' : ''}`} />
          <span>SYNC DB</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 z-10 select-text">
        
        {/* TAB 1: CONVERSATION DIALOGUE STREAM */}
        {activeTab === 'dialogue' && (
          <div className="flex flex-col space-y-4 min-h-full">
            {transcriptEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-3 bg-slate-950 border border-slate-800 rounded-xl my-auto text-center">
                <MessageSquare className="w-8 h-8 text-slate-700" />
                <p className="text-slate-400 font-sans text-sm">No ongoing log detected on this console.</p>
                <p className="text-slate-600 font-mono text-xs uppercase tracking-wide">Awaiting inbound trunk connection...</p>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {transcriptEntries.map((msg) => (
                  msg.role === 'tool' ? (
                    <div
                      key={msg.id}
                      className="self-center w-full max-w-xl bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col space-y-3 font-mono text-xs shadow-lg shadow-blue-950/5 select-text my-2"
                    >
                      {/* Header of Tool Log */}
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          <span className="font-bold text-blue-400 uppercase tracking-widest text-[10px]">MCP TOOL DISPATCH</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Connection & Target Server details */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                        <div>
                          <span className="text-slate-500 uppercase block text-[9px]">Target Router</span>
                          <span className="text-slate-300 font-semibold">{msg.mcpServer || 'CustomsLogisticsMCPServer'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase block text-[9px]">Active Routine</span>
                          <span className="text-slate-300 font-semibold text-emerald-400">{msg.toolName}</span>
                        </div>
                      </div>

                      {/* Input Parameters Code Block */}
                      <div>
                        <span className="text-slate-500 uppercase text-[9px] block mb-1">Payload Arguments</span>
                        <pre className="bg-slate-900 border border-slate-800/40 p-2.5 rounded-lg text-[10px] text-slate-300 overflow-x-auto select-text">
                          {JSON.stringify(msg.toolArgs, null, 2)}
                        </pre>
                      </div>

                      {/* Return Payload Code Block */}
                      <div>
                        <span className="text-slate-500 uppercase text-[9px] block mb-1">Response Payload (Result)</span>
                        <pre className="bg-slate-900/80 border border-slate-800/40 p-2.5 rounded-lg text-[10px] text-emerald-400/90 overflow-x-auto select-text max-h-48 overflow-y-auto">
                          {JSON.stringify(msg.toolResult, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1.5 max-w-[85%] ${
                        msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      
                      {/* Header Details with custom timestamps for dispatch logs */}
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                        <span className={`uppercase font-bold tracking-wider ${
                          msg.role === 'user' ? 'text-slate-500' : 'text-blue-400'
                        }`}>
                          {msg.role === 'user' ? 'USER' : 'AGENT'}
                        </span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>

                      {/* Speech Text Package - grey background for user, blue background for agent */}
                      <div className={`p-3.5 rounded-xl text-sm leading-relaxed border ${
                        msg.role === 'user'
                          ? 'bg-slate-800 border-slate-750 text-slate-100 rounded-tr-none font-sans shadow-md'
                          : 'bg-blue-600 border-blue-500 text-white rounded-tl-none font-sans shadow-md'
                      }`}>
                        {msg.text}
                      </div>

                    </div>
                  )
                ))}
                <div ref={transcriptBottomRef} />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CARGO GRID (SHIPMENTS) */}
        {activeTab === 'shipments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Dispatch Transport Matrix</span>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">Nodes Synchronized</span>
            </div>
            
            {shipments.map((ship) => (
              <div
                key={ship.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all flex flex-col space-y-3"
              >
                {/* Shipment Top row */}
                <div className="flex items-start justify-between border-b border-slate-900 pb-2.5">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-blue-400 font-bold tracking-wider">{ship.trackingNumber}</span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none mt-0.5">{ship.carrier}</span>
                  </div>
                  {getStatusBadge(ship.status)}
                </div>

                {/* Details layout */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-mono">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">CONSIGNOR (SENDER)</span>
                    <span className="text-slate-300 truncate">{ship.sender}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">CONSIGNEE (RECIPIENT)</span>
                    <span className="text-slate-300 truncate">{ship.recipient}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">ORIGIN</span>
                    <span className="text-slate-300 truncate">{ship.origin}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">DESTINATION</span>
                    <span className="text-slate-300 truncate">{ship.destination}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">ACTUAL WEIGHT</span>
                    <span className="text-slate-300">{ship.weight}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider">ESTIMATED ETA</span>
                    <span className="text-slate-200 flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3 text-blue-400" />
                      {new Date(ship.eta).toLocaleDateString()} {new Date(ship.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Custom active operator notes */}
                {ship.notes && (
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-[10px] font-mono text-slate-400 select-text">
                    <span className="text-blue-400 font-bold uppercase tracking-wider text-[9px] block mb-1">📋 ACTIVE DISPATCH NOTES</span>
                    {ship.notes}
                  </div>
                )}

                {/* Tracking Gateways History events drop */}
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5 font-semibold">Gateway Passage Events</span>
                  <div className="border-l border-slate-800 ml-1.5 pl-3.5 space-y-2.5 select-text">
                    {ship.history.map((evt, idx) => (
                      <div key={idx} className="relative flex flex-col space-y-0.5">
                        
                        {/* Bullet tracker */}
                        <span className={`absolute -left-[19.5px] top-1.5 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                          idx === 0 ? 'bg-blue-500 animate-ping' : 'bg-slate-850'
                        }`}></span>
                        <span className={`absolute -left-[19px] top-1.5 w-2 h-2 rounded-full ${
                          idx === 0 ? 'bg-blue-500' : 'bg-slate-805'
                        }`}></span>

                        <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-500">
                          <span>{evt.location}</span>
                          <span>•</span>
                          <span>{new Date(evt.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-300">{evt.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* TAB 3: REGISTERED CLAIM TICKETS */}
        {activeTab === 'cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Inbound Claims Intake</span>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{supportCases.length} Registered claims</span>
            </div>

            {supportCases.length === 0 ? (
              <div className="text-center p-8 bg-slate-950 border border-slate-800 rounded-xl">
                <p className="text-slate-500 font-mono text-xs uppercase">No support claims logged in active queue.</p>
              </div>
            ) : (
              supportCases.map((cs) => (
                <div
                  key={cs.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-400 font-mono text-xs font-bold tracking-wider">{cs.id}</span>
                      <span className="text-slate-600 font-mono text-[10px]">•</span>
                      <span className="text-slate-400 font-mono text-[10px] uppercase">
                        Cargo: {cs.shipmentId || "General Inquiry"}
                      </span>
                    </div>
                    {getCaseStatusBadge(cs.status)}
                  </div>

                  <div className="flex flex-col text-xs font-mono space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">SUBJECT CLAIM</span>
                    <span className="text-slate-200 font-bold">{cs.subject}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[8px] uppercase">CLAIMANT NAME</span>
                      <span className="text-slate-300 font-semibold">{cs.customerName}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[8px] uppercase">CLAIMANT TEL</span>
                      <span className="text-slate-300 font-semibold">{cs.customerPhone}</span>
                    </div>
                  </div>

                  {cs.notes && (
                    <div className="mt-2 bg-slate-900 border border-slate-800 p-2.5 rounded text-[10px] font-mono text-slate-400 select-text">
                      <span className="text-slate-500 text-[8px] uppercase block mb-0.5 font-bold">Investigation record notes</span>
                      {cs.notes}
                    </div>
                  )}

                  <div className="pt-1 select-none flex items-center justify-between text-[9px] font-mono text-slate-600">
                    <span>Opened: {new Date(cs.createdTime).toLocaleString()}</span>
                  </div>

                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
