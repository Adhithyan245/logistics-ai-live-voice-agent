/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Settings2, FileText, Activity, Server, PhoneCall, Code, Database, Eye } from 'lucide-react';
import { AgentConfig, InteractionTrace } from '../types';

interface SidebarConfigProps {
  config: AgentConfig;
  onChangeConfig: (newConfig: AgentConfig) => void;
  traces: InteractionTrace[];
  onClearTraces: () => void;
}

export default function SidebarConfig({
  config,
  onChangeConfig,
  traces,
  onClearTraces
}: SidebarConfigProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'mcp'>('prompt');
  const [showJsonIdx, setShowJsonIdx] = useState<number | null>(null);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeConfig({
      ...config,
      systemInstruction: e.target.value
    });
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeConfig({
      ...config,
      voiceName: e.target.value as any
    });
  };

  const handleEscalationNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeConfig({
      ...config,
      outboundEscalationNumber: e.target.value
    });
  };

  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeConfig({
      ...config,
      temperature: parseFloat(e.target.value)
    });
  };

  const mcpServers = [
    { name: "CustomsLogisticsMCPServer", status: "active", endpoints: 2, desc: "Bridges global shipping tracking databases." },
    { name: "CRMSupportMCPServer", status: "active", endpoints: 1, desc: "Generates support and damages claims cases." },
    { name: "TelephonyEscalationServer", status: "active", endpoints: 1, desc: "Initiates outbound Twilio handoffs." },
    { name: "ShipmentStatusMCPServer", status: "active", endpoints: 3, desc: "Retrieves status, exact GPS coordinates, and delivery windows." },
    { name: "DeliveryRescheduledMCPServer", status: "active", endpoints: 2, desc: "Updates ETA and reschedules package delivery slots." },
    { name: "DeliveryExceptionsMCPServer", status: "active", endpoints: 2, desc: "Manages missed deliveries and updates driver gate codes." },
    { name: "PickupMCPServer", status: "active", endpoints: 2, desc: "Schedules and cancels package pickup requests." },
    { name: "ClaimsSpecialMCPServer", status: "active", endpoints: 2, desc: "Files insurance cargo claims and disputes billing invoices." }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
      
      {/* SECTION 1: SYSTEM PARAMETERS & PROMPT EDITOR (TOP) */}
      <div className="flex-1 flex flex-col border-b border-slate-800 overflow-y-auto p-4 select-text">
        
        {/* Section Title */}
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800 mb-4">
          <Settings2 className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">Agent Configuration</h2>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg mb-4 text-[10px] font-mono">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex-1 py-1.5 rounded text-center transition-all cursor-pointer ${activeTab === 'prompt' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-500 hover:text-white'}`}
          >
            PROMPT & VOICE
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 py-1.5 rounded text-center transition-all cursor-pointer ${activeTab === 'mcp' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-500 hover:text-white'}`}
          >
            MCP CONTROLLERS
          </button>
        </div>

        {activeTab === 'prompt' ? (
          <div className="space-y-4">
            
            {/* Real-time System Prompt Editor */}
            <div className="flex flex-col space-y-1.5">
              <label className="font-mono text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <FileText className="w-3 h-3 text-blue-500" /> SYSTEM INSTRUCTION (REAL-TIME)
              </label>
              <textarea
                value={config.systemInstruction}
                onChange={handlePromptChange}
                rows={5}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-xs font-mono p-3 leading-relaxed focus:outline-none focus:border-blue-500"
                placeholder="Instruct the tone and rules for the agent..."
              />
              <span className="text-[9px] font-mono text-slate-500">The prompt configures agent identity & decision safety rules immediately.</span>
            </div>

            {/* Voice select Dropdown */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="flex flex-col space-y-1.5">
                <label className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">GEMINI VOICE</label>
                <select
                  value={config.voiceName}
                  onChange={handleVoiceChange}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-xs font-mono py-2 px-2.5 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Puck">Puck (Male)</option>
                  <option value="Charon">Charon (Male)</option>
                  <option value="Fenrir">Fenrir (Male)</option>
                  <option value="Zephyr">Zephyr (Female)</option>
                  <option value="Kore">Kore (Female)</option>
                </select>
              </div>

              {/* Temperature Slider */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">TEMPERATURE</label>
                  <span className="font-mono text-[10px] text-blue-400 font-bold">{config.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.temperature}
                  onChange={handleTempChange}
                  className="w-full accent-blue-600 bg-slate-950 rounded-lg cursor-pointer h-1.5 mt-2"
                />
              </div>
            </div>

            {/* Hand-off Telephony Routing Section */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col space-y-3 pt-3">
              <div className="flex items-center space-x-2 font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">OUTBOUND ESCALATION TELEPHONY</span>
              </div>
              
              <div className="flex flex-col space-y-1.5">
                <span className="text-[8px] font-mono text-slate-500 uppercase">Senior Human Agent Line</span>
                <input
                  type="text"
                  value={config.outboundEscalationNumber}
                  onChange={handleEscalationNumberChange}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg text-xs font-mono py-2 px-3 focus:outline-none focus:border-blue-500"
                  placeholder="Escalation Target E.164 Number"
                />
              </div>
              <span className="text-[8px] font-mono text-slate-500 block leading-tight">Escalation is executed via real-time Twilio triggers. Set this to support coordinator contact lines.</span>
            </div>

          </div>
        ) : (
          <div className="space-y-3.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">REGISTERED MODEL CONTEXT PROTOCOL SERVERS</span>
            {mcpServers.map((srv, index) => (
              <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-mono text-xs text-slate-300 font-bold">{srv.name}</span>
                  </div>
                  <span className="text-[8px] font-mono text-emerald-500 border border-emerald-950 bg-emerald-950/20 px-1.5 py-0.2 rounded uppercase font-bold">ONLINE</span>
                </div>
                <p className="text-[10px] font-mono text-slate-500 leading-normal">{srv.desc}</p>
                <div className="flex items-center space-x-3 text-[8px] font-mono text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Code className="w-3.5 h-3.5 text-slate-650" />
                    <span>CONNECTOR: FUNCTION CALL</span>
                  </span>
                  <span>•</span>
                  <span>{srv.endpoints} active endpoints</span>
                </div>
              </div>
            ))}
            <span className="text-[8px] font-mono text-slate-500 block text-center leading-normal">MCP configurations allow the generative agent to communicate securely with internal sorting systems.</span>
          </div>
        )}

      </div>

      {/* SECTION 2: TELEMETRY INTERACTION TRACE (BOTTOM) */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        
        {/* Section Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">Interaction Trace</h2>
          </div>
          {traces.length > 0 && (
            <button
              onClick={onClearTraces}
              className="font-mono text-[9px] text-red-400 hover:text-red-300 cursor-pointer italic"
            >
              Clear Logs
            </button>
          )}
        </div>

        {/* Trace List Logger scroll area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 font-mono text-[10px] select-text">
          {traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 space-y-2 bg-slate-950 border border-slate-800 rounded-lg h-full text-center">
              <Database className="w-6 h-6 text-slate-800" />
              <p className="text-slate-500 font-sans text-xs">No active telemetry traces gathered.</p>
              <p className="text-slate-600 text-[10px] uppercase tracking-wider">Awaiting agent interaction loop...</p>
            </div>
          ) : (
            traces.map((tr, idx) => (
              <div key={tr.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col space-y-2 relative">
                
                {/* Gateway timestamp header */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-[9px] text-blue-400 font-bold">{tr.mcpServer}</span>
                  <span className="text-slate-500 text-[8px]">
                    {new Date(tr.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>

                {/* Question trigger */}
                <div className="flex flex-col space-y-0.5">
                  <span className="text-slate-500 text-[8px] uppercase font-bold">CLIENT INPUT:</span>
                  <span className="text-slate-300 italic">"{tr.query}"</span>
                </div>

                {/* API Action / Tool */}
                <div className="flex items-center space-x-2 text-[9px]">
                  <span className="text-slate-500 font-bold uppercase text-[8px]">TOOL RUN:</span>
                  <span className="text-blue-400 font-bold lowercase">{tr.tool}()</span>
                </div>

                {/* Toggle parameters / database responses */}
                <div className="flex flex-col space-y-1 bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="flex items-center justify-between text-[8px] text-slate-500 uppercase">
                    <span>Tool Arguments & Reply</span>
                    <button
                      onClick={() => setShowJsonIdx(showJsonIdx === idx ? null : idx)}
                      className="text-blue-400 hover:text-blue-300 font-sans cursor-pointer flex items-center space-x-0.5"
                    >
                      <Eye className="w-2.5 h-2.5 inline" />
                      <span>{showJsonIdx === idx ? "Collapse" : "Expand Raw JSON"}</span>
                    </button>
                  </div>

                  {showJsonIdx === idx ? (
                    <div className="space-y-1.5 pt-1 text-[9px]">
                      <div>
                        <span className="text-blue-400 block uppercase text-[8px] font-bold">Arguments:</span>
                        <pre className="text-slate-300 pr-1 overflow-x-auto whitespace-pre-wrap leading-tight max-h-24 font-mono">{JSON.stringify(tr.params, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="text-emerald-400 block uppercase text-[8px] font-bold">Reply Cargo:</span>
                        <pre className="text-slate-300 pr-1 overflow-x-auto whitespace-pre-wrap leading-tight max-h-24 font-mono">{JSON.stringify(tr.response, null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 block max-h-12 overflow-hidden text-ellipsis truncate leading-normal">
                      Args: {JSON.stringify(tr.params)} | Status: Sync Active
                    </span>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
