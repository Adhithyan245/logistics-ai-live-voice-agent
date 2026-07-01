/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shipment, SupportCase } from '../types';

export const INITIAL_SHIPMENTS: Shipment[] = [
  {
    id: "ship-1",
    trackingNumber: "TRK-9831420",
    sender: "Apex Electronics Corp (Seattle, WA)",
    recipient: "TechHub Distributors (Miami, FL)",
    status: "lost",
    origin: "Seattle Fulfillment Center (SFC-2)",
    destination: "Miami Distributing Hub (MDH-5)",
    carrier: "United Parcel Service FastFreight",
    eta: "2026-06-25T17:00:00-07:00",
    weight: "24.5 kg",
    lastUpdated: "2026-06-22T01:30:00-07:00",
    notes: "CRITICAL ALERT: Freeze hazard in cold storage terminal, Salt Lake City. Immediate human escalation required.",
    history: [
      {
        timestamp: "2026-06-22T01:30:00-07:00",
        location: "Salt Lake City, UT Transit Hub",
        description: "Misrouted. Located in cold storage terminal - freeze hazard detected."
      },
      {
        timestamp: "2026-06-21T14:15:00-07:00",
        location: "Seattle Fulfillment Center (SFC-2)",
        description: "Package received, scanned, and loaded onto shipping container."
      },
      {
        timestamp: "2026-06-21T09:00:00-07:00",
        location: "Seattle, WA",
        description: "Shipment order created. Label generated."
      }
    ]
  },
  {
    id: "ship-2",
    trackingNumber: "TRK-2410294",
    sender: "Direct Green Agritech (Des Moines, IA)",
    recipient: "Organic Living Co (Los Angeles, CA)",
    status: "damaged",
    origin: "Des Moines Hub (DMH-1)",
    destination: "Los Angeles Distribution Center (LADC-9)",
    carrier: "EcoSpeed Ground Services",
    eta: "2026-06-22T16:30:00-07:00",
    weight: "124.0 kg",
    lastUpdated: "2026-06-22T07:45:00-07:00",
    notes: "CRITICAL LOG UPDATE: Severe sensor temperature spike of 18°C between Des Moines and Barstow. Escalation to damage claims required.",
    history: [
      {
        timestamp: "2026-06-22T07:45:00-07:00",
        location: "Barstow, CA Terminal",
        description: "Cargo compromised due to prolonged 18°C temperature violation."
      },
      {
        timestamp: "2026-06-21T23:10:00-07:00",
        location: "Barstow, CA Terminal",
        description: "In transit through Barstow gateway."
      },
      {
        timestamp: "2026-06-20T18:30:00-07:00",
        location: "Des Moines Hub (DMH-1)",
        description: "Departed original shipment center."
      }
    ]
  },
  {
    id: "ship-3",
    trackingNumber: "TRK-5829104",
    sender: "Heirloom Fashion Inc (New York, NY)",
    recipient: "Madison Ave Boutique (New York, NY)",
    status: "held",
    origin: "Brooklyn Warehouse (BWH-1)",
    destination: "Midtown Store Terminal (MST-4)",
    carrier: "NY Local Courier Express",
    eta: "2026-06-21T13:00:00-07:00",
    weight: "4.2 kg",
    lastUpdated: "2026-06-21T12:54:00-07:00",
    notes: "HOLD NOTICE: Customs hold due to missing commercial invoice. Escalation to customs support required.",
    history: [
      {
        timestamp: "2026-06-21T12:54:00-07:00",
        location: "Midtown Store Terminal (MST-4)",
        description: "Held by customs. Missing commercial invoice."
      },
      {
        timestamp: "2026-06-21T10:15:00-07:00",
        location: "Manhattan Sorting Station",
        description: "Out for delivery on local route."
      },
      {
        timestamp: "2026-06-21T07:00:00-07:00",
        location: "Brooklyn Warehouse (BWH-1)",
        description: "Sorted and scanned. Handed to local courier."
      }
    ]
  },
  {
    id: "ship-4",
    trackingNumber: "TRK-8829014",
    sender: "Stellar Automobile Parts (Detroit, MI)",
    recipient: "Pacific Rim Auto Dealers (Portland, OR)",
    status: "lost",
    origin: "Detroit Assembly Hub (DAH-12)",
    destination: "Portland Delivery Dock (PDD-3)",
    carrier: "All-State Heavy Logistics",
    eta: "2026-06-24T18:00:00-07:00",
    weight: "482.0 kg",
    lastUpdated: "2026-06-22T02:00:00-07:00",
    notes: "CRITICAL ACCIDENT REPORT: Cargo loss due to regional train derailment in Fargo, ND. Claims escalation required.",
    history: [
      {
        timestamp: "2026-06-22T02:00:00-07:00",
        location: "Fargo, ND Rail Yard",
        description: "Lost in regional train derailment. Structural integrity completely destroyed."
      },
      {
        timestamp: "2026-06-20T11:00:00-07:00",
        location: "Chicago, IL Freight Station",
        description: "Departed Chicago marshalling yard."
      },
      {
        timestamp: "2026-06-19T16:00:00-07:00",
        location: "Detroit Assembly Hub (DAH-12)",
        description: "Cargo loaded and dispatched via intermodal rail."
      }
    ]
  },
  {
    id: "ship-5",
    trackingNumber: "1Z999AA10123456784",
    sender: "Memphis Fulfillment Hub (Memphis, TN)",
    recipient: "Global Logistics Ltd (Nashville, TN)",
    status: "lost",
    origin: "Memphis, TN Distribution Center",
    destination: "Nashville, TN Hub",
    carrier: "United Parcel Service FastFreight",
    eta: "2026-06-20T12:00:00-07:00",
    weight: "15.0 kg",
    lastUpdated: "2026-06-19T10:00:00-07:00",
    notes: "CRITICAL REPORT: No scans after misrouting at Memphis, TN Distribution Center. Package flagged as lost after 7 days without movement.",
    history: [
      {
        timestamp: "2026-06-19T10:00:00-07:00",
        location: "Memphis, TN Distribution Center",
        description: "Misrouted. Last scanned node before loss."
      }
    ]
  },
  {
    id: "ship-6",
    trackingNumber: "1Z888BB20234567895",
    sender: "Louisville Sorting Facility (Louisville, KY)",
    recipient: "AeroParts Supplies (Atlanta, GA)",
    status: "lost",
    origin: "Louisville, KY Air Hub",
    destination: "Atlanta Distribution Center",
    carrier: "United Parcel Service FastFreight",
    eta: "2026-06-18T08:00:00-07:00",
    weight: "8.5 kg",
    lastUpdated: "2026-06-17T11:00:00-07:00",
    notes: "CRITICAL ALERT: Damaged in transit at Louisville, KY Air Hub. Package confirmed lost due to damage and missing inventory. Claims escalation required.",
    history: [
      {
        timestamp: "2026-06-17T11:00:00-07:00",
        location: "Louisville, KY Air Hub",
        description: "Damaged in transit during sorting."
      }
    ]
  },
  {
    id: "ship-7",
    trackingNumber: "TRK-STATUS-701",
    sender: "Apex Medical Supplies (Chicago, IL)",
    recipient: "Houston Surgical Center (Houston, TX)",
    status: "in_transit",
    origin: "Chicago Regional Center (CRC-1)",
    destination: "Houston Logistics Center (HLC-4)",
    carrier: "UPS Express Critical",
    eta: "2026-06-25T09:00:00-07:00",
    weight: "18.2 kg",
    lastUpdated: "2026-06-24T06:30:00-07:00",
    notes: "CARGO BRIEF: High-value medical vaccine vials. Temperature sensor active and within safe range (3.2°C). GPS lock is functional.",
    history: [
      {
        timestamp: "2026-06-24T06:30:00-07:00",
        location: "St. Louis Gateway Transit Point",
        description: "En route. Temperature logged: 3.2°C. GPS Latitude 38.6272, Longitude -90.1978."
      },
      {
        timestamp: "2026-06-23T20:45:00-07:00",
        location: "Chicago Regional Center (CRC-1)",
        description: "Package received, verified, loaded into climate-controlled trailer."
      }
    ]
  },
  {
    id: "ship-8",
    trackingNumber: "TRK-RESCHED-802",
    sender: "Northeast Apparel Depot (Boston, MA)",
    recipient: "Mile High Outfitters (Denver, CO)",
    status: "delayed",
    origin: "Boston Harbor Terminal (BHT-3)",
    destination: "Denver Depot Terminal (DDT-1)",
    carrier: "UPS Ground Select",
    eta: "2026-06-27T18:00:00-07:00",
    weight: "35.0 kg",
    lastUpdated: "2026-06-23T14:20:00-07:00",
    notes: "WEATHER HOLD: Delayed due to mountain pass blizzards. Customer requests delivery rescheduling to avoid weekend warehouse closures.",
    history: [
      {
        timestamp: "2026-06-23T14:20:00-07:00",
        location: "Cheyenne, WY Transit Yard",
        description: "Weather delay: mountain pass blizzard closure. Held until conditions improve."
      },
      {
        timestamp: "2026-06-22T08:00:00-07:00",
        location: "Boston Harbor Terminal (BHT-3)",
        description: "Package loaded and dispatched."
      }
    ]
  },
  {
    id: "ship-9",
    trackingNumber: "TRK-EXCEPT-903",
    sender: "Silicon Valley Hardware (San Jose, CA)",
    recipient: "Pinnacle Homes (Phoenix, AZ)",
    status: "held",
    origin: "San Jose Freight Center (SFC-12)",
    destination: "Phoenix Distribution Yard (PDY-2)",
    carrier: "UPS Ground Saver",
    eta: "2026-06-24T12:00:00-07:00",
    weight: "12.8 kg",
    lastUpdated: "2026-06-24T10:15:00-07:00",
    notes: "DELIVERY EXCEPTION: Delivery attempted but access gate to the complex was locked. Driver noted 'Need Buzzer/PIN Code'. Delivery rescheduled pending pin confirmation.",
    history: [
      {
        timestamp: "2026-06-24T10:15:00-07:00",
        location: "Phoenix, AZ Delivery Route",
        description: "Delivery exception: Secure gate access required. Returned to Phoenix Distribution Yard."
      },
      {
        timestamp: "2026-06-23T15:30:00-07:00",
        location: "Phoenix Distribution Yard (PDY-2)",
        description: "Sorted and prepared for local delivery route."
      }
    ]
  },
  {
    id: "ship-10",
    trackingNumber: "TRK-PICKUP-104",
    sender: "InnoTech Manufacturing (Austin, TX)",
    recipient: "Philly Tech Dist (Philadelphia, PA)",
    status: "pending",
    origin: "Austin Logistics Park (ALP-8)",
    destination: "Philadelphia Sorting Hub (PSH-5)",
    carrier: "UPS Next Day Air",
    eta: "2026-06-26T10:30:00-07:00",
    weight: "5.5 kg",
    lastUpdated: "2026-06-24T08:00:00-07:00",
    notes: "PICKUP REQUEST: Scheduled commercial courier pickup at building B loading dock. Active pickup reservation.",
    history: [
      {
        timestamp: "2026-06-24T08:00:00-07:00",
        location: "Austin, TX Office",
        description: "Pickup window reserved for 2026-06-25 09:00 - 12:00."
      }
    ]
  },
  {
    id: "ship-11",
    trackingNumber: "TRK-CLAIM-205",
    sender: "Lone Star Auto Parts (Dallas, TX)",
    recipient: "Queen City Motors (Charlotte, NC)",
    status: "damaged",
    origin: "Dallas Freight Terminal (DFT-1)",
    destination: "Charlotte Sorting Station (CSS-2)",
    carrier: "UPS Freight Heavy",
    eta: "2026-06-23T12:00:00-07:00",
    weight: "185.0 kg",
    lastUpdated: "2026-06-23T13:45:00-07:00",
    notes: "DAMAGE CLAIM EVENT: Significant liquid moisture ingress detected inside trailer 401. Cargo box soaked. Fuel surcharge under billing dispute.",
    history: [
      {
        timestamp: "2026-06-23T13:45:00-07:00",
        location: "Charlotte Sorting Station (CSS-2)",
        description: "Shipment arrived damaged. Severe water damage on packaging and parts."
      }
    ]
  }
];

export const INITIAL_CASES: SupportCase[] = [
  {
    id: "case-101",
    shipmentId: "ship-4",
    subject: "Inquiry about severe rail delay",
    customerName: "Robert Harrison",
    customerPhone: "+16173974905",
    status: "open",
    createdTime: "2026-06-22T00:15:00-07:00",
    notes: "Customer is anxious about delivery of heavy engine rotors. Highlighted that production depends on these parts."
  },
  {
    id: "case-102",
    shipmentId: "ship-3",
    subject: "Confirm sandra signing time",
    customerName: "Fiona Sterling",
    customerPhone: "+919952989679",
    status: "resolved",
    createdTime: "2026-06-21T14:00:00-07:00",
    notes: "Confirmed delivery was signed at 12:54 PM by receptionist Sandra G."
  }
];
