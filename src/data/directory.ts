// Master directory of buyers and suppliers
export interface DirectoryEntry {
  id: string;
  name: string;
  country: string;
  email?: string;
  gstin?: string;
  contact?: string;
}

export const BUYERS: DirectoryEntry[] = [
  {
    id: "buyer-001",
    name: "Acme Electronics Ltd",
    country: "IN",
    email: "sourcing@acme-electronics.com",
    gstin: "18AABCA1234A1Z1",
    contact: "+91-22-1234-5678",
  },
  {
    id: "buyer-002",
    name: "TechCore Industries",
    country: "US",
    email: "procurement@techcore.com",
    contact: "+1-415-555-0123",
  },
  {
    id: "buyer-003",
    name: "GlobalTrade Solutions",
    country: "SG",
    email: "orders@globaltrade.sg",
    gstin: "UEN: 123456789",
    contact: "+65-6789-0123",
  },
  {
    id: "buyer-004",
    name: "EuroTech Manufacturing",
    country: "DE",
    email: "einkauf@eurotech.de",
    contact: "+49-30-1234567",
  },
  {
    id: "buyer-005",
    name: "AsiaWide Components",
    country: "HK",
    email: "buying@asiawide.hk",
    contact: "+852-2234-5678",
  },
];

export const SUPPLIERS: DirectoryEntry[] = [
  {
    id: "supplier-001",
    name: "Shanghai Electronics Co.",
    country: "CN",
    email: "export@shanghai-elec.com",
    gstin: "91310000123456789",
    contact: "+86-21-5888-0123",
  },
  {
    id: "supplier-002",
    name: "Bangalore IC Systems",
    country: "IN",
    email: "sales@bangalore-ic.com",
    gstin: "29AABCA1234A1Z5",
    contact: "+91-80-4141-5678",
  },
  {
    id: "supplier-003",
    name: "Vietnam Manufacturing Ltd",
    country: "VN",
    email: "export@vnmanufacture.com",
    contact: "+84-28-3823-0123",
  },
  {
    id: "supplier-004",
    name: "Malaysia Tech Components",
    country: "MY",
    email: "sales@my-tech.com.my",
    contact: "+60-3-2783-0123",
  },
  {
    id: "supplier-005",
    name: "Thailand Electronics Trading",
    country: "TH",
    email: "export@thailand-elec.co.th",
    contact: "+66-2-123-4567",
  },
];

export function getBuyerById(id: string): DirectoryEntry | undefined {
  return BUYERS.find((b) => b.id === id);
}

export function getSupplierById(id: string): DirectoryEntry | undefined {
  return SUPPLIERS.find((s) => s.id === id);
}

export function getBuyerByName(name: string): DirectoryEntry | undefined {
  return BUYERS.find((b) => b.name.toLowerCase() === name.toLowerCase());
}

export function getSupplierByName(name: string): DirectoryEntry | undefined {
  return SUPPLIERS.find((s) => s.name.toLowerCase() === name.toLowerCase());
}
