import { mockCall, ref } from "@/integrations/mock-client";
import type { ShipmentStatus, ShipmentLeg } from "@/types";

const SYS = "logistics";
const LABEL = "Logistics";

export type Carrier = "DHL" | "FEDEX" | "DELHIVERY";
export const CARRIERS: Carrier[] = ["DHL", "FEDEX", "DELHIVERY"];

export interface BookShipmentReq { carrier: Carrier; leg: ShipmentLeg; reference: string; from: string; to: string; pieces: number; weightKg: number; }
export interface BookShipmentRes { awb: string; carrier: Carrier; carrierRef: string; trackingUrl: string; status: "PLANNED"; }
export interface TrackingRes { awb: string; carrierStatusCode: string; mappedStatus: ShipmentStatus; lastLocation: string; checkpoints: { at: string; location: string; description: string }[]; }

const AWB_PREFIX: Record<Carrier, string> = { DHL: "DHL", FEDEX: "FDX", DELHIVERY: "DLV" };

export function bookShipment(req: BookShipmentReq) {
  return mockCall<BookShipmentRes>(SYS, LABEL, "POST /shipments", req,
    () => {
      const awb = `${AWB_PREFIX[req.carrier]} ${Math.floor(10000000 + Math.random() * 89999999)}`;
      return { awb, carrier: req.carrier, carrierRef: ref("CR"), trackingUrl: `https://track.example/${req.carrier.toLowerCase()}/${encodeURIComponent(awb)}`, status: "PLANNED" };
    },
    { latencyMs: [400, 1200], failError: { code: "INVALID_ADDRESS", message: "Missing/invalid recipient pincode", status: 422 } });
}

// Per-status checkpoint location + description. Early hops sit in the ORIGIN ("away") country
// so an international shipment is trackable before it lands at destination customs.
function legCheckpoints(from: string, to: string): { status: ShipmentStatus; location: string; description: string }[] {
  const origin = from || "Origin";
  const dest = to || "Destination";
  return [
    { status: "DISPATCHED", location: origin, description: "Picked up at origin" },
    { status: "IN_TRANSIT", location: `${origin} — export cleared, departed`, description: "Export-cleared; in transit from origin country" },
    { status: "AT_CUSTOMS", location: `${dest} — import customs`, description: "Arrived destination; customs clearance" },
    { status: "ARRIVED", location: dest, description: "Arrived at destination hub" },
    { status: "DELIVERED", location: dest, description: "Delivered" },
  ];
}

export function getTracking(awb: string, hopsDone = 0, from = "", to = "") {
  return mockCall<TrackingRes>(SYS, LABEL, `GET /shipments/${encodeURIComponent(awb)}/tracking`, { awb },
    () => {
      const legs = legCheckpoints(from, to);
      const idx = Math.min(hopsDone, legs.length - 1);
      const mappedStatus = legs[idx].status;
      const checkpoints = legs.slice(0, idx + 1).map((l, i) => ({ at: `hop ${i + 1}`, location: l.location, description: l.description }));
      return {
        awb, carrierStatusCode: mappedStatus.slice(0, 2), mappedStatus,
        lastLocation: legs[idx].location, checkpoints,
      };
    },
    { latencyMs: [200, 800] });
}
