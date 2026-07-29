import { mockCall } from "@/integrations/mock-client";

const SYS = "doc-extract";
const LABEL = "Doc Extraction";

export interface ExtractedLine { mpn: string; qty: number; price: number; requiredBy: string; confidence: number; }
export interface ExtractClientPoRes {
  fields: { clientName: string; clientPoNo: string; paymentMode: string; clientGstin: string; clientState: string; referenceNo: string; gstNote: string; paymentMethod: string; deliveryTerms: string; dateCode: string; warranty: string };
  lines: ExtractedLine[];
  overallConfidence: number;
}

// In the real project this is OCR + an LLM extraction call. The mock returns a
// realistic GEES sample with a fresh (non-colliding) PO number + per-field confidence.
export function extractClientPo(req: { fileName: string; bytesLen: number }) {
  return mockCall<ExtractClientPoRes>(SYS, LABEL, "POST /extract/client-po", req,
    () => ({
      fields: {
        clientName: "GEES Innovations Pvt Ltd", clientPoNo: `GIPL/26-27/PO/${150 + Math.floor(Math.random() * 40)}`, paymentMode: "CREDIT",
        clientGstin: "33AALCG9069K1Z0", clientState: "Tamil Nadu", referenceNo: "GIPL/26-27/PO",
        gstNote: "GST extra @ actual", paymentMethod: "As agreed", deliveryTerms: "Test Report Along with Shipment", dateCode: "", warranty: "",
      },
      lines: [{ mpn: "MIC5282-5.0YMME-TR", qty: 12500, price: 345.6, requiredBy: "2026-07-20", confidence: 0.97 }],
      overallConfidence: 0.94,
    }),
    { latencyMs: [800, 2500], failError: { code: "UNPARSEABLE_FILE", message: "Could not parse document — enter manually", status: 422 } });
}

export interface ExtractedSupplierLine { mpn: string; make: string; qty: number; buy: number; margin: number; confidence: number; }
export interface ExtractSupplierPoRes {
  fields: {
    supplier: string; supplierGstin: string; supplierState: string; tradeType: string; currency: string; incoterm: string;
    sellerPaymentMode: string; testing: string; referenceNo: string; paymentMethod: string; dispatchedThrough: string;
    destination: string; warranty: string; testFailureBearer: string; labLocation: string; packing: string;
  };
  lines: ExtractedSupplierLine[];
  overallConfidence: number;
}

// Mock parse of a supplier PO / PI (e.g. the OLETI→Sharpbuy PI). Returns supplier identity +
// terms + unlinked lines; the operator maps them to client-PO lines afterwards.
export function extractSupplierPo(req: { fileName: string; bytesLen: number }) {
  return mockCall<ExtractSupplierPoRes>(SYS, LABEL, "POST /extract/supplier-po", req,
    () => ({
      fields: {
        supplier: "Oleti Development Co", supplierGstin: "", supplierState: "Hong Kong", tradeType: "INTERNATIONAL",
        currency: "USD", incoterm: "EXW", sellerPaymentMode: "ADVANCE", testing: "WHL",
        referenceNo: "RFQBUNDLE_124612_20_07_2026", paymentMethod: "Advance via T/T", dispatchedThrough: "DHL",
        destination: "1Buy hub — New Delhi", warranty: "1 year", testFailureBearer: "SUPPLIER",
        labLocation: "WHL Shenzhen & Hong Kong", packing: "Packing list + Commercial Invoice; WHSO# on outside box",
      },
      lines: [{ mpn: "MIC5282-5.0YMME-TR", make: "Microchip", qty: 5000, buy: 300, margin: 15, confidence: 0.95 }],
      overallConfidence: 0.92,
    }),
    { latencyMs: [800, 2500], failError: { code: "UNPARSEABLE_FILE", message: "Could not parse document — enter manually", status: 422 } });
}
