# Component Extraction Guidelines

## Purpose
This document provides specific guidelines for extracting and generalizing components from ScheduleBoard v2 into the SGE template system for rapid application development across various domains.

## Extraction Principles

### 1. Preserve Production Quality
- **Never reduce functionality** during extraction
- **Maintain all mobile optimizations** (touch targets, gestures, responsive behavior)  
- **Keep App Store compliance** systems intact
- **Preserve accessibility** features and WCAG compliance

### 2. Add Application Type Flexibility
- **Make terminology configurable**: "jobs" vs "tasks" vs "orders" vs "posts"
- **Add feature toggles**: Enable/disable based on application requirements
- **Support domain variations**: Service business vs productivity vs e-commerce patterns
- **Maintain visual consistency** while allowing branding customization

### 3. Document Everything
- **Source mapping**: Document original ScheduleBoard component location
- **Generalization changes**: List all modifications made during extraction
- **Business type examples**: Show component usage across different industries
- **Configuration options**: Document all BusinessConfig integration points

## Component Categories

### **Tier 1: Direct Extraction (Minimal Changes)**
Components that are already generic or require minimal modification:

- `dateUtils.ts` - Already generic date handling
- `use-mobile.ts` - Device detection hook
- `mobileSubscriptionCompliance.ts` - App Store compliance

**Extraction Pattern**: Copy directly with import path updates

### **Tier 2: Terminology Abstraction**
Components that need terminology generalization:

- `TodaysWork.tsx` - "jobs" → configurable service items
- `MobileJobs.tsx` - Job management → service item management  
- Customer components → Client management components

**Extraction Pattern**: 
```typescript
// Before: ScheduleBoard specific
<JobCard job={job} customer={customer} />

// After: Business type configurable
<ServiceItemCard 
  serviceItem={item} 
  client={client}
  config={businessConfig}
/>
```

### **Tier 3: Feature Toggle Integration**
Components that need business-type-specific feature variations:

- `SmartDashboard.tsx` - Different widgets per business type
- `ScheduleBoardMobile.tsx` - Feature-dependent scheduling views
- Subscription components - Different tiers per industry

**Extraction Pattern**:
```typescript
// Add feature-based conditional rendering
{config.features.photos && <PhotoUpload />}
{config.features.signatures && <SignatureField />}
{config.features.compliance && <ComplianceTracker />}
```

## Business Type Configuration Integration

### Standard Props Pattern
All extracted components should accept business configuration:

```typescript
interface ComponentProps {
  // Component-specific props
  data: any;
  onAction: () => void;
  
  // Business configuration (optional, uses context if not provided)
  businessConfig?: BusinessConfig;
}

export function ExtractedComponent({ data, onAction, businessConfig }: ComponentProps) {
  const config = businessConfig || useBusinessConfig();
  
  return (
    <Card style={{ borderColor: config.branding.primaryColor }}>
      <CardTitle>{config.terminology.serviceItem}</CardTitle>
      {/* Component implementation using config */}
    </Card>
  );
}
```

### Context Integration
Components can access business configuration through React context:

```typescript
import { useBusinessConfig } from '@sge/shared/hooks/useBusinessConfig';

export function ComponentWithContext() {
  const config = useBusinessConfig();
  
  // Use config.terminology, config.features, config.branding
}
```

## Extraction Workflow

### Step 1: Identify Source Component
```bash
# Source location in ScheduleBoard v2
../scheduleboardv2/src/components/mobile/TodaysWork.tsx
```

### Step 2: Plan Generalization
- What terminology needs to be configurable?
- Which features should be toggleable?
- What business types will use this component?
- What visual customization is needed?

### Step 3: Extract and Modify
```bash
# Copy to template location
cp ../scheduleboardv2/src/components/mobile/TodaysWork.tsx \
   packages/ui/mobile/TodaysWork.tsx

# Apply generalization transformations
node scripts/extract-components.js TodaysWork
```

### Step 4: Add Business Configuration
- Add BusinessConfig prop interface
- Replace hardcoded terms with config.terminology
- Add feature toggles based on config.features
- Apply branding from config.branding

### Step 5: Test Across Business Types
```typescript
// Test with different business configurations
const hvacConfig = getBusinessConfig('hvac');
const cleaningConfig = getBusinessConfig('cleaning');

// Verify component works with both
<TodaysWork config={hvacConfig} />
<TodaysWork config={cleaningConfig} />
```

### Step 6: Document Extraction
Create extraction documentation:

```markdown
## TodaysWork Component Extraction

**Source**: `../scheduleboardv2/src/components/mobile/TodaysWork.tsx`
**Destination**: `packages/ui/mobile/TodaysWork.tsx`

### Changes Applied:
1. Added BusinessConfig prop interface
2. Replaced "jobs" with `config.terminology.serviceItem`
3. Added feature toggles for photos, signatures, GPS
4. Applied configurable branding colors

### Business Type Variations:
- **HVAC**: Shows equipment assignments, compliance requirements
- **Cleaning**: Emphasizes before/after photos, quality checklists
- **Personal Care**: Focuses on appointment times, client preferences

### Usage Example:
```typescript
<TodaysWork 
  items={serviceItems}
  config={businessConfig}
  onItemSelect={handleItemSelect}
/>
```
```

## Quality Checklist

Before completing component extraction:

- [ ] **Functionality Preserved**: All original features work correctly
- [ ] **Mobile Optimizations Intact**: Touch targets, gestures, responsive behavior maintained
- [ ] **Business Config Integration**: Component respects all relevant BusinessConfig settings
- [ ] **Feature Toggles Working**: Component adapts based on enabled features
- [ ] **Terminology Configurable**: All user-facing text uses BusinessConfig terminology
- [ ] **Visual Customization**: Component applies BusinessConfig branding
- [ ] **TypeScript Strict**: No any types, proper interfaces defined
- [ ] **Cross-Business Testing**: Tested with HVAC, cleaning, and personal care configs
- [ ] **Documentation Complete**: Extraction documented with examples
- [ ] **Import Paths Updated**: All imports reference template structure

## Common Pitfalls

### Over-Generalization
❌ **Wrong**: Making every aspect configurable
```typescript
// Too complex
interface BusinessConfig {
  cardBorderRadius: number;
  fontFamily: string;
  animationDuration: number;
  // ... 50 more visual properties
}
```

✅ **Right**: Focus on meaningful business differences
```typescript
// Appropriate generalization
interface BusinessConfig {
  terminology: { serviceItem: string; client: string; worker: string };
  features: { photos: boolean; signatures: boolean; gps: boolean };
  branding: { primaryColor: string; secondaryColor: string };
}
```

### Under-Generalization
❌ **Wrong**: Hardcoding business-specific terms
```typescript
// Still ScheduleBoard specific
<h2>Today's Jobs</h2>
<p>Assigned to technician: {worker.name}</p>
```

✅ **Right**: Using configurable terminology
```typescript
// Business type adaptable
<h2>Today's {config.terminology.serviceItems}</h2>
<p>Assigned to {config.terminology.worker}: {worker.name}</p>
```

### Breaking Mobile Optimization
❌ **Wrong**: Removing mobile-specific code during extraction
```typescript
// Lost mobile optimization
<Button onClick={handleClick}>Submit</Button>
```

✅ **Right**: Preserving mobile patterns
```typescript
// Mobile optimization preserved
<Button 
  onClick={handleClick}
  className="min-h-[44px] touch-friendly"
  size="lg"
>
  Submit
</Button>
```

This systematic approach ensures we maintain ScheduleBoard v2's production quality while creating a flexible template system that serves multiple service business types effectively.