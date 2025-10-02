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
 * Copy GitHub Copilot instructions for AI-assisted development
 */
async function setupCopilotInstructions(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Setting up AI assistant configuration...';
  
  try {
    const templateDir = path.resolve(__dirname, '../..');
    const sourceFile = path.join(templateDir, '.github/instructions/copilot-instructions.md');
    const targetDir = path.join(config.projectPath, '.github/instructions');
    const targetFile = path.join(targetDir, 'copilot-instructions.md');
    
    // Create .github/instructions directory
    await fs.ensureDir(targetDir);
    
    // Copy the copilot instructions file
    await fs.copy(sourceFile, targetFile);
    
    spinner.succeed('AI assistant configuration ready');
  } catch (error: any) {
    spinner.warn(`Could not copy AI instructions: ${error.message}`);
  }
}

/**
 * Create docs folder with placeholder files for AI-assisted planning
 */
async function createDocsFolder(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Creating documentation structure...';
  
  try {
    const docsDir = path.join(config.projectPath, 'docs/planning');
    await fs.ensureDir(docsDir);
    
    // Market Research placeholder
    const marketResearchContent = `# Market Research

## Target Market Analysis

### Market Size & Opportunity
- [ ] Total Addressable Market (TAM)
- [ ] Serviceable Addressable Market (SAM)
- [ ] Serviceable Obtainable Market (SOM)

### Target Audience
- [ ] Primary user personas
- [ ] User demographics
- [ ] User pain points
- [ ] Current solutions they use

### Competitive Analysis
- [ ] Direct competitors
- [ ] Indirect competitors
- [ ] Competitive advantages
- [ ] Market gaps

### Market Trends
- [ ] Industry trends
- [ ] Technology trends
- [ ] Regulatory considerations

## Research Notes

*Use this section to gather insights from your AI-assisted research sessions.*

---
**Status:** 🔨 In Progress  
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // Product Specification placeholder
    const productSpecContent = `# Product Specification

## Product Overview

### Vision Statement
*What is the core vision for this product?*

### Problem Statement
*What problem are we solving? For whom?*

### Solution Overview
*How does our product solve this problem?*

## Features & Requirements

### Core Features (MVP)
- [ ] Feature 1: [Description]
- [ ] Feature 2: [Description]
- [ ] Feature 3: [Description]

### User Stories
1. **As a [user type]**, I want to [action] so that [benefit]
2. **As a [user type]**, I want to [action] so that [benefit]
3. **As a [user type]**, I want to [action] so that [benefit]

### Feature Details
*Expand on each feature with detailed specifications*

#### Feature 1: [Name]
- **Description:**
- **User Flow:**
- **Technical Requirements:**
- **Success Metrics:**

## Technical Architecture

### Tech Stack (Inherited from SGE Template)
- ✅ Frontend: React 18 + TypeScript + Vite
- ✅ Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- ✅ Mobile: Capacitor 7 (iOS/Android)
- ✅ Payments: Stripe (if enabled)
- ✅ Email: Resend (if enabled)

### Custom Components Needed
- [ ] Custom component 1
- [ ] Custom component 2
- [ ] Custom component 3

### Data Models
*Define your domain-specific data models here*

### Integration Requirements
- [ ] Integration 1
- [ ] Integration 2

## Design Requirements

### UI/UX Considerations
- [ ] Mobile-first design
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Responsive breakpoints
- [ ] Brand guidelines

### Key Screens
1. Screen 1: [Purpose]
2. Screen 2: [Purpose]
3. Screen 3: [Purpose]

## Success Metrics

### Key Performance Indicators (KPIs)
- [ ] User acquisition
- [ ] User retention
- [ ] Engagement metrics
- [ ] Revenue metrics (if applicable)

---
**Status:** 🔨 In Progress  
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // Critical Requirements placeholder
    const criticalRequirementsContent = `# Critical Requirements

## Must-Have Requirements (MVP)

### Functional Requirements
1. **[Requirement 1]**
   - Description:
   - Priority: 🔴 Critical
   - Impact: High

2. **[Requirement 2]**
   - Description:
   - Priority: 🔴 Critical
   - Impact: High

### Non-Functional Requirements

#### Performance
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Support 1000+ concurrent users

#### Security
- [ ] Authentication required for sensitive operations
- [ ] Data encryption at rest and in transit
- [ ] GDPR compliance (if applicable)
- [ ] Regular security audits

#### Scalability
- [ ] Horizontal scaling capability
- [ ] Database optimization
- [ ] CDN for static assets

#### Reliability
- [ ] 99.9% uptime SLA
- [ ] Automated backups
- [ ] Error monitoring and alerting

## Compliance & Legal

### Data Privacy
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Cookie consent
- [ ] Data retention policies

### Industry-Specific Requirements
*List any industry-specific compliance requirements*

## Constraints & Limitations

### Technical Constraints
- [ ] Browser compatibility requirements
- [ ] Mobile OS version support
- [ ] Third-party API limitations

### Business Constraints
- [ ] Budget limitations
- [ ] Timeline constraints
- [ ] Resource availability

## Risk Assessment

### High Priority Risks
1. **Risk 1:** [Description]
   - Mitigation:
   
2. **Risk 2:** [Description]
   - Mitigation:

---
**Status:** 🔨 In Progress  
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // Technical Decisions placeholder
    const technicalDecisionsContent = `# Technical Decisions & Architecture

## Architecture Decisions

### Decision 1: [Title]
- **Status:** Proposed | Accepted | Rejected
- **Context:** What is the issue we're addressing?
- **Decision:** What is the change we're proposing?
- **Consequences:** What becomes easier/harder after this change?

### Decision 2: [Title]
- **Status:** Proposed | Accepted | Rejected
- **Context:**
- **Decision:**
- **Consequences:**

## Database Schema Customization

### Custom Tables
*Document any custom tables beyond the SGE template*

\`\`\`sql
-- Add your custom table definitions here
CREATE TABLE custom_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- your columns
);
\`\`\`

### Schema Modifications
*Document changes to template tables*

## API Design

### Custom Endpoints
1. \`POST /api/endpoint1\` - Description
2. \`GET /api/endpoint2\` - Description

### Edge Functions
*List custom Edge Functions beyond template*
- \`custom-function-1\` - Purpose
- \`custom-function-2\` - Purpose

## Third-Party Integrations

### Required Integrations
- [ ] Integration 1: [Purpose, API docs link]
- [ ] Integration 2: [Purpose, API docs link]

## Performance Optimizations

### Planned Optimizations
- [ ] Caching strategy
- [ ] Image optimization
- [ ] Code splitting
- [ ] Database indexing

---
**Status:** 🔨 In Progress  
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // Development Roadmap placeholder
    const roadmapContent = `# Development Roadmap

## Phase 1: Planning & Design (Week 1-2)
- [x] Market research (see market-research.md)
- [x] Product specification (see product-spec.md)
- [x] Critical requirements (see critical-requirements.md)
- [ ] UI/UX design mockups
- [ ] Technical architecture finalization

## Phase 2: MVP Development (Week 3-6)
- [ ] Database schema customization
- [ ] Core feature 1 development
- [ ] Core feature 2 development
- [ ] Core feature 3 development
- [ ] Basic UI implementation

## Phase 3: Integration & Testing (Week 7-8)
- [ ] Third-party integrations
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Bug fixes

## Phase 4: Deployment & Launch (Week 9-10)
- [ ] Production environment setup
- [ ] Deployment automation
- [ ] Monitoring and logging
- [ ] Beta testing
- [ ] Official launch

## Phase 5: Post-Launch (Ongoing)
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Feature iterations
- [ ] Bug fixes and improvements

## Milestone Tracker

### Completed ✅
- Project scaffolded with SGE template
- AI assistant configured
- Planning documents created

### In Progress 🔨
- Market research
- Product specification
- Requirements gathering

### Upcoming 📋
- Design phase
- Development phase

---
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // AI Chat Log placeholder
    const aiChatLogContent = `# AI-Assisted Development Log

## Purpose
This document tracks key insights, decisions, and guidance from AI-assisted development sessions.

## Chat Sessions

### Session 1: Initial Planning (${new Date().toISOString().split('T')[0]})
**Topics Covered:**
- Project overview and goals
- Market research approach
- Initial feature ideation

**Key Insights:**
- *Record important insights from your AI chat sessions here*

**Action Items:**
- [ ] Complete market research
- [ ] Define MVP features
- [ ] Create user personas

**Decisions Made:**
- *Document any decisions made during the chat*

---

### Session 2: [Topic] (Date)
**Topics Covered:**
- 

**Key Insights:**
- 

**Action Items:**
- [ ] 

**Decisions Made:**
- 

---

## Best Practices

### Working with AI Assistants
1. **Be specific** - Provide clear context and requirements
2. **Iterate** - Refine specifications through conversation
3. **Document** - Keep track of important decisions
4. **Validate** - Verify AI suggestions against best practices
5. **Customize** - Adapt template code for your specific needs

### Prompt Templates

#### For Market Research
\`\`\`
I'm building [product description]. Help me research:
1. Market size and opportunity
2. Target audience and personas
3. Competitive landscape
4. Market trends and gaps
\`\`\`

#### For Feature Planning
\`\`\`
For my [product type], I need to plan features for [user type].
Current pain points: [list]
Desired outcomes: [list]
Help me prioritize and spec out MVP features.
\`\`\`

#### For Technical Architecture
\`\`\`
I'm using the SGE template (React + Supabase + Capacitor).
I need to implement [feature].
Help me design the:
1. Data models
2. API endpoints
3. Component structure
4. State management approach
\`\`\`

---
**Last Updated:** ${new Date().toISOString().split('T')[0]}
`;

    // README for docs folder
    const docsReadmeContent = `# Project Planning Documentation

## 🎯 Getting Started with AI-Assisted Development

This project uses the SGE Starter Template and is designed for **AI-assisted development**. Your first step should be working with an AI assistant (like GitHub Copilot Chat, ChatGPT, or Claude) to:

1. **Research your market** → Edit \`market-research.md\`
2. **Define your product** → Edit \`product-spec.md\`
3. **Identify requirements** → Edit \`critical-requirements.md\`
4. **Make technical decisions** → Edit \`technical-decisions.md\`
5. **Plan your roadmap** → Edit \`development-roadmap.md\`
6. **Document AI sessions** → Update \`ai-chat-log.md\`

## 📁 Documentation Structure

### Planning Documents
- **\`market-research.md\`** - Market analysis, competitors, opportunities
- **\`product-spec.md\`** - Product vision, features, user stories
- **\`critical-requirements.md\`** - Must-have requirements, compliance, risks
- **\`technical-decisions.md\`** - Architecture decisions, API design, integrations
- **\`development-roadmap.md\`** - Phase-by-phase development plan
- **\`ai-chat-log.md\`** - Track insights from AI-assisted sessions

### AI Assistant Configuration
- **\`.github/instructions/copilot-instructions.md\`** - Context for AI assistants

## 🤖 Working with AI Assistants

### Best Practices
1. **Start with research** - Use AI to understand your market and users
2. **Iterate on specs** - Refine your product specification through conversation
3. **Validate decisions** - Ask AI to review your technical choices
4. **Generate code** - Use AI to scaffold components and features
5. **Document everything** - Keep \`ai-chat-log.md\` updated with key insights

### Example AI Prompts

**For Market Research:**
\`\`\`
I'm building a [type] application for [audience]. 
Help me understand the market opportunity, competition, and user needs.
See docs/planning/market-research.md for structure.
\`\`\`

**For Feature Planning:**
\`\`\`
Review my product spec at docs/planning/product-spec.md.
Help me prioritize features for MVP and create detailed user stories.
\`\`\`

**For Implementation:**
\`\`\`
I need to implement [feature] using the SGE template (React + Supabase).
The template includes: [list relevant template features].
Help me design the component structure and data flow.
\`\`\`

## 🚀 Development Workflow

### Phase 1: Planning (Week 1-2)
1. Work with AI to complete all planning documents
2. Review and validate specifications
3. Get feedback from stakeholders
4. Finalize MVP scope

### Phase 2: Development (Week 3+)
1. Use AI to generate component scaffolding
2. Customize template features for your needs
3. Implement custom business logic
4. Test and iterate

### Phase 3: Deployment
1. Follow SGE template deployment guides
2. Configure production environment
3. Deploy and monitor

## 📚 Related Documentation

### Template Documentation
- **Main README** - \`../README.md\`
- **Quick Start** - \`../docs/QUICKSTART.md\`
- **Auth System** - \`../packages/functions/auth/README.md\`
- **Notifications** - \`../packages/functions/notifications/README.md\`
- **Subscriptions** - \`../packages/functions/subscriptions/README.md\`

### Development Guides
- **Database Schema** - \`../infra/schema/README.md\`
- **CLI Generator** - \`../generator/README.md\`
- **Build Scripts** - \`../scripts/README.md\`

---

**Remember:** The SGE template provides the infrastructure. Your AI-assisted planning defines the unique value proposition. Start with thorough planning before diving into code!

**Created:** ${new Date().toISOString().split('T')[0]}
`;

    // Write all files
    await fs.writeFile(path.join(docsDir, 'market-research.md'), marketResearchContent);
    await fs.writeFile(path.join(docsDir, 'product-spec.md'), productSpecContent);
    await fs.writeFile(path.join(docsDir, 'critical-requirements.md'), criticalRequirementsContent);
    await fs.writeFile(path.join(docsDir, 'technical-decisions.md'), technicalDecisionsContent);
    await fs.writeFile(path.join(docsDir, 'development-roadmap.md'), roadmapContent);
    await fs.writeFile(path.join(docsDir, 'ai-chat-log.md'), aiChatLogContent);
    await fs.writeFile(path.join(docsDir, 'README.md'), docsReadmeContent);
    
    spinner.succeed('Documentation structure created with planning templates');
  } catch (error: any) {
    spinner.warn(`Could not create docs folder: ${error.message}`);
  }
}

/**
 * Create the project README with AI-assisted workflow guide
 */
async function createProjectReadme(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Creating project README...';
  
  try {
    const readmeContent = `# ${config.projectName}

> An SGE-powered application built with AI-assisted development

## 🚀 AI-First Development Workflow

This project is designed for **AI-assisted development**. Follow this workflow to build your application efficiently:

### Phase 1: Research & Discovery (Week 1) 🔍

**Goal:** Understand your market, users, and opportunities

1. **Start an AI chat session** (GitHub Copilot Chat, ChatGPT, Claude, etc.)
2. **Complete market research** → Edit \`docs/planning/market-research.md\`
   - Market size and opportunity
   - Target audience and personas
   - Competitive analysis
   - Market trends and gaps
3. **Document your session** → Update \`docs/planning/ai-chat-log.md\`

**Example AI Prompt:**
\`\`\`
I'm building a [type of application] for [target audience]. 
Help me research the market opportunity, key competitors, and user needs.
See docs/planning/market-research.md for the structure I need to fill out.
\`\`\`

### Phase 2: Product Strategy (Week 1-2) 📋

**Goal:** Define what you're building and why

1. **Define your product vision** → Edit \`docs/planning/product-spec.md\`
   - Problem statement and solution
   - Core features (MVP scope)
   - User stories and workflows
   - Success metrics
2. **Identify critical requirements** → Edit \`docs/planning/critical-requirements.md\`
   - Must-have features
   - Non-functional requirements (performance, security, scalability)
   - Compliance and legal considerations
   - Risk assessment

**Example AI Prompt:**
\`\`\`
Based on my market research, help me define MVP features for my [product type].
Target users: [describe users]
Key pain points: [list pain points]
Help me prioritize features and create detailed user stories.
\`\`\`

### Phase 3: Technical Planning (Week 2) 🏗️

**Goal:** Plan your technical implementation

1. **Make architecture decisions** → Edit \`docs/planning/technical-decisions.md\`
   - Custom data models (beyond SGE template)
   - API design and endpoints
   - Third-party integrations
   - Performance optimizations
2. **Create development roadmap** → Edit \`docs/planning/development-roadmap.md\`
   - Break down into phases and milestones
   - Estimate timelines
   - Identify dependencies

**Example AI Prompt:**
\`\`\`
I'm using the SGE template (React + TypeScript + Supabase + Capacitor).
I need to implement [feature]. Help me design:
1. Database schema (custom tables and relationships)
2. API endpoints (Edge Functions)
3. Component structure
4. State management approach
\`\`\`

### Phase 4: Update AI Instructions (Week 2) 🤖

**Goal:** Configure AI assistant with your project-specific context

1. **Review base instructions** → \`.github/instructions/copilot-instructions.md\`
2. **Add your project context:**
   - Your product vision and goals
   - Custom business logic and rules
   - Specific terminology and naming conventions
   - Integration requirements
3. **Add custom code examples** if you have specific patterns you want to follow

**Why this matters:** AI assistants perform better when they understand your specific project goals and architecture.

### Phase 5: Build & Iterate (Week 3+) 💻

**Goal:** Implement your application with AI assistance

1. **Use AI to scaffold components:**
   \`\`\`
   Create a [ComponentName] component that [does X].
   It should use the SGE template's [shared hook/utility].
   Follow the mobile-first responsive patterns from the template.
   \`\`\`

2. **Implement features incrementally:**
   - Start with core user flows
   - Build UI components
   - Add business logic
   - Integrate with backend (Supabase)
   - Test on web and mobile

3. **Leverage the SGE template features:**
   - ✅ Authentication & user management
   - ✅ Multi-tenant database with RLS
   - ✅ Edge Functions (serverless backend)
   - ✅ Notification system${config.includeNotifications ? ' (included)' : ' (not included)'}
   - ✅ Stripe subscriptions${config.includeSubscriptions ? ' (included)' : ' (not included)'}
   - ✅ Mobile app support${config.includeMobile ? ' (included)' : ' (not included)'}

4. **Document as you go:**
   - Update \`docs/planning/ai-chat-log.md\` with key decisions
   - Keep technical-decisions.md current
   - Track progress in development-roadmap.md

## 📁 Project Structure

\`\`\`
${config.projectName}/
├── .github/
│   └── instructions/
│       └── copilot-instructions.md    # AI assistant configuration
├── docs/
│   └── planning/                      # AI-assisted planning docs
│       ├── market-research.md
│       ├── product-spec.md
│       ├── critical-requirements.md
│       ├── technical-decisions.md
│       ├── development-roadmap.md
│       ├── ai-chat-log.md
│       └── README.md
├── infra/
│   └── schema/                        # Database schema
│       ├── core.sql                   # Core tables
│       └── rls-policies.sql           # Row Level Security
├── packages/
│   ├── functions/                     # Supabase Edge Functions${config.includeAuth ? '\n│   │   ├── auth/                      # Authentication functions' : ''}${config.includeNotifications ? '\n│   │   ├── notifications/             # Notification system' : ''}${config.includeSubscriptions ? '\n│   │   └── subscriptions/             # Stripe subscriptions' : ''}
│   ├── shared/                        # Shared utilities & hooks
│   ├── ui/                            # Reusable UI components${config.includeMobile ? '\n│   ├── mobile/                        # Mobile-specific code' : ''}
│   └── web/                           # Web application
└── scripts/                           # Build and utility scripts
\`\`\`

## 🛠️ Quick Start

### 1. Install Dependencies

\`\`\`bash
${config.packageManager} install
\`\`\`

### 2. Configure Environment

Edit \`.env\` with your API keys:

\`\`\`bash
# Required: Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
${config.includeSubscriptions ? '\n# Stripe (if using subscriptions)\nVITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key\nSTRIPE_SECRET_KEY=your_stripe_secret' : ''}${config.includeNotifications && config.emailProvider === 'resend' ? '\n# Resend (if using email)\nRESEND_API_KEY=your_resend_key' : ''}
\`\`\`

### 3. Set Up Database

1. Go to your [Supabase project dashboard](https://app.supabase.com)
2. Run SQL from \`infra/schema/core.sql\`
3. Run SQL from \`infra/schema/rls-policies.sql\`

### 4. Deploy Edge Functions

\`\`\`bash
supabase functions deploy
\`\`\`
${config.includeSubscriptions ? '\n### 5. Configure Stripe Webhooks\n\n**Endpoint:** `https://your-project.supabase.co/functions/v1/stripe-webhooks`\n\n**Events:**\n- `customer.subscription.created`\n- `customer.subscription.updated`\n- `customer.subscription.deleted`\n- `payment_intent.succeeded`\n- `payment_intent.payment_failed`' : ''}

### ${config.includeSubscriptions ? '6' : '5'}. Start Development Server

\`\`\`bash
${config.packageManager} run dev
\`\`\`

Visit [http://localhost:5173](http://localhost:5173)

## 📚 Documentation

### SGE Template Docs
- [Quick Start Guide](docs/QUICKSTART.md)
- [Database Schema](infra/schema/README.md)${config.includeAuth ? '\n- [Authentication System](packages/functions/auth/README.md)' : ''}${config.includeNotifications ? '\n- [Notification System](packages/functions/notifications/README.md)' : ''}${config.includeSubscriptions ? '\n- [Subscription Management](packages/functions/subscriptions/README.md)' : ''}
- [Build Scripts](scripts/README.md)

### Your Project Planning
- [AI-Assisted Workflow](docs/planning/README.md)
- [Market Research](docs/planning/market-research.md)
- [Product Specification](docs/planning/product-spec.md)
- [Technical Decisions](docs/planning/technical-decisions.md)
- [Development Roadmap](docs/planning/development-roadmap.md)

## 🎯 Key AI Development Tips

1. **Always provide context** - Reference your planning docs when asking for help
2. **Work incrementally** - Build and test small pieces at a time
3. **Use the template** - Leverage existing SGE components and patterns
4. **Document decisions** - Keep ai-chat-log.md updated with key insights
5. **Test across platforms** - Verify mobile (iOS/Android) and web regularly

## 🚢 Deployment

The SGE template is optimized for deployment to:

- **Vercel** (recommended for web)
- **iOS App Store** (via Capacitor)
- **Google Play Store** (via Capacitor)

See [deployment docs](docs/QUICKSTART.md#deployment) for detailed instructions.

## 📝 License

[Your License Here]

---

**Built with [SGE Starter Template](https://github.com/gamalamadingdong/scheduleboardv2)**  
**Generated:** ${new Date().toISOString().split('T')[0]}
`;

    await fs.writeFile(path.join(config.projectPath, 'README.md'), readmeContent);
    spinner.succeed('Project README created with AI workflow guide');
  } catch (error: any) {
    spinner.warn(`Could not create README: ${error.message}`);
  }
}

/**
 * Display next steps to the user
 */
function showNextSteps(config: ProjectConfig): void {
  console.log(chalk.green.bold('\n✅ Project created successfully!\n'));
  
  console.log(chalk.cyan.bold('🤖 AI-Assisted Development:\n'));
  console.log(chalk.yellow(`  This project includes AI planning templates and Copilot configuration.`));
  console.log(chalk.yellow(`  Start by working with an AI assistant to complete your planning docs!\n`));
  
  console.log(chalk.cyan.bold('📂 Next steps:\n'));
  
  // Navigate to project
  console.log(chalk.white(`  1. Navigate to your project:`));
  console.log(chalk.gray(`     cd ${config.projectName}\n`));
  
  // AI-assisted planning
  console.log(chalk.white(`  2. 🎯 Complete AI-assisted planning (RECOMMENDED FIRST):`));
  console.log(chalk.gray(`     • Review .github/instructions/copilot-instructions.md`));
  console.log(chalk.gray(`     • Work through docs/planning/ with your AI assistant:`));
  console.log(chalk.gray(`       - market-research.md`));
  console.log(chalk.gray(`       - product-spec.md`));
  console.log(chalk.gray(`       - critical-requirements.md`));
  console.log(chalk.gray(`       - technical-decisions.md`));
  console.log(chalk.gray(`       - development-roadmap.md`));
  console.log(chalk.gray(`     • Document sessions in ai-chat-log.md\n`));
  
  // Install dependencies if skipped
  if (config.skipInstall) {
    console.log(chalk.white(`  3. Install dependencies:`));
    console.log(chalk.gray(`     ${config.packageManager} install\n`));
  }
  
  // Configure environment
  if (!config.supabaseUrl || !config.stripeSecretKey) {
    console.log(chalk.white(`  ${config.skipInstall ? '4' : '3'}. Configure your environment:`));
    console.log(chalk.gray(`     Edit .env with your API keys\n`));
  }
  
  // Setup Supabase
  if (config.includeAuth) {
    const step = config.skipInstall ? (config.supabaseUrl ? '4' : '5') : (config.supabaseUrl ? '3' : '4');
    console.log(chalk.white(`  ${step}. Set up your Supabase database:`));
    console.log(chalk.gray(`     a. Go to your Supabase project dashboard`));
    console.log(chalk.gray(`     b. Run SQL from infra/schema/core.sql`));
    console.log(chalk.gray(`     c. Run SQL from infra/schema/rls-policies.sql\n`));
  }
  
  // Deploy Edge Functions
  if (config.includeAuth || config.includeNotifications || config.includeSubscriptions) {
    const step = config.skipInstall ? '6' : '5';
    console.log(chalk.white(`  ${step}. Deploy Edge Functions:`));
    console.log(chalk.gray(`     supabase functions deploy\n`));
  }
  
  // Setup Stripe webhooks
  if (config.includeSubscriptions) {
    const step = config.skipInstall ? '7' : '6';
    console.log(chalk.white(`  ${step}. Configure Stripe webhooks:`));
    console.log(chalk.gray(`     Endpoint: https://your-project.supabase.co/functions/v1/stripe-webhooks`));
    console.log(chalk.gray(`     Events: customer.subscription.*, payment_intent.*\n`));
  }
  
  // Start development server
  const finalStep = config.skipInstall ? '8' : '7';
  console.log(chalk.white(`  ${finalStep}. Start development server:`));
  console.log(chalk.gray(`     ${config.packageManager} run dev\n`));
  
  // Documentation links
  console.log(chalk.cyan.bold('📚 Documentation:\n'));
  console.log(chalk.gray(`  • README.md - Project overview`));
  console.log(chalk.gray(`  • docs/planning/ - AI-assisted planning templates`));
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
    
    // 2. Setup AI-assisted development files
    await setupCopilotInstructions(config, spinner);
    await createDocsFolder(config, spinner);
    await createProjectReadme(config, spinner);
    
    // 3. Generate environment configuration
    await generateEnvFile(config, spinner);
    
    // 4. Configure package.json
    await configurePackageJson(config, spinner);
    
    // 5. Remove unused functions
    await removeUnusedFunctions(config, spinner);
    
    // 6. Remove mobile package if not needed
    await removeMobilePackage(config, spinner);
    
    // 7. Install dependencies
    await installDependencies(config, spinner);
    
    // 8. Setup database
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
