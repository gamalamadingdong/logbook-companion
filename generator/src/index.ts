#!/usr/bin/env node

/**
 * CREATE-SGE-APP CLI Generator
 * 
 * Interactive CLI tool to scaffold new SGE applications with:
 * - Authentication & user management
 * - Multi-channel notifications
 * - Stripe subscription management
 * - Mobile app support (iOS/Android)
 * - Multi-tenant database architecture
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { execa } from 'execa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

// Package manager detection
type PackageManager = 'npm' | 'yarn' | 'pnpm';

interface ProjectConfig {
  projectName: string;
  projectPath: string;
  packageManager: PackageManager;
  includeMobile: boolean;
  includeSubscriptions: boolean;
  includeNotifications: boolean;
  emailProvider: 'resend' | 'sendgrid' | 'none';
  includeAuth: boolean;
  skipInstall: boolean;
  
  // Supabase configuration
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  
  // Optional API keys
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  resendApiKey?: string;
}

/**
 * Detect the package manager being used in the current environment
 */
function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent;
  
  if (userAgent) {
    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('pnpm')) return 'pnpm';
  }
  
  return 'npm';
}

/**
 * Run interactive prompts to configure the project
 */
async function runInteractivePrompts(): Promise<ProjectConfig> {
  console.log(chalk.cyan.bold('\n🚀 Create SGE App\n'));
  console.log(chalk.gray('Let\'s set up your new SGE application!\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-sge-app',
      validate: (input: string) => {
        if (!input) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Project name must be lowercase with hyphens only';
        return true;
      }
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Which package manager?',
      choices: ['npm', 'yarn', 'pnpm'],
      default: detectPackageManager()
    },
    {
      type: 'confirm',
      name: 'includeAuth',
      message: 'Include authentication (Supabase)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeMobile',
      message: 'Include mobile app support (iOS/Android)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeSubscriptions',
      message: 'Include Stripe subscription management?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeNotifications',
      message: 'Include multi-channel notifications?',
      default: true
    },
    {
      type: 'list',
      name: 'emailProvider',
      message: 'Email provider:',
      choices: [
        { name: 'Resend (recommended)', value: 'resend' },
        { name: 'SendGrid', value: 'sendgrid' },
        { name: 'None (skip email setup)', value: 'none' }
      ],
      default: 'resend',
      when: (answers: any) => answers.includeNotifications
    },
    {
      type: 'confirm',
      name: 'skipInstall',
      message: 'Skip dependency installation?',
      default: false
    }
  ]);

  return {
    ...answers,
    projectPath: path.resolve(process.cwd(), answers.projectName)
  } as ProjectConfig;
}

/**
 * Collect API keys and configuration
 */
async function collectConfiguration(config: ProjectConfig): Promise<ProjectConfig> {
  console.log(chalk.cyan('\n📝 Configuration\n'));
  console.log(chalk.gray('You can skip these for now and configure later in .env\n'));

  const configAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'supabaseUrl',
      message: 'Supabase project URL:',
      when: config.includeAuth,
      validate: (input: string) => {
        if (!input) return true; // Optional
        if (!input.startsWith('https://') || !input.includes('.supabase.co')) {
          return 'Must be a valid Supabase URL (https://xxx.supabase.co)';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'supabaseAnonKey',
      message: 'Supabase anon key:',
      when: (answers: any) => config.includeAuth && answers.supabaseUrl
    },
    {
      type: 'password',
      name: 'supabaseServiceKey',
      message: 'Supabase service role key (for Edge Functions):',
      when: (answers: any) => config.includeAuth && answers.supabaseUrl
    },
    {
      type: 'password',
      name: 'stripeSecretKey',
      message: 'Stripe secret key:',
      when: config.includeSubscriptions
    },
    {
      type: 'input',
      name: 'stripePublishableKey',
      message: 'Stripe publishable key:',
      when: (answers: any) => config.includeSubscriptions && answers.stripeSecretKey
    },
    {
      type: 'password',
      name: 'stripeWebhookSecret',
      message: 'Stripe webhook secret:',
      when: (answers: any) => config.includeSubscriptions && answers.stripeSecretKey
    },
    {
      type: 'password',
      name: 'resendApiKey',
      message: 'Resend API key:',
      when: config.emailProvider === 'resend'
    }
  ]);

  return { ...config, ...configAnswers };
}

/**
 * Clone the template repository to the target directory
 */
async function cloneTemplate(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Cloning template repository...';
  
  try {
    // Get the template directory (parent of generator)
    const templateDir = path.resolve(__dirname, '../..');
    
    // Validate: prevent copying template into subdirectory of itself
    const absoluteProjectPath = path.resolve(config.projectPath);
    const absoluteTemplateDir = path.resolve(templateDir);
    
    if (absoluteProjectPath.startsWith(absoluteTemplateDir)) {
      throw new Error(
        `Cannot create project inside the template directory.\n` +
        `Template: ${absoluteTemplateDir}\n` +
        `Project: ${absoluteProjectPath}\n\n` +
        `Please run this command from outside the sge-starter directory, or specify an absolute path outside the template.`
      );
    }
    
    // Create project directory
    await fs.ensureDir(config.projectPath);
    
    // Copy template files
    await fs.copy(templateDir, config.projectPath, {
      filter: (src: string) => {
        const relativePath = path.relative(templateDir, src);
        
        // Exclude
        if (relativePath.includes('node_modules')) return false;
        if (relativePath.includes('.git')) return false;
        if (relativePath.includes('dist')) return false;
        if (relativePath.startsWith('generator')) return false;
        
        return true;
      }
    });
    
    spinner.succeed('Template cloned successfully');
  } catch (error: any) {
    spinner.fail('Failed to clone template');
    throw new Error(`Clone error: ${error.message}`);
  }
}

/**
 * Generate .env file with configuration
 */
async function generateEnvFile(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Generating environment configuration...';
  
  const envPath = path.join(config.projectPath, '.env');
  const envExamplePath = path.join(config.projectPath, '.env.example');
  
  let envContent = `# SGE Application Environment Variables
# Generated by create-sge-app

# Application
VITE_APP_NAME="${config.projectName}"

`;

  // Supabase configuration
  if (config.includeAuth) {
    envContent += `# Supabase Configuration
VITE_SUPABASE_URL="${config.supabaseUrl || 'https://your-project.supabase.co'}"
VITE_SUPABASE_ANON_KEY="${config.supabaseAnonKey || 'your-anon-key'}"
SUPABASE_SERVICE_ROLE_KEY="${config.supabaseServiceKey || 'your-service-role-key'}"

`;
  }

  // Stripe configuration
  if (config.includeSubscriptions) {
    envContent += `# Stripe Configuration
STRIPE_SECRET_KEY="${config.stripeSecretKey || 'sk_test_xxx'}"
VITE_STRIPE_PUBLISHABLE_KEY="${config.stripePublishableKey || 'pk_test_xxx'}"
STRIPE_WEBHOOK_SECRET="${config.stripeWebhookSecret || 'whsec_xxx'}"

`;
  }

  // Email provider configuration
  if (config.includeNotifications && config.emailProvider !== 'none') {
    if (config.emailProvider === 'resend') {
      envContent += `# Resend Email Configuration
RESEND_API_KEY="${config.resendApiKey || 're_xxx'}"
RESEND_FROM_EMAIL="noreply@yourdomain.com"

`;
    } else if (config.emailProvider === 'sendgrid') {
      envContent += `# SendGrid Email Configuration
SENDGRID_API_KEY="SG.xxx"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

`;
    }
  }

  // Write .env file
  await fs.writeFile(envPath, envContent);
  
  // Also write .env.example with placeholder values
  const exampleContent = envContent.replace(
    /="[^"]*"/g,
    '="YOUR_VALUE_HERE"'
  );
  await fs.writeFile(envExamplePath, exampleContent);
  
  spinner.succeed('Environment configuration generated');
}

/**
 * Configure package.json with project-specific settings
 */
async function configurePackageJson(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Configuring package.json...';
  
  const packageJsonPath = path.join(config.projectPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  // Update project name
  packageJson.name = config.projectName;
  packageJson.version = '0.1.0';
  
  // Remove scripts that aren't applicable
  if (!config.includeMobile) {
    delete packageJson.scripts['build:ios'];
    delete packageJson.scripts['build:android'];
    delete packageJson.scripts['sync:capacitor'];
  }
  
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  
  spinner.succeed('Package configuration updated');
}

/**
 * Remove unused Edge Functions based on configuration
 */
async function removeUnusedFunctions(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Removing unused Edge Functions...';
  
  const functionsDir = path.join(config.projectPath, 'packages/functions');
  
  try {
    if (!config.includeNotifications) {
      await fs.remove(path.join(functionsDir, 'notifications'));
    }
    
    if (!config.includeSubscriptions) {
      await fs.remove(path.join(functionsDir, 'subscriptions'));
    }
    
    if (!config.includeAuth) {
      await fs.remove(path.join(functionsDir, 'auth'));
    }
    
    spinner.succeed('Unused functions removed');
  } catch (error: any) {
    spinner.warn(`Could not remove some functions: ${error.message}`);
  }
}

/**
 * Remove mobile package if not needed
 */
async function removeMobilePackage(config: ProjectConfig, spinner: Ora): Promise<void> {
  if (config.includeMobile) return;
  
  spinner.text = 'Removing mobile package...';
  
  const mobileDir = path.join(config.projectPath, 'packages/mobile');
  
  try {
    await fs.remove(mobileDir);
    spinner.succeed('Mobile package removed');
  } catch (error: any) {
    spinner.warn(`Could not remove mobile package: ${error.message}`);
  }
}

/**
 * Install dependencies using the selected package manager
 */
async function installDependencies(config: ProjectConfig, spinner: Ora): Promise<void> {
  if (config.skipInstall) {
    spinner.info('Skipping dependency installation');
    return;
  }
  
  spinner.text = `Installing dependencies with ${config.packageManager}...`;
  
  try {
    const installCmd = config.packageManager === 'npm' ? 'install' : 
                       config.packageManager === 'yarn' ? '' : 'install';
    
    await execa(config.packageManager, installCmd ? [installCmd] : [], {
      cwd: config.projectPath,
      stdio: 'pipe'
    });
    
    spinner.succeed('Dependencies installed successfully');
  } catch (error: any) {
    spinner.fail('Failed to install dependencies');
    console.log(chalk.yellow('\nYou can install dependencies manually by running:'));
    console.log(chalk.cyan(`  cd ${config.projectName}`));
    console.log(chalk.cyan(`  ${config.packageManager} install`));
  }
}

/**
 * Generate database migration files if Supabase is configured
 */
async function setupDatabase(config: ProjectConfig, spinner: Ora): Promise<void> {
  if (!config.includeAuth || !config.supabaseUrl) {
    spinner.info('Skipping database setup (no Supabase configuration)');
    return;
  }
  
  spinner.text = 'Database setup ready...';
  
  // Database schema files are already in infra/schema/
  // Just provide instructions
  
  spinner.succeed('Database schema ready for deployment');
}

/**
 * Display next steps to the user
 */
function showNextSteps(config: ProjectConfig): void {
  console.log(chalk.green.bold('\n✅ Project created successfully!\n'));
  
  console.log(chalk.cyan.bold('📂 Next steps:\n'));
  
  // Navigate to project
  console.log(chalk.white(`  1. Navigate to your project:`));
  console.log(chalk.gray(`     cd ${config.projectName}\n`));
  
  // Install dependencies if skipped
  if (config.skipInstall) {
    console.log(chalk.white(`  2. Install dependencies:`));
    console.log(chalk.gray(`     ${config.packageManager} install\n`));
  }
  
  // Configure environment
  if (!config.supabaseUrl || !config.stripeSecretKey) {
    console.log(chalk.white(`  ${config.skipInstall ? '3' : '2'}. Configure your environment:`));
    console.log(chalk.gray(`     Edit .env with your API keys\n`));
  }
  
  // Setup Supabase
  if (config.includeAuth) {
    const step = config.skipInstall ? (config.supabaseUrl ? '3' : '4') : (config.supabaseUrl ? '2' : '3');
    console.log(chalk.white(`  ${step}. Set up your Supabase database:`));
    console.log(chalk.gray(`     a. Go to your Supabase project dashboard`));
    console.log(chalk.gray(`     b. Run SQL from infra/schema/core.sql`));
    console.log(chalk.gray(`     c. Run SQL from infra/schema/rls-policies.sql\n`));
  }
  
  // Deploy Edge Functions
  if (config.includeAuth || config.includeNotifications || config.includeSubscriptions) {
    const step = config.skipInstall ? '5' : '4';
    console.log(chalk.white(`  ${step}. Deploy Edge Functions:`));
    console.log(chalk.gray(`     supabase functions deploy\n`));
  }
  
  // Setup Stripe webhooks
  if (config.includeSubscriptions) {
    const step = config.skipInstall ? '6' : '5';
    console.log(chalk.white(`  ${step}. Configure Stripe webhooks:`));
    console.log(chalk.gray(`     Endpoint: https://your-project.supabase.co/functions/v1/stripe-webhooks`));
    console.log(chalk.gray(`     Events: customer.subscription.*, payment_intent.*\n`));
  }
  
  // Start development server
  const finalStep = config.skipInstall ? '7' : '6';
  console.log(chalk.white(`  ${finalStep}. Start development server:`));
  console.log(chalk.gray(`     ${config.packageManager} run dev\n`));
  
  // Documentation links
  console.log(chalk.cyan.bold('📚 Documentation:\n'));
  console.log(chalk.gray(`  • README.md - Project overview`));
  console.log(chalk.gray(`  • docs/QUICKSTART.md - Quick start guide`));
  console.log(chalk.gray(`  • docs/DEVELOPMENT-ROADMAP.md - Development roadmap`));
  
  if (config.includeAuth) {
    console.log(chalk.gray(`  • packages/functions/auth/README.md - Authentication functions`));
  }
  if (config.includeNotifications) {
    console.log(chalk.gray(`  • packages/functions/notifications/README.md - Notification system`));
  }
  if (config.includeSubscriptions) {
    console.log(chalk.gray(`  • packages/functions/subscriptions/README.md - Stripe subscriptions`));
  }
  
  console.log(chalk.green('\nHappy coding! 🚀\n'));
}

/**
 * Main project generation workflow
 */
async function generateProject(config: ProjectConfig): Promise<void> {
  const spinner = ora('Setting up your project...').start();
  
  try {
    // 1. Clone template
    await cloneTemplate(config, spinner);
    
    // 2. Generate environment configuration
    await generateEnvFile(config, spinner);
    
    // 3. Configure package.json
    await configurePackageJson(config, spinner);
    
    // 4. Remove unused functions
    await removeUnusedFunctions(config, spinner);
    
    // 5. Remove mobile package if not needed
    await removeMobilePackage(config, spinner);
    
    // 6. Install dependencies
    await installDependencies(config, spinner);
    
    // 7. Setup database
    await setupDatabase(config, spinner);
    
    spinner.succeed('Project setup complete!');
    
    // Show next steps
    showNextSteps(config);
    
  } catch (error: any) {
    spinner.fail('Project generation failed');
    console.error(chalk.red(`\nError: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * CLI Program Definition
 */
program
  .name('create-sge-app')
  .description('Create a new SGE application')
  .version('1.0.0')
  .argument('[project-name]', 'Name of the project')
  .option('--skip-install', 'Skip dependency installation')
  .option('--no-mobile', 'Exclude mobile app support')
  .option('--no-subscriptions', 'Exclude Stripe subscriptions')
  .option('--no-notifications', 'Exclude notification system')
  .option('--no-auth', 'Exclude authentication')
  .option('--email <provider>', 'Email provider (resend|sendgrid|none)')
  .option('--pm <manager>', 'Package manager (npm|yarn|pnpm)')
  .action(async (projectName?: string, options?: any) => {
    try {
      let config: ProjectConfig;
      
      // If project name provided with options, use non-interactive mode
      if (projectName && options) {
        config = {
          projectName,
          projectPath: path.resolve(process.cwd(), projectName),
          packageManager: options.pm || detectPackageManager(),
          includeMobile: options.mobile !== false,
          includeSubscriptions: options.subscriptions !== false,
          includeNotifications: options.notifications !== false,
          includeAuth: options.auth !== false,
          emailProvider: options.email || 'resend',
          skipInstall: options.skipInstall || false
        };
      } else {
        // Interactive mode
        config = await runInteractivePrompts();
        
        // Collect API keys if provided
        config = await collectConfiguration(config);
      }
      
      // Check if directory already exists
      if (await fs.pathExists(config.projectPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Directory ${config.projectName} already exists. Overwrite?`,
            default: false
          }
        ]);
        
        if (!overwrite) {
          console.log(chalk.yellow('\nProject creation cancelled.'));
          process.exit(0);
        }
        
        await fs.remove(config.projectPath);
      }
      
      // Generate project
      await generateProject(config);
      
    } catch (error: any) {
      if (error.isTtyError) {
        console.error(chalk.red('Prompt couldn\'t be rendered in the current environment'));
      } else {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
