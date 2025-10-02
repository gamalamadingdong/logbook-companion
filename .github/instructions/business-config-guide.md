# Business Configuration System Guide

## Overview
The Application Configuration system is the core mechanism that allows SGE template components to adapt across different application types and domains while maintaining consistency and quality.

## Configuration Structure

### Main Configuration Interface
```typescript
export interface BusinessConfig {
  type: BusinessType;
  terminology: BusinessTerminology;
  features: BusinessFeatures;
  branding: BusinessBranding;
  compliance: ComplianceRequirements;
  industry: IndustrySpecific;
}

export type ApplicationType = 
  | 'service-business'     // Service industry applications
  | 'productivity'         // Task management, productivity tools
  | 'e-commerce'          // Shopping, marketplace applications
  | 'content-management'  // CMS, blog platforms
  | 'social'              // Social networking features
  | 'educational'         // Learning management, courses
  | 'healthcare'          // Patient management, telehealth  
  | 'financial'           // Fintech, expense tracking
  | 'custom';             // Fully customizable applications
```

### Terminology Adaptation
Different business types use different terms for the same concepts:

```typescript
export interface ApplicationTerminology {
  // Core items/entities
  primaryItem: string;        // "job" | "task" | "order" | "post" | "course"
  primaryItems: string;       // "jobs" | "tasks" | "orders" | "posts" | "courses"
  
  // People/Users
  primaryUser: string;        // "worker" | "employee" | "user" | "member"
  primaryUsers: string;       // "workers" | "employees" | "users" | "members"
  secondaryUser: string;      // "client" | "customer" | "subscriber" | "student"
  secondaryUsers: string;     // "clients" | "customers" | "subscribers" | "students"
  
  // Locations & Equipment
  location: string;           // "property" | "location" | "site" | "home"
  equipment: string;          // "tools" | "supplies" | "equipment" | "products"
  
  // Time & Scheduling
  schedule: string;           // "schedule" | "route" | "appointments" | "bookings"
  timeSlot: string;          // "time slot" | "appointment time" | "service window"
  
  // Work & Documentation
  workOrder: string;          // "work order" | "service request" | "ticket"
  completion: string;         // "job completion" | "service completion" | "visit summary"
}
```

### Feature Toggles
Business types have different feature requirements:

```typescript
export interface BusinessFeatures {
  // Documentation
  photos: boolean;            // Before/after photos
  signatures: boolean;        // Customer signatures
  notes: boolean;            // Service notes
  
  // Tracking & Location
  gps: boolean;              // GPS tracking
  mileage: boolean;          // Mileage tracking
  geofencing: boolean;       // Location verification
  
  // Scheduling
  recurring: boolean;        // Recurring services
  routing: boolean;          // Route optimization
  timeWindows: boolean;      // Appointment windows
  
  // Business Operations
  inventory: boolean;        // Inventory management
  equipment: boolean;        // Equipment tracking
  compliance: boolean;       // Regulatory compliance
  
  // Customer Experience
  notifications: boolean;    // Customer notifications
  portal: boolean;          // Customer portal
  ratings: boolean;         // Service ratings
  
  // Financial
  invoicing: boolean;       // Built-in invoicing
  payments: boolean;        // Payment processing
  estimates: boolean;       // Estimate/bid system
}
```

### Visual Branding
Each business type can have custom branding:

```typescript
export interface BusinessBranding {
  primaryColor: string;      // Main brand color
  secondaryColor: string;    // Accent color
  logo?: string;            // Company logo URL
  fonts?: {
    heading: string;        // Heading font family
    body: string;          // Body text font family
  };
  theme: 'light' | 'dark' | 'auto';
}
```

### Industry-Specific Configuration
Special requirements for specific industries:

```typescript
export interface IndustrySpecific {
  // HVAC specific
  hvac?: {
    refrigerantTracking: boolean;
    maintenanceContracts: boolean;
    emergencyServices: boolean;
  };
  
  // Cleaning specific
  cleaning?: {
    qualityChecklists: boolean;
    supplyTracking: boolean;
    deepCleaningSchedules: boolean;
  };
  
  // Personal care specific
  personalCare?: {
    appointmentReminders: boolean;
    serviceMenus: boolean;
    clientPreferences: boolean;
  };
}
```

## Predefined Business Configurations

### HVAC Configuration
```typescript
export const hvacConfig: BusinessConfig = {
  type: 'hvac',
  terminology: {
    serviceItem: 'job',
    serviceItems: 'jobs',
    worker: 'technician',
    workers: 'technicians',
    client: 'customer',
    clients: 'customers',
    location: 'property',
    equipment: 'equipment',
    schedule: 'schedule',
    timeSlot: 'service window',
    workOrder: 'work order',
    completion: 'job completion'
  },
  features: {
    photos: true,
    signatures: true,
    notes: true,
    gps: true,
    mileage: true,
    geofencing: true,
    recurring: true,
    routing: true,
    timeWindows: true,
    inventory: true,
    equipment: true,
    compliance: true,
    notifications: true,
    portal: true,
    ratings: true,
    invoicing: true,
    payments: true,
    estimates: true
  },
  branding: {
    primaryColor: '#2563eb',
    secondaryColor: '#dc2626',
    theme: 'light'
  },
  compliance: {
    epaRequirements: true,
    certificationTracking: true,
    safetyProtocols: true
  },
  industry: {
    hvac: {
      refrigerantTracking: true,
      maintenanceContracts: true,
      emergencyServices: true
    }
  }
};
```

### Cleaning Service Configuration
```typescript
export const cleaningConfig: BusinessConfig = {
  type: 'cleaning',
  terminology: {
    serviceItem: 'cleaning',
    serviceItems: 'cleanings',
    worker: 'cleaner',
    workers: 'cleaners',
    client: 'client',
    clients: 'clients',
    location: 'home',
    equipment: 'supplies',
    schedule: 'route',
    timeSlot: 'appointment time',
    workOrder: 'service request',
    completion: 'cleaning summary'
  },
  features: {
    photos: true,          // Before/after cleaning photos
    signatures: true,
    notes: true,
    gps: false,           // Less critical for cleaning
    mileage: true,
    geofencing: false,
    recurring: true,      // Most cleaning is recurring
    routing: true,        // Route optimization important
    timeWindows: false,   // More flexible timing
    inventory: true,      // Supply tracking
    equipment: false,     // Supplies vs equipment
    compliance: false,    // Minimal regulatory requirements
    notifications: true,
    portal: true,
    ratings: true,
    invoicing: true,
    payments: true,
    estimates: true
  },
  branding: {
    primaryColor: '#059669',
    secondaryColor: '#7c3aed',
    theme: 'light'
  },
  compliance: {
    epaRequirements: false,
    certificationTracking: false,
    safetyProtocols: true
  },
  industry: {
    cleaning: {
      qualityChecklists: true,
      supplyTracking: true,
      deepCleaningSchedules: true
    }
  }
};
```

### Personal Care Configuration
```typescript
export const personalCareConfig: BusinessConfig = {
  type: 'personal-care',
  terminology: {
    serviceItem: 'appointment',
    serviceItems: 'appointments',
    worker: 'stylist',
    workers: 'stylists',
    client: 'client',
    clients: 'clients',
    location: 'location',
    equipment: 'tools',
    schedule: 'appointments',
    timeSlot: 'appointment time',
    workOrder: 'booking',
    completion: 'service summary'
  },
  features: {
    photos: true,          // Before/after styling photos
    signatures: false,     // Not typically needed
    notes: true,
    gps: false,           // Salon/spa based
    mileage: false,       // Stationary business
    geofencing: false,
    recurring: true,      // Regular appointments
    routing: false,       // No route optimization needed
    timeWindows: true,    // Precise appointment times
    inventory: true,      // Product tracking
    equipment: false,     // Tools vs equipment
    compliance: false,    // Minimal regulatory requirements
    notifications: true,  // Appointment reminders critical
    portal: true,
    ratings: true,
    invoicing: true,
    payments: true,
    estimates: false      // Services are typically menu-priced
  },
  branding: {
    primaryColor: '#ec4899',
    secondaryColor: '#8b5cf6',
    theme: 'light'
  },
  compliance: {
    epaRequirements: false,
    certificationTracking: true,  // Cosmetology licenses
    safetyProtocols: true
  },
  industry: {
    personalCare: {
      appointmentReminders: true,
      serviceMenus: true,
      clientPreferences: true
    }
  }
};
```

## Component Integration Patterns

### Using BusinessConfig in Components
```typescript
import { useBusinessConfig } from '@sge/shared/hooks/useBusinessConfig';

export function ServiceItemCard({ item, onSelect }: ServiceItemCardProps) {
  const config = useBusinessConfig();
  
  return (
    <Card className="mb-4" style={{ borderColor: config.branding.primaryColor }}>
      <CardHeader>
        <CardTitle>{config.terminology.serviceItem} #{item.id}</CardTitle>
        <CardDescription>
          {config.terminology.client}: {item.client.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p><strong>{config.terminology.location}:</strong> {item.location.address}</p>
          <p><strong>{config.terminology.worker}:</strong> {item.assignedWorker.name}</p>
          
          {config.features.timeWindows && (
            <p><strong>{config.terminology.timeSlot}:</strong> {item.timeWindow}</p>
          )}
          
          {config.features.equipment && (
            <p><strong>{config.terminology.equipment}:</strong> {item.requiredEquipment}</p>
          )}
        </div>
      </CardContent>
      
      {config.features.photos && (
        <CardFooter>
          <Button 
            onClick={() => onSelect(item)}
            style={{ backgroundColor: config.branding.primaryColor }}
          >
            View Photos
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

### Context Provider Setup
```typescript
import { BusinessConfigProvider } from '@sge/shared/providers/BusinessConfigProvider';
import { hvacConfig, cleaningConfig, personalCareConfig } from '@sge/shared/config/businessConfigs';

function App() {
  // Configuration determined by business setup or user selection
  const [businessType, setBusinessType] = useState<BusinessType>('hvac');
  
  const getConfig = (type: BusinessType) => {
    switch (type) {
      case 'hvac': return hvacConfig;
      case 'cleaning': return cleaningConfig;
      case 'personal-care': return personalCareConfig;
      default: return hvacConfig;
    }
  };
  
  return (
    <BusinessConfigProvider config={getConfig(businessType)}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          {/* All routes have access to business config */}
        </Routes>
      </Router>
    </BusinessConfigProvider>
  );
}
```

### Hook Implementation
```typescript
// useBusinessConfig.ts
import { createContext, useContext } from 'react';

export const BusinessConfigContext = createContext<BusinessConfig | null>(null);

export function useBusinessConfig(): BusinessConfig {
  const config = useContext(BusinessConfigContext);
  if (!config) {
    throw new Error('useBusinessConfig must be used within BusinessConfigProvider');
  }
  return config;
}

// Optional: Hook for checking specific features
export function useFeature(feature: keyof BusinessFeatures): boolean {
  const config = useBusinessConfig();
  return config.features[feature];
}

// Optional: Hook for terminology
export function useTerminology(): BusinessTerminology {
  const config = useBusinessConfig();
  return config.terminology;
}
```

## Configuration Validation

### Runtime Validation
```typescript
import { z } from 'zod';

const BusinessConfigSchema = z.object({
  type: z.enum(['hvac', 'plumbing', 'electrical', 'cleaning', 'landscaping', 'personal-care', 'pool-service', 'pest-control']),
  terminology: z.object({
    serviceItem: z.string().min(1),
    serviceItems: z.string().min(1),
    worker: z.string().min(1),
    workers: z.string().min(1),
    client: z.string().min(1),
    clients: z.string().min(1),
    location: z.string().min(1),
    equipment: z.string().min(1),
    schedule: z.string().min(1),
    timeSlot: z.string().min(1),
    workOrder: z.string().min(1),
    completion: z.string().min(1)
  }),
  features: z.object({
    photos: z.boolean(),
    signatures: z.boolean(),
    notes: z.boolean(),
    gps: z.boolean(),
    mileage: z.boolean(),
    geofencing: z.boolean(),
    recurring: z.boolean(),
    routing: z.boolean(),
    timeWindows: z.boolean(),
    inventory: z.boolean(),
    equipment: z.boolean(),
    compliance: z.boolean(),
    notifications: z.boolean(),
    portal: z.boolean(),
    ratings: z.boolean(),
    invoicing: z.boolean(),
    payments: z.boolean(),
    estimates: z.boolean()
  }),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    theme: z.enum(['light', 'dark', 'auto'])
  })
});

export function validateBusinessConfig(config: unknown): BusinessConfig {
  return BusinessConfigSchema.parse(config);
}
```

## Best Practices

### 1. Always Use Configuration
❌ **Wrong**: Hardcoded business-specific terms
```typescript
<h2>Today's Jobs</h2>
<p>Assigned technician: {worker.name}</p>
```

✅ **Right**: Configuration-driven text
```typescript
const { terminology } = useBusinessConfig();
<h2>Today's {terminology.serviceItems}</h2>
<p>Assigned {terminology.worker}: {worker.name}</p>
```

### 2. Feature-Based Conditional Rendering
❌ **Wrong**: Business type checking
```typescript
{businessType === 'hvac' && <ComplianceTracker />}
{businessType === 'cleaning' && <QualityChecklist />}
```

✅ **Right**: Feature-based rendering
```typescript
const { features } = useBusinessConfig();
{features.compliance && <ComplianceTracker />}
{features.photos && <PhotoUpload />}
```

### 3. Graceful Feature Degradation
```typescript
function ServiceItemDetails({ item }: ServiceItemDetailsProps) {
  const { features, terminology } = useBusinessConfig();
  
  return (
    <div>
      <h3>{terminology.serviceItem} Details</h3>
      
      {/* Core information always shown */}
      <div>
        <p>{terminology.client}: {item.client.name}</p>
        <p>{terminology.location}: {item.location.address}</p>
      </div>
      
      {/* Optional features gracefully hidden if not supported */}
      {features.timeWindows && (
        <div>
          <p>{terminology.timeSlot}: {item.timeWindow}</p>
        </div>
      )}
      
      {features.equipment && (
        <div>
          <p>{terminology.equipment}: {item.requiredEquipment}</p>
        </div>
      )}
    </div>
  );
}
```

This business configuration system ensures that extracted components from ScheduleBoard v2 can seamlessly adapt to different service business types while maintaining the high-quality mobile-first experience and production reliability.