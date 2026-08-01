# RFQ Module Linkage Fixes

## Problem Identified
There were gaps between:
1. Client RFQ/Demand → RFQ Bundle
2. RFQ Bundle → Supplier Quotes
3. Supplier Quotes → PO Creation
4. Missing ClientPO traceability in SupplierPO

## Solutions Implemented

### 1. **Enhanced DemandLine-to-ClientPO Linkage**
- Added `clientPoId` and `clientLineId` fields to `DemandLine` type
- Updated `createDemandLine()` action to accept and store clientPoId and clientLineId
- Demand lines now explicitly reference their source Client PO

**Before:**
```typescript
DemandLine { id, mpn, qty, targetPrice, currency, requiredByDate, source }
```

**After:**
```typescript
DemandLine { id, mpn, qty, targetPrice, currency, requiredByDate, source, clientPoId, clientLineId }
```

### 2. **RfqLine-to-ClientPO Traceability**
- Added `clientPoId` and `clientLineIds` fields to `RfqLine` type
- Updated `createRfqBundle()` to propagate clientPoId from DemandLine to RfqLine
- RFQ lines now inherit the ClientPO reference from their source demand

**Before:**
```typescript
RfqLine { id, rfqBundleId, demandLineIds[], mpn, aggregatedQty, targetPrice, currency }
```

**After:**
```typescript
RfqLine { id, rfqBundleId, demandLineIds[], mpn, aggregatedQty, targetPrice, currency, clientPoId, clientLineIds }
```

### 3. **Quote-to-SupplierPO Proper Linkage**
- Updated `finalizeRfqToSupplierPos()` to:
  - Extract `clientPoId` from RfqLine
  - Use quoted quantity (`line.stockQty`) instead of aggregated demand quantity
  - Use quoted MPN (`line.quotedMpn`) instead of RfqLine MPN (for alternates)
  - Pass all quote details: unitPrice, currency, leadTimeDays

**Data Flow:**
```
DemandLine (clientPoId) 
  ↓
RfqLine (clientPoId inherited)
  ↓ (Grouped by supplier + clientPoId)
QuoteLine (supplier response)
  ↓
SupplierPO (clientPoId set, using quoted quantities)
```

### 4. **Bidirectional Traceability**

**Forward Traceability:**
```
ClientPO → DemandLine → RfqLine → QuoteLine → SupplierPO
```

**Backward Traceability:**
```
SupplierPO.clientPoId → Original Client PO
SupplierPO.referenceNo → RfqBundle (for quote decision traceability)
```

## Fixed Issues

### ✅ Issue 1: ClientPO Lost After RFQ Creation
- **Before:** SupplierPO created with empty `clientPoId`
- **After:** ClientPO reference preserved from DemandLine through RfqLine to SupplierPO

### ✅ Issue 2: Wrong Quantities Used
- **Before:** SupplierPO used aggregated demand quantity
- **After:** SupplierPO uses actual quoted quantity from supplier response

### ✅ Issue 3: Missing Alternate MPN Handling
- **Before:** SupplierPO used RfqLine MPN regardless of quote
- **After:** SupplierPO uses quoted MPN if supplier quoted an alternate

### ✅ Issue 4: No Linkage Between Client RFQ and Supplier Quote
- **Before:** No way to trace which supplier quote came from which client demand
- **After:** Full traceability via clientPoId and RfqLine selection

## Data Model Changes

### DemandLine
```typescript
export interface DemandLine {
  id: string;
  mpn: string;
  qty: number;
  targetPrice: number;
  currency: string;
  requiredByDate: string;
  source: "email" | "manual" | "portal";
  clientPoId?: string;         // ← NEW: Link to Client PO
  clientLineId?: string;       // ← NEW: Link to Client PO line
  createdAt: string;
}
```

### RfqLine
```typescript
export interface RfqLine {
  id: string;
  rfqBundleId: string;
  demandLineIds: string[];
  mpn: string;
  alternateGroupId: string;
  aggregatedQty: number;
  targetPrice: number;
  currency: string;
  clientPoId?: string;         // ← NEW: Inherited from DemandLine
  clientLineIds?: string[];    // ← NEW: Inherited from DemandLine
}
```

## Complete Flow Example

```
1. Client PO (CPO-001) created
   ├─ Line 1: STM32F407VG, Qty 500

2. Demand Line created from CPO-001
   ├─ clientPoId: "CPO-001"
   ├─ clientLineId: "line-1"
   └─ mpn: STM32F407VG

3. RFQ Bundle created
   ├─ RfqLine 1
   │  ├─ demandLineIds: ["DEM-123"]
   │  ├─ clientPoId: "CPO-001"
   │  └─ clientLineIds: ["line-1"]

4. Suppliers respond with quotes
   ├─ Supplier A: Quote STM32F407VG @ $8.50, Stock 500
   ├─ Supplier B: Quote STM32F407VG @ $8.75, Stock 1000

5. SC selects Supplier A's quote

6. System creates SupplierPO
   ├─ clientPoId: "CPO-001"      ← Preserved from RfqLine
   ├─ referenceNo: "RFQBUNDLE-456"
   ├─ Lines:
   │  ├─ mpn: STM32F407VG (from quote)
   │  ├─ qty: 500 (from quote)
   │  └─ unitPrice: $8.50 (from quote)
```

## Backward Compatibility
- All new fields are optional (`?`)
- Existing DemandLines/RfqLines without clientPoId still work
- SupplierPOs created before this fix will have empty clientPoId
- No data migration required

## Testing
- ✅ Build succeeds with all changes
- ✅ All new fields properly initialized
- ✅ Linkage preserved through entire flow
- ✅ Backward compatible with existing data
