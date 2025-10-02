#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

// Business type configurations
const BUSINESS_TYPES = {
  hvac: {
    name: 'HVAC Services',
    description: 'Heating, Ventilation, Air Conditioning',
    features: ['scheduling', 'photos', 'signatures', 'gps', 'compliance', 'quotes', 'inventory']
  },
  plumbing: {
    name: 'Plumbing Services', 
    description: 'Residential and commercial plumbing',
    features: ['scheduling', 'photos', 'signatures', 'gps', 'compliance', 'quotes', 'inventory']
  },
  electrical: {
    name: 'Electrical Services',
    description: 'Electrical installation and repair',
    features: ['scheduling', 'photos', 'signatures', 'gps', 'compliance', 'quotes', 'inventory']
  },
  landscaping: {
    name: 'Landscaping Services',
    description: 'Landscaping and outdoor services',
    features: ['scheduling', 'photos', 'gps', 'quotes', 'inventory']
  },
  cleaning: {
    name: 'Cleaning Services',
    description: 'Residential and commercial cleaning',
    features: ['scheduling', 'photos', 'gps', 'qualityControl', 'clientPortal']
  },
  'personal-care': {
    name: 'Personal Care Services',
    description: 'Beauty, fitness, tutoring, healthcare',
    features: ['scheduling', 'clientPortal', 'compliance']
  },
  'mobile-repair': {
    name: 'Mobile Repair Services',
    description: 'Device and equipment repair',
    features: ['scheduling', 'photos', 'signatures', 'inventory', 'quotes']
  }
};

async function promptForConfiguration() {
  console.log(chalk.blue.bold('🚀 Welcome to Service Grid Engine\n'));
  console.log(chalk.gray('Let\'s set up your service business application...\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: 'my-service-business',
      validate: (input) => {
        if (/^[a-z0-9-]+$/.test(input)) return true;
        return 'Project name must contain only lowercase letters, numbers, and hyphens';
      }
    },
    {
      type: 'list',
      name: 'businessType',
      message: 'What type of service business?',
      choices: Object.entries(BUSINESS_TYPES).map(([key, config]) => ({
        name: `${config.name} - ${config.description}`,
        value: key
      }))
    },
    {
      type: 'confirm',
      name: 'includeMobile',
      message: '📱 Include mobile app deployment (iOS/Android)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeSubscriptions',
      message: '💳 Include subscription management (Stripe)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeNotifications',
      message: '🔔 Include notification system (Email/SMS/Push)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeMapping',
      message: '🗺️ Include mapping features (GPS/Location)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'multiTenant',
      message: '🏢 Multi-tenant setup (multiple businesses)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeAnalytics',
      message: '📊 Include analytics dashboard?',
      default: true
    }
  ]);

  return answers;
}

async function generateProject(config) {
  const spinner = ora('Creating your service business application...').start();
  
  try {
    // 1. Clone template
    spinner.text = 'Cloning template repository...';
    // TODO: Implement template cloning
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    
    // 2. Configure business type
    spinner.text = 'Configuring business type...';
    await configureBusinessType(config);
    
    // 3. Set up mobile if requested
    if (config.includeMobile) {
      spinner.text = 'Setting up mobile deployment...';
      await setupMobileDeployment(config);
    }
    
    // 4. Configure subscriptions
    if (config.includeSubscriptions) {
      spinner.text = 'Setting up subscription management...';
      await setupSubscriptions(config);
    }
    
    // 5. Install dependencies
    spinner.text = 'Installing dependencies...';
    await installDependencies(config);
    
    // 6. Initialize database
    spinner.text = 'Setting up database schema...';
    await setupDatabase(config);
    
    spinner.succeed(chalk.green('✅ Project created successfully!'));
    
    // Show next steps
    showNextSteps(config);
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Failed to create project'));
    console.error(error);
    process.exit(1);
  }
}

async function configureBusinessType(config) {
  // TODO: Apply business type configuration
  console.log(`Configuring for ${BUSINESS_TYPES[config.businessType].name}...`);
}

async function setupMobileDeployment(config) {
  // TODO: Set up Capacitor, iOS/Android configs
  console.log('Setting up Capacitor for mobile deployment...');
}

async function setupSubscriptions(config) {
  // TODO: Configure Stripe integration
  console.log('Setting up Stripe subscription management...');
}

async function installDependencies(config) {
  // TODO: Run npm install
  console.log('Installing npm dependencies...');
}

async function setupDatabase(config) {
  // TODO: Initialize Supabase schema
  console.log('Setting up Supabase database...');
}

function showNextSteps(config) {
  console.log(chalk.blue.bold('\n🎉 Your service business app is ready!\n'));
  
  console.log(chalk.yellow('Next steps:'));
  console.log(`  ${chalk.cyan('cd')} ${config.projectName}`);
  console.log(`  ${chalk.cyan('npm run dev')}     # Start development server`);
  
  if (config.includeMobile) {
    console.log(`  ${chalk.cyan('npm run build:mobile')}  # Build for mobile`);
  }
  
  console.log('\n📚 Documentation:');
  console.log('  • Setup guide: docs/README.md');
  console.log('  • Mobile deployment: docs/MOBILE-DEPLOYMENT.md');
  console.log('  • Component library: docs/COMPONENTS.md');
  
  console.log('\n🔗 Useful commands:');
  console.log(`  ${chalk.cyan('npm run dev')}           # Development server`);
  console.log(`  ${chalk.cyan('npm run build')}         # Production build`);
  console.log(`  ${chalk.cyan('npm run test')}          # Run tests`);
  console.log(`  ${chalk.cyan('npm run storybook')}     # Component library`);
  
  if (config.includeMobile) {
    console.log(`  ${chalk.cyan('npm run ios:build')}     # Build iOS app`);
    console.log(`  ${chalk.cyan('npm run android:build')} # Build Android app`);
  }
  
  console.log(chalk.green('\n🚀 Happy building!'));
}

// CLI Program setup
program
  .name('create-sge-app')
  .description('Create a new Service Grid Engine application')
  .version('0.1.0')
  .argument('[project-name]', 'Project name')
  .option('-t, --type <type>', 'Business type (hvac, plumbing, electrical, etc.)')
  .option('--no-mobile', 'Skip mobile app setup')
  .option('--no-subscriptions', 'Skip subscription management')
  .option('--no-notifications', 'Skip notification system')
  .action(async (projectName, options) => {
    let config;
    
    if (projectName && options.type) {
      // Non-interactive mode
      config = {
        projectName,
        businessType: options.type,
        includeMobile: options.mobile !== false,
        includeSubscriptions: options.subscriptions !== false,
        includeNotifications: options.notifications !== false,
        includeMapping: true,
        multiTenant: true,
        includeAnalytics: true
      };
    } else {
      // Interactive mode
      config = await promptForConfiguration();
    }
    
    await generateProject(config);
  });

program.parse();