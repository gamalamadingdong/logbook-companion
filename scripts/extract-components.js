#!/usr/bin/env node

/**
 * Component Extraction Script
 * Extracts production-ready components from ScheduleBoard v2 and generalizes them for the SGE template
 */

import { promises as fs } from 'fs';
import path from 'path';

const SCHEDULEBOARD_PATH = '../scheduleboardv2';
const TEMPLATE_PATH = './packages';

// Component extraction mapping
const COMPONENT_EXTRACTIONS = [
  {
    source: 'src/components/mobile/SmartDashboard.tsx',
    destination: 'ui/mobile/SmartDashboard.tsx',
    generalization: 'Remove ScheduleBoard branding, add business type routing'
  },
  {
    source: 'src/components/mobile/TodaysWork.tsx',
    destination: 'ui/mobile/TodaysWork.tsx',
    generalization: 'Abstract job terminology to service items'
  },
  {
    source: 'src/components/layout/MobileBottomNav.tsx',
    destination: 'ui/navigation/MobileBottomNav.tsx',
    generalization: 'Make navigation items configurable per business type'
  },
  {
    source: 'src/components/mobile/MobileJobs.tsx',
    destination: 'ui/mobile/MobileJobs.tsx',
    generalization: 'Abstract to generic service management'
  },
  {
    source: 'src/components/mobile/ResponsiveJobs.tsx',
    destination: 'ui/mobile/ResponsiveJobs.tsx',
    generalization: 'Add business type variations'
  },
  {
    source: 'src/components/subscription/FeatureGate.tsx',
    destination: 'ui/subscription/FeatureGate.tsx',
    generalization: 'Make feature flags configurable per business type'
  },
  {
    source: 'src/lib/dateUtils.ts',
    destination: 'shared/lib/dateUtils.ts',
    generalization: 'Keep as-is, already generic'
  },
  {
    source: 'src/hooks/use-mobile.ts',
    destination: 'shared/hooks/use-mobile.ts',
    generalization: 'Keep as-is'
  },
  {
    source: 'src/lib/mobileSubscriptionCompliance.ts',
    destination: 'shared/lib/mobileCompliance.ts',
    generalization: 'Keep as-is, already generic'
  }
];

async function extractComponent(extraction) {
  const sourcePath = path.join(SCHEDULEBOARD_PATH, extraction.source);
  const destPath = path.join(TEMPLATE_PATH, extraction.destination);
  
  try {
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    // Read source component
    const sourceContent = await fs.readFile(sourcePath, 'utf-8');
    
    // Apply generalization transformations
    let generalizedContent = sourceContent;
    
    // Common generalizations
    generalizedContent = generalizedContent
      .replace(/ScheduleBoard/g, 'ServiceGrid')
      .replace(/scheduleboard/g, 'servicegrid')
      .replace(/job/g, 'serviceItem')  // This might be too aggressive, need refinement
      .replace(/Job/g, 'ServiceItem')
      .replace(/customer/g, 'client')
      .replace(/Customer/g, 'Client');
    
    // Add business type configuration props where needed
    if (extraction.destination.includes('mobile/')) {
      generalizedContent = addBusinessTypeConfig(generalizedContent);
    }
    
    // Write generalized component
    await fs.writeFile(destPath, generalizedContent);
    
    console.log(`✅ Extracted: ${extraction.source} → ${extraction.destination}`);
    console.log(`   Generalization: ${extraction.generalization}`);
    
  } catch (error) {
    console.error(`❌ Failed to extract ${extraction.source}:`, error.message);
  }
}

function addBusinessTypeConfig(content) {
  // Add business type configuration interface
  const businessTypeInterface = `
interface BusinessTypeConfig {
  type: 'hvac' | 'plumbing' | 'electrical' | 'landscaping' | 'cleaning' | 'maintenance';
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
  };
  terminology: {
    serviceItem: string; // 'job', 'task', 'appointment', 'service'
    client: string;      // 'customer', 'client', 'patient'
    worker: string;      // 'technician', 'cleaner', 'specialist'
  };
  features: {
    scheduling: boolean;
    photos: boolean;
    signatures: boolean;
    gps: boolean;
    compliance: boolean;
  };
}
`;
  
  // Insert interface after imports
  return content.replace(
    /(import.*from.*;\n)+/,
    `$&\n${businessTypeInterface}\n`
  );
}

async function main() {
  console.log('🚀 Starting component extraction from ScheduleBoard v2...\n');
  
  // Check if ScheduleBoard path exists
  try {
    await fs.access(SCHEDULEBOARD_PATH);
  } catch (error) {
    console.error(`❌ ScheduleBoard path not found: ${SCHEDULEBOARD_PATH}`);
    console.error('Make sure the ScheduleBoard v2 repository is available at the expected path.');
    process.exit(1);
  }
  
  // Extract each component
  for (const extraction of COMPONENT_EXTRACTIONS) {
    await extractComponent(extraction);
  }
  
  console.log('\n✅ Component extraction complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Review generalized components in packages/ui/ and packages/shared/');
  console.log('2. Test components with different business type configurations');
  console.log('3. Update import paths and fix any TypeScript errors');
  console.log('4. Add business-type-specific variations as needed');
}

main().catch(console.error);