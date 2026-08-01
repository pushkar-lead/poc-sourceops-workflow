# Buyer & Supplier Directory

## Overview
A centralized master directory for buyers and suppliers has been implemented. Instead of manually typing names, users now select from predefined lists when creating Client POs and Supplier POs.

## Features

### 1. **Master Directory Data**
- **File:** `src/data/directory.ts`
- **5 Buyers:** Pre-configured with names, countries, emails, GSTINs, and contact info
- **5 Suppliers:** Pre-configured with the same details
- Helper functions to look up by ID or name

### 2. **Client PO Creation Form**
- **Location:** `/fulfilment/client-pos/new`
- **Change:** "Client (buyer)" field changed from text input to dropdown
- **Auto-fill:** Selecting a buyer automatically populates:
  - Client name
  - Client GSTIN
  - Client state/country

### 3. **Supplier PO Creation Form**
- **Location:** `/fulfilment/supplier-pos/new`
- **Change:** "Supplier" field changed from text input to dropdown
- **Auto-fill:** Selecting a supplier automatically populates:
  - Supplier name
  - Supplier GSTIN
  - Supplier state/country

### 4. **Directory Viewer Page**
- **Location:** `/fulfilment/directory`
- **Content:** Tables showing all buyers and suppliers
- **Navigation:** Added to sidebar under "Reference" section
- **Purpose:** View the complete master directory

## Master Data

### Buyers (5)
1. **Acme Electronics Ltd** (India)
   - GSTIN: 18AABCA1234A1Z1
   - Email: sourcing@acme-electronics.com

2. **TechCore Industries** (USA)
   - Email: procurement@techcore.com

3. **GlobalTrade Solutions** (Singapore)
   - Email: orders@globaltrade.sg

4. **EuroTech Manufacturing** (Germany)
   - Email: einkauf@eurotech.de

5. **AsiaWide Components** (Hong Kong)
   - Email: buying@asiawide.hk

### Suppliers (5)
1. **Shanghai Electronics Co.** (China)
   - GSTIN: 91310000123456789
   - Email: export@shanghai-elec.com

2. **Bangalore IC Systems** (India)
   - GSTIN: 29AABCA1234A1Z5
   - Email: sales@bangalore-ic.com

3. **Vietnam Manufacturing Ltd** (Vietnam)
   - Email: export@vnmanufacture.com

4. **Malaysia Tech Components** (Malaysia)
   - Email: sales@my-tech.com.my

5. **Thailand Electronics Trading** (Thailand)
   - Email: export@thailand-elec.co.th

## How to Use

### When Creating a Client PO:
1. Go to `/fulfilment/client-pos/new`
2. In the "Client & parties" tab, click the "Client (buyer)" dropdown
3. Select a buyer from the list
4. Their details auto-populate (name, GSTIN, state)
5. Optionally override any fields if needed

### When Creating a Supplier PO:
1. Go to `/fulfilment/supplier-pos/new`
2. In the "Supplier & terms" tab, click the "Supplier" dropdown
3. Select a supplier from the list
4. Their details auto-populate (name, GSTIN, state)
5. Optionally override any fields if needed

### To View All Buyers & Suppliers:
1. Click "Directory" in the sidebar under "Reference"
2. View both tables with complete contact information

## Technical Implementation

### Directory Data Structure
```typescript
export interface DirectoryEntry {
  id: string;
  name: string;
  country: string;
  email?: string;
  gstin?: string;
  contact?: string;
}

export const BUYERS: DirectoryEntry[] = [...]
export const SUPPLIERS: DirectoryEntry[] = [...]
```

### Helper Functions
- `getBuyerById(id)` - Get buyer by ID
- `getSupplierById(id)` - Get supplier by ID
- `getBuyerByName(name)` - Get buyer by name
- `getSupplierByName(name)` - Get supplier by name

### Form Updates
- Client PO form: Added `clientId` state field, `handleSelectBuyer()` handler
- Supplier PO form: Added `supplierId` state field, `handleSelectSupplier()` handler
- Both forms auto-populate relevant fields on selection

## Future Enhancements

- Add/edit/delete buyers and suppliers through the UI
- Import directory from CSV/Excel
- Sync with external ERP/CRM systems
- Rate/comment on suppliers
- Track supplier performance metrics
- Support multiple contacts per buyer/supplier
- Email notifications to directory contacts

## Files Modified

1. **Created:**
   - `src/data/directory.ts` - Master directory data
   - `src/app/fulfilment/directory/page.tsx` - Directory viewer page

2. **Updated:**
   - `src/app/fulfilment/client-pos/new/page.tsx` - Added buyer dropdown
   - `src/app/fulfilment/supplier-pos/new/page.tsx` - Added supplier dropdown
   - `src/data/enums.ts` - Added directory link to navigation
   - `src/components/layout/sidebar.tsx` - Added Users icon

## Build Status
✅ All changes implemented and tested
✅ Build passes with 27 pages
✅ No breaking changes
✅ Backward compatible
