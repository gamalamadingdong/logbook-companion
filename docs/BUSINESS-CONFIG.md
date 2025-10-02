# Business Type Configuration System

This document outlines the business type configuration system that allows the SGE template to adapt to different service business types while maintaining the same core architecture.

## Business Type Definitions

```typescript
type BusinessType = 
  | 'hvac'           // Heating, Ventilation, Air Conditioning
  | 'plumbing'       // Plumbing services
  | 'electrical'     // Electrical services
  | 'landscaping'    // Landscaping and outdoor services
  | 'cleaning'       // Cleaning services
  | 'maintenance'    // General maintenance services
  | 'personal-care'  // Beauty, fitness, tutoring
  | 'mobile-repair'  // Device and equipment repair
  | 'healthcare'     // Mobile healthcare services
  | 'consulting';    // Professional consulting services

interface BusinessConfig {
  type: BusinessType;
  
  // Visual branding
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logo?: string;
    appIcon?: string;
    splashScreen?: string;
  };
  
  // Industry-specific terminology
  terminology: {
    serviceItem: string;    // 'job', 'task', 'appointment', 'service', 'project'
    serviceItems: string;   // plural form
    client: string;         // 'customer', 'client', 'patient', 'homeowner'
    clients: string;        // plural form
    worker: string;         // 'technician', 'cleaner', 'specialist', 'contractor'
    workers: string;        // plural form
    location: string;       // 'site', 'property', 'address', 'venue'
  };
  
  // Feature enablement
  features: {
    scheduling: boolean;
    photos: boolean;
    signatures: boolean;
    gps: boolean;
    compliance: boolean;
    quotes: boolean;
    inventory: boolean;
    timeTracking: boolean;
    qualityControl: boolean;
    clientPortal: boolean;
  };
  
  // Service-specific fields
  serviceFields: {
    duration: boolean;      // Show estimated/actual duration
    materials: boolean;     // Track materials/supplies used
    equipment: boolean;     // Track equipment assignments
    permits: boolean;       // Permit and compliance tracking
    beforeAfter: boolean;   // Before/after photo workflows
    satisfaction: boolean;  // Client satisfaction surveys
  };
  
  // Status workflows
  statusWorkflow: {
    draft: string;
    scheduled: string;
    inProgress: string;
    completed: string;
    cancelled: string;
    onHold?: string;
    approved?: string;
    invoiced?: string;
  };
  
  // Compliance requirements
  compliance: {
    licenses: string[];     // Required license types
    certifications: string[]; // Required certifications
    insurance: string[];    // Insurance requirements
    backgroundCheck: boolean;
    drugTesting: boolean;
  };
  
  // Mobile app configuration
  mobile: {
    offlineMode: boolean;
    gpsTracking: boolean;
    cameraRequired: boolean;
    nativeDialing: boolean;
    mapIntegration: boolean;
    pushNotifications: boolean;
  };
}
```

## Predefined Business Configurations

### HVAC Services
```typescript
const hvacConfig: BusinessConfig = {
  type: 'hvac',
  branding: {
    primaryColor: '#2563eb',  // Blue
    secondaryColor: '#64748b', // Slate
    accentColor: '#f59e0b'    // Amber
  },
  terminology: {
    serviceItem: 'job',
    serviceItems: 'jobs',
    client: 'customer',
    clients: 'customers',
    worker: 'technician',
    workers: 'technicians',
    location: 'site'
  },
  features: {
    scheduling: true,
    photos: true,
    signatures: true,
    gps: true,
    compliance: true,
    quotes: true,
    inventory: true,
    timeTracking: true,
    qualityControl: true,
    clientPortal: false
  },
  serviceFields: {
    duration: true,
    materials: true,
    equipment: true,
    permits: true,
    beforeAfter: true,
    satisfaction: true
  },
  statusWorkflow: {
    draft: 'Draft',
    scheduled: 'Scheduled',
    inProgress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    approved: 'Approved',
    invoiced: 'Invoiced'
  },
  compliance: {
    licenses: ['HVAC License', 'Business License'],
    certifications: ['EPA Certification', 'NATE Certification'],
    insurance: ['General Liability', 'Workers Compensation'],
    backgroundCheck: true,
    drugTesting: false
  },
  mobile: {
    offlineMode: true,
    gpsTracking: true,
    cameraRequired: true,
    nativeDialing: true,
    mapIntegration: true,
    pushNotifications: true
  }
};
```

### Cleaning Services
```typescript
const cleaningConfig: BusinessConfig = {
  type: 'cleaning',
  branding: {
    primaryColor: '#10b981',  // Emerald
    secondaryColor: '#6b7280', // Gray
    accentColor: '#f59e0b'    // Amber
  },
  terminology: {
    serviceItem: 'appointment',
    serviceItems: 'appointments',
    client: 'client',
    clients: 'clients',
    worker: 'cleaner',
    workers: 'cleaners',
    location: 'property'
  },
  features: {
    scheduling: true,
    photos: true,
    signatures: false,
    gps: true,
    compliance: false,
    quotes: false,
    inventory: false,
    timeTracking: true,
    qualityControl: true,
    clientPortal: true
  },
  serviceFields: {
    duration: true,
    materials: false,
    equipment: false,
    permits: false,
    beforeAfter: true,
    satisfaction: true
  },
  statusWorkflow: {
    draft: 'Scheduled',
    scheduled: 'Scheduled',
    inProgress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  },
  compliance: {
    licenses: ['Business License'],
    certifications: [],
    insurance: ['General Liability', 'Bonding'],
    backgroundCheck: true,
    drugTesting: false
  },
  mobile: {
    offlineMode: false,
    gpsTracking: true,
    cameraRequired: true,
    nativeDialing: true,
    mapIntegration: true,
    pushNotifications: true
  }
};
```

### Personal Care Services
```typescript
const personalCareConfig: BusinessConfig = {
  type: 'personal-care',
  branding: {
    primaryColor: '#ec4899',  // Pink
    secondaryColor: '#9ca3af', // Gray
    accentColor: '#6366f1'    // Indigo
  },
  terminology: {
    serviceItem: 'appointment',
    serviceItems: 'appointments',
    client: 'client',
    clients: 'clients',
    worker: 'specialist',
    workers: 'specialists',
    location: 'location'
  },
  features: {
    scheduling: true,
    photos: false,
    signatures: false,
    gps: false,
    compliance: true,
    quotes: false,
    inventory: false,
    timeTracking: true,
    qualityControl: false,
    clientPortal: true
  },
  serviceFields: {
    duration: true,
    materials: false,
    equipment: false,
    permits: false,
    beforeAfter: false,
    satisfaction: true
  },
  statusWorkflow: {
    draft: 'Booked',
    scheduled: 'Scheduled',
    inProgress: 'In Session',
    completed: 'Completed',
    cancelled: 'Cancelled'
  },
  compliance: {
    licenses: ['Professional License', 'Business License'],
    certifications: ['Industry Certification'],
    insurance: ['Professional Liability', 'General Liability'],
    backgroundCheck: true,
    drugTesting: false
  },
  mobile: {
    offlineMode: false,
    gpsTracking: false,
    cameraRequired: false,
    nativeDialing: true,
    mapIntegration: true,
    pushNotifications: true
  }
};
```

## Component Integration

Components use the business configuration through a React context:

```typescript
import { useBusinessConfig } from '@sge/shared/hooks/useBusinessConfig';

export function ServiceItemCard({ item }: { item: ServiceItem }) {
  const config = useBusinessConfig();
  
  return (
    <Card style={{ borderColor: config.branding.primaryColor }}>
      <CardHeader>
        <CardTitle>{config.terminology.serviceItem}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{config.terminology.client}: {item.clientName}</p>
        <p>{config.terminology.worker}: {item.workerName}</p>
        {config.features.photos && (
          <PhotoGallery photos={item.photos} />
        )}
        {config.features.signatures && (
          <SignatureField signature={item.signature} />
        )}
      </CardContent>
    </Card>
  );
}
```

## CLI Generator Integration

The business configuration is selected during project generation:

```bash
npx @sge/create-app my-cleaning-business
✨ What type of service business? cleaning
📱 Include mobile app deployment? Yes
💳 Include subscription management? Yes

# Automatically applies cleaningConfig and sets up:
# - Component styling with emerald color scheme
# - "appointment" terminology throughout
# - Photo workflows enabled
# - Client portal enabled
# - Appropriate compliance settings
```

This system allows the same template architecture to adapt seamlessly across different service business types while maintaining consistency and professional appearance.