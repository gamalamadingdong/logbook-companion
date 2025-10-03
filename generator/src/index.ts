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
  projectType: 'new' | 'migration';
  includeMobile: boolean;
  includeSubscriptions: boolean;
  includeNotifications: boolean;
  emailProvider: 'resend' | 'sendgrid' | 'none';
  includeAuth: boolean;
  skipInstall: boolean;
  
  // Migration-specific options
  migrationSource?: string;
  migrationTarget?: string;
  
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
      type: 'list',
      name: 'projectType',
      message: 'What type of project are you creating?',
      choices: [
        { 
          name: '🚀 New SGE Application - Start a fresh project with the full SGE template',
          value: 'new' 
        },
        { 
          name: '🔄 Legacy System Migration - Modernize existing codebase with AI assistance',
          value: 'migration' 
        }
      ],
      default: 'new'
    },
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: (answers: any) => answers.projectType === 'migration' ? 'my-legacy-migration' : 'my-sge-app',
      validate: (input: string) => {
        if (!input) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Project name must be lowercase with hyphens only';
        return true;
      }
    },
    {
      type: 'input',
      name: 'migrationSource',
      message: 'Path to existing codebase (directory or Git repository):',
      when: (answers: any) => answers.projectType === 'migration',
      validate: (input: string) => {
        if (!input) return 'Source path is required for migration projects';
        return true;
      }
    },
    {
      type: 'list',
      name: 'migrationTarget',
      message: 'Migration target platform:',
      choices: [
        { name: 'Web Application (React + TypeScript)', value: 'web' },
        { name: 'Mobile App (React Native + Capacitor)', value: 'mobile' },
        { name: 'Full Stack (Web + Mobile)', value: 'fullstack' },
        { name: 'Microservices Architecture', value: 'microservices' }
      ],
      when: (answers: any) => answers.projectType === 'migration',
      default: 'fullstack'
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
      default: true,
      when: (answers: any) => answers.projectType === 'new'
    },
    {
      type: 'confirm',
      name: 'includeMobile',
      message: 'Include mobile app support (iOS/Android)?',
      default: (answers: any) => answers.migrationTarget === 'mobile' || answers.migrationTarget === 'fullstack',
      when: (answers: any) => answers.projectType === 'new' || (answers.projectType === 'migration' && (answers.migrationTarget === 'mobile' || answers.migrationTarget === 'fullstack'))
    },
    {
      type: 'confirm',
      name: 'includeSubscriptions',
      message: 'Include Stripe subscription management?',
      default: true,
      when: (answers: any) => answers.projectType === 'new'
    },
    {
      type: 'confirm',
      name: 'includeNotifications',
      message: 'Include multi-channel notifications?',
      default: true,
      when: (answers: any) => answers.projectType === 'new'
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

  // Set defaults for migration projects
  if (answers.projectType === 'migration') {
    answers.includeAuth = false;
    answers.includeSubscriptions = false;  
    answers.includeNotifications = false;
    answers.emailProvider = 'none';
  }

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
 * Create migration project structure with AI-assisted workflow
 */
async function createMigrationProject(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Setting up migration project structure...';
  
  try {
    // Create project directory
    await fs.ensureDir(config.projectPath);
    
    // Create basic structure for migration project
    const migrationDirs = [
      'docs/analysis',
      'docs/planning',
      'docs/migration',
      'tools/scripts',
      'analysis/generated',
      'planning/phases',
      'target-architecture'
    ];
    
    for (const dir of migrationDirs) {
      await fs.ensureDir(path.join(config.projectPath, dir));
    }
    
    // Copy migration templates
    const templateDir = path.resolve(__dirname, '../..');
    const migrationTemplatesDir = path.join(templateDir, 'generator/templates/migration');
    const targetMigrationDir = path.join(config.projectPath, 'docs/migration');
    
    if (await fs.pathExists(migrationTemplatesDir)) {
      await fs.copy(migrationTemplatesDir, targetMigrationDir);
    }
    
    // Create package.json for migration project
    const migrationPackageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Legacy system migration project with AI assistance',
      type: 'module',
      scripts: {
        'analyze': 'node tools/scripts/analyze-codebase.js',
        'plan': 'node tools/scripts/create-migration-plan.js',
        'validate': 'node tools/scripts/validate-migration.js'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.9.0'
      }
    };
    
    await fs.writeJson(path.join(config.projectPath, 'package.json'), migrationPackageJson, { spaces: 2 });
    
    // Create basic migration utility scripts
    const analyzeScript = `#!/usr/bin/env node

/**
 * Codebase Analysis Utility
 * 
 * This script helps analyze legacy codebases to prepare for migration.
 * Work with your AI assistant to customize this analysis for your specific needs.
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 AI-Assisted Codebase Analysis');
console.log('==================================');

// Configuration - modify these paths for your project
const SOURCE_PATH = process.argv[2] || '${config.migrationSource || './legacy-source'}';
const OUTPUT_DIR = './analysis/generated';

console.log(\`Analyzing codebase at: \${SOURCE_PATH}\`);
console.log(\`Output directory: \${OUTPUT_DIR}\`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Basic file analysis
function analyzeDirectory(dirPath, depth = 0) {
  const maxDepth = 5; // Prevent infinite recursion
  if (depth > maxDepth) return [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let analysis = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        analysis = analysis.concat(analyzeDirectory(fullPath, depth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const size = fs.statSync(fullPath).size;
        
        analysis.push({
          path: fullPath,
          name: entry.name,
          extension: ext,
          size: size,
          type: getFileType(ext)
        });
      }
    }
    
    return analysis;
  } catch (error) {
    console.warn(\`Could not analyze directory: \${dirPath}\`);
    return [];
  }
}

function getFileType(extension) {
  const typeMap = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript', 
    '.jsx': 'React JSX',
    '.tsx': 'React TSX',
    '.py': 'Python',
    '.java': 'Java',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.cpp': 'C++',
    '.c': 'C',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SASS',
    '.sql': 'SQL',
    '.json': 'JSON',
    '.xml': 'XML',
    '.yaml': 'YAML',
    '.yml': 'YAML'
  };
  
  return typeMap[extension.toLowerCase()] || 'Other';
}

// Run analysis
if (fs.existsSync(SOURCE_PATH)) {
  const analysis = analyzeDirectory(SOURCE_PATH);
  
  // Generate summary
  const summary = {
    totalFiles: analysis.length,
    fileTypes: {},
    largestFiles: analysis.sort((a, b) => b.size - a.size).slice(0, 10),
    directories: [...new Set(analysis.map(f => path.dirname(f.path)))],
    generatedAt: new Date().toISOString()
  };
  
  // Count file types
  analysis.forEach(file => {
    summary.fileTypes[file.type] = (summary.fileTypes[file.type] || 0) + 1;
  });
  
  // Save results
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'codebase-analysis.json'),
    JSON.stringify({ analysis, summary }, null, 2)
  );
  
  // Generate readable report
  let report = \`# Codebase Analysis Report

Generated: \${new Date().toLocaleString()}
Source: \${SOURCE_PATH}

## Summary

- **Total Files:** \${summary.totalFiles}
- **Directories:** \${summary.directories.length}

## File Types

\`;
  
  Object.entries(summary.fileTypes).forEach(([type, count]) => {
    report += \`- **\${type}:** \${count} files\\n\`;
  });
  
  report += \`\\n## Largest Files

\`;
  
  summary.largestFiles.forEach((file, i) => {
    const sizeKB = Math.round(file.size / 1024);
    report += \`\${i + 1}. \${file.name} (\${sizeKB} KB) - \${file.type}\\n\`;
  });
  
  report += \`\\n## Next Steps

1. **Review the analysis results** in \\\`analysis/generated/codebase-analysis.json\\\`
2. **Work with your AI assistant** to interpret these results
3. **Identify key components** for migration prioritization  
4. **Plan your migration strategy** using the analysis insights

## AI Assistant Prompt

Use this prompt with your AI assistant to get deeper insights:

\\\`\\\`\\\`
I've analyzed my legacy codebase and here are the results:

**File Types:** \${Object.entries(summary.fileTypes).map(([type, count]) => \`\${type}: \${count}\`).join(', ')}

**Largest Files:** \${summary.largestFiles.slice(0, 5).map(f => f.name).join(', ')}

**Total Files:** \${summary.totalFiles}

Based on this analysis, help me:
1. Identify the main technology stack and architecture patterns
2. Prioritize components for migration (start with low-risk, high-value)
3. Suggest a migration strategy (incremental vs big-bang)
4. Identify potential challenges and risks

Use the framework from docs/migration/ai-discovery-guide.md to structure your analysis.
\\\`\\\`\\\`
\`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'analysis-report.md'), report);
  
  console.log('✅ Analysis complete!');
  console.log(\`📊 Results saved to: \${OUTPUT_DIR}/\`);
  console.log('📋 Review analysis-report.md and work with your AI assistant for next steps');
  
} else {
  console.error(\`❌ Source path not found: \${SOURCE_PATH}\`);
  console.log('Usage: npm run analyze [source-path]');
}
`;

    const planScript = `#!/usr/bin/env node

/**
 * Migration Plan Generator
 * 
 * This utility helps create and manage migration plans.
 * Use with your AI assistant for best results.
 */

import fs from 'fs';
import path from 'path';

console.log('📋 AI-Assisted Migration Planning');
console.log('=================================');

const TEMPLATES_DIR = './docs/migration';
const PLANNING_DIR = './planning/phases';

// Ensure planning directory exists
if (!fs.existsSync(PLANNING_DIR)) {
  fs.mkdirSync(PLANNING_DIR, { recursive: true });
}

// Read existing analysis if available
let analysisData = null;
const analysisPath = './analysis/generated/codebase-analysis.json';

if (fs.existsSync(analysisPath)) {
  try {
    analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    console.log('📊 Found existing codebase analysis');
  } catch (error) {
    console.warn('⚠️  Could not read analysis data');
  }
}

// Generate phase templates
const phases = [
  {
    id: 'phase-1',
    name: 'Foundation & Setup',
    description: 'Set up new architecture foundation and development environment'
  },
  {
    id: 'phase-2', 
    name: 'Core Business Logic Migration',
    description: 'Migrate essential business logic and data models'
  },
  {
    id: 'phase-3',
    name: 'Integration & Services',
    description: 'Implement integrations and external service connections'
  },
  {
    id: 'phase-4',
    name: 'UI/UX & Final Migration', 
    description: 'Complete user interface migration and system cutover'
  }
];

phases.forEach(phase => {
  const phaseFile = path.join(PLANNING_DIR, \`\${phase.id}.md\`);
  
  if (!fs.existsSync(phaseFile)) {
    const template = \`# \${phase.name}

## Overview
\${phase.description}

## Objectives
- [ ] Objective 1
- [ ] Objective 2  
- [ ] Objective 3

## Components to Migrate
- Component 1
- Component 2
- Component 3

## Success Criteria
- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

## Risks & Mitigations
| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Risk 1 | High | Low | Mitigation strategy |

## Dependencies
- [ ] Dependency 1
- [ ] Dependency 2

## Timeline Estimate
**Duration:** X weeks  
**Start Date:** TBD  
**End Date:** TBD

## Testing Strategy
- [ ] Unit tests
- [ ] Integration tests
- [ ] User acceptance testing
- [ ] Performance testing

## Rollback Plan
Describe how to rollback this phase if issues occur.

## AI Assistant Notes
*Use this section to document insights from AI-assisted planning sessions*

---
**Status:** Planning  
**Last Updated:** \${new Date().toISOString().split('T')[0]}
\`;

    fs.writeFileSync(phaseFile, template);
    console.log(\`📄 Created \${phase.id}.md\`);
  } else {
    console.log(\`✅ \${phase.id}.md already exists\`);
  }
});

// Generate overall migration plan
const overallPlanFile = path.join(PLANNING_DIR, 'migration-overview.md');

if (!fs.existsSync(overallPlanFile)) {
  const overallTemplate = \`# Migration Overview & Strategy

## Project Context
**Source System:** ${config.migrationSource || 'Legacy codebase'}  
**Target Architecture:** ${config.migrationTarget || 'Modern application'}  
**Migration Approach:** Incremental modernization

\${analysisData ? \`## Codebase Analysis Summary

**Total Files:** \${analysisData.summary.totalFiles}
**Primary File Types:** \${Object.entries(analysisData.summary.fileTypes).map(([type, count]) => \`\${type} (\${count})\`).join(', ')}
**Largest Components:** \${analysisData.summary.largestFiles.slice(0, 3).map(f => f.name).join(', ')}

*Full analysis available in: analysis/generated/codebase-analysis.json*
\` : '## Codebase Analysis\\n\\n*Run \`npm run analyze\` to generate codebase analysis*'}

## Migration Strategy

### Approach: Incremental Migration
We will migrate the system incrementally to minimize risk and maintain system availability.

### Phase Overview
1. **Phase 1: Foundation & Setup** (2-3 weeks)
2. **Phase 2: Core Business Logic** (4-6 weeks) 
3. **Phase 3: Integration & Services** (3-4 weeks)
4. **Phase 4: UI/UX & Final Migration** (3-4 weeks)

**Total Estimated Duration:** 12-17 weeks

## Success Metrics
- [ ] Zero data loss during migration
- [ ] < 4 hours total downtime across all phases
- [ ] Performance improved by 50% or maintained
- [ ] All business functionality preserved
- [ ] Team trained on new architecture

## Risk Management
- Comprehensive testing at each phase
- Rollback plans for each component
- Gradual user migration (feature flags)
- Performance monitoring throughout

## AI Assistant Collaboration

### Planning Prompts
Use these prompts to work with your AI assistant:

**Phase Planning:**
\\\`\\\`\\\`
Help me plan Phase [X] of my migration project.

Context:
- Source: ${config.migrationSource || '[source-system]'}
- Target: ${config.migrationTarget || '[target-architecture]'}
- Components identified: [list key components]

I need help with:
1. Breaking down the phase into specific tasks
2. Identifying dependencies and risks
3. Creating realistic timeline estimates
4. Planning testing approach

Reference: planning/phases/phase-[x].md
\\\`\\\`\\\`

**Risk Assessment:**
\\\`\\\`\\\`
Review my migration plan and help identify potential risks:

[Include relevant context about your specific migration]

Focus on:
1. Technical risks (data loss, performance degradation)
2. Business risks (downtime, user impact)  
3. Team risks (knowledge gaps, resource constraints)
4. Timeline risks (dependencies, complexity underestimation)

Suggest specific mitigation strategies for each risk.
\\\`\\\`\\\`

---
**Created:** \${new Date().toISOString().split('T')[0]}  
**Status:** Planning  
**Next Review:** TBD
\`;

  fs.writeFileSync(overallPlanFile, overallTemplate);
  console.log('📋 Created migration-overview.md');
}

console.log('\\n✅ Migration planning templates created!');
console.log('📂 Review files in: planning/phases/');  
console.log('🤖 Work with your AI assistant to customize the plans');
`;

    const validateScript = `#!/usr/bin/env node

/**
 * Migration Validation Utility
 * 
 * Helps validate migration progress and system integrity.
 */

console.log('✅ Migration Validation');
console.log('======================');

// Check if planning files exist
const planningFiles = [
  'docs/migration/migration-plan.md',
  'docs/migration/analysis-worksheet.md', 
  'planning/phases/migration-overview.md'
];

console.log('📋 Planning Documentation Status:');
planningFiles.forEach(file => {
  const exists = require('fs').existsSync(file);
  console.log(\`  \${exists ? '✅' : '❌'} \${file}\`);
});

console.log('\\n🤖 Next Steps:');
console.log('1. Complete planning documentation');
console.log('2. Work with AI assistant to validate plans');
console.log('3. Begin Phase 1 implementation');
console.log('4. Run validation after each phase');
`;

    // Write utility scripts
    await fs.writeFile(path.join(config.projectPath, 'tools/scripts/analyze-codebase.js'), analyzeScript);
    await fs.writeFile(path.join(config.projectPath, 'tools/scripts/create-migration-plan.js'), planScript);
    await fs.writeFile(path.join(config.projectPath, 'tools/scripts/validate-migration.js'), validateScript);
    
    spinner.succeed('Migration project structure created');
  } catch (error: any) {
    spinner.fail('Failed to create migration project structure');
    throw new Error(`Migration setup error: ${error.message}`);
  }
}

/**
 * Copy GitHub Copilot instructions for AI-assisted development
 */
async function setupCopilotInstructions(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Setting up AI assistant configuration...';
  
  try {
    const targetDir = path.join(config.projectPath, '.github/instructions');
    const targetFile = path.join(targetDir, 'copilot-instructions.md');
    
    // Create .github/instructions directory
    await fs.ensureDir(targetDir);
    
    if (config.projectType === 'migration') {
      // Create migration-specific Copilot instructions
      const migrationInstructions = `# Migration Project - AI Assistant Instructions

## Project Context

**Project Type:** Legacy System Migration  
**Source System:** ${config.migrationSource || 'Legacy codebase'}  
**Target Architecture:** ${config.migrationTarget || 'Modern full-stack application'}  
**Migration Approach:** AI-assisted incremental modernization

## Core Mission

You are assisting with a **legacy system migration project**. Your role is to help analyze existing code, plan modernization strategies, and guide the implementation of modern architecture patterns while preserving business logic and data integrity.

## Primary Responsibilities

### 1. Codebase Analysis
- **System Discovery**: Help analyze legacy code structure, dependencies, and architecture patterns
- **Technical Debt Assessment**: Identify areas requiring modernization and technical debt
- **Business Logic Extraction**: Help separate core business logic from infrastructure concerns
- **Integration Mapping**: Document existing integrations and data flows

### 2. Migration Planning
- **Strategy Development**: Recommend incremental vs big-bang migration approaches
- **Risk Assessment**: Identify migration risks and mitigation strategies  
- **Phase Planning**: Break down migration into manageable phases
- **Testing Strategy**: Design comprehensive testing approaches for each migration phase

### 3. Architecture Modernization
- **Pattern Recommendations**: Suggest modern architecture patterns (microservices, event-driven, etc.)
- **Technology Stack**: Recommend modern technology choices based on requirements
- **Data Migration**: Design data migration strategies and validation approaches
- **Integration Design**: Plan modern integration patterns and APIs

### 4. Implementation Guidance
- **Code Generation**: Help generate modern code following best practices
- **Refactoring Assistance**: Guide incremental refactoring of legacy components
- **Testing Implementation**: Help create comprehensive test suites
- **Documentation**: Generate technical documentation for new architecture

## Migration Workflow Support

### Phase 1: Discovery & Analysis
**Files to Reference:** 
- \`docs/migration/ai-discovery-guide.md\` - Interactive discovery framework
- \`docs/migration/analysis-worksheet.md\` - Systematic analysis checklist

**Key Activities:**
- Analyze codebase structure and dependencies
- Identify business-critical components
- Assess technical debt and modernization opportunities
- Document existing architecture and data flows

### Phase 2: Planning & Strategy
**Files to Reference:**
- \`docs/migration/migration-plan.md\` - 4-phase migration strategy template

**Key Activities:** 
- Develop incremental migration roadmap
- Plan target architecture design
- Identify integration requirements
- Create risk mitigation strategies

### Phase 3: Architecture Design
**Key Activities:**
- Design modern system architecture
- Plan database modernization approach
- Design API and integration layers
- Plan deployment and infrastructure architecture

### Phase 4: Implementation & Validation
**Key Activities:**
- Guide incremental implementation
- Support testing and validation
- Help with deployment automation
- Support monitoring and observability

## Best Practices for Migration Projects

### Code Analysis
- Always analyze existing business logic before suggesting changes
- Preserve critical business rules during modernization
- Identify and document all external dependencies
- Map data flows and transformation requirements

### Migration Strategy
- Prefer incremental migration over big-bang approaches
- Maintain system availability during migration
- Implement comprehensive testing at each phase
- Plan rollback strategies for each migration phase

### Modern Architecture Principles
- Design for scalability and maintainability
- Implement proper error handling and observability
- Use modern security practices and patterns
- Design for cloud-native deployment when applicable

### Risk Management
- Always validate business logic preservation
- Implement comprehensive monitoring during transition
- Plan for data integrity validation
- Document all decisions and architectural changes

## Technology Recommendations

### Target Stack Options (Based on Migration Target)
${config.migrationTarget === 'web' ? `
**Web Application:**
- Frontend: React 18 + TypeScript + Vite
- Backend: Node.js/Express or Supabase Edge Functions
- Database: PostgreSQL with modern ORM (Prisma/Supabase)
- Hosting: Vercel, Netlify, or AWS` : 
config.migrationTarget === 'mobile' ? `
**Mobile Application:**
- Framework: React Native + Expo or Flutter
- Backend: Supabase or Firebase
- State Management: Redux Toolkit or Zustand  
- Navigation: React Navigation or Flutter Navigator` :
config.migrationTarget === 'microservices' ? `
**Microservices Architecture:**
- Services: Node.js, Python FastAPI, or .NET Core
- API Gateway: Kong, AWS API Gateway, or Azure API Management
- Database: PostgreSQL, MongoDB, or service-specific databases
- Messaging: RabbitMQ, Apache Kafka, or cloud-native solutions
- Container Orchestration: Docker + Kubernetes` : `
**Full-Stack Application:**
- Frontend: React 18 + TypeScript + Vite
- Mobile: React Native + Capacitor for native compilation
- Backend: Supabase (PostgreSQL + Edge Functions + Auth)
- Real-time: Supabase Realtime or Socket.io
- Deployment: Vercel (web) + App Store/Play Store (mobile)`}

### Integration Patterns
- REST APIs with OpenAPI documentation
- GraphQL for complex data requirements
- Event-driven architecture for decoupled systems
- Message queues for asynchronous processing

## Communication Guidelines

### When Analyzing Legacy Code
1. **Ask clarifying questions** about business requirements and constraints
2. **Identify critical vs non-critical** components early
3. **Suggest incremental approaches** over complete rewrites
4. **Document assumptions** and validate them with stakeholders

### When Recommending Changes
1. **Explain the benefits** of modern patterns vs legacy approaches
2. **Provide specific examples** of how to implement recommended changes
3. **Consider migration complexity** in all recommendations
4. **Always include testing strategies** for recommended changes

### When Supporting Implementation
1. **Generate production-ready code** following modern best practices
2. **Include comprehensive error handling** and logging
3. **Provide clear documentation** for all new components
4. **Suggest monitoring and observability** approaches

Remember: The goal is successful modernization with minimal business disruption. Always prioritize **business continuity** and **data integrity** while introducing modern development practices and architecture patterns.

---

**Migration Target:** ${config.migrationTarget || 'Modern application'}  
**Created:** ${new Date().toISOString().split('T')[0]}  
**AI-Assisted Migration Ready** 🔄
`;

      await fs.writeFile(targetFile, migrationInstructions);
    } else {
      // Copy standard SGE Copilot instructions for new projects
      const templateDir = path.resolve(__dirname, '../..');
      const sourceFile = path.join(templateDir, '.github/instructions/copilot-instructions.md');
      
      if (await fs.pathExists(sourceFile)) {
        await fs.copy(sourceFile, targetFile);
      }
    }
    
    spinner.succeed('AI assistant configuration ready');
  } catch (error: any) {
    spinner.warn(`Could not setup AI instructions: ${error.message}`);
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
 * Create migration-specific README
 */
async function createMigrationReadme(config: ProjectConfig, spinner: Ora): Promise<void> {
  spinner.text = 'Creating migration project README...';
  
  try {
    const readmeContent = `# ${config.projectName}

> AI-Assisted Legacy System Migration Project

## 🎯 Migration Overview

**Source:** ${config.migrationSource || 'Your existing codebase'}  
**Target:** ${config.migrationTarget || 'Modern web/mobile application'}  
**Approach:** AI-guided analysis and incremental modernization

## 🤖 AI-Assisted Migration Workflow

This project provides a structured approach to modernizing legacy systems with AI assistance. Follow this workflow to systematically analyze, plan, and execute your migration:

### Phase 1: Discovery & Analysis (Week 1-2) 🔍

**Goal:** Understand your existing system and identify migration opportunities

1. **System Analysis** → See \`docs/migration/ai-discovery-guide.md\`
   - Automated codebase analysis
   - Dependency mapping
   - Architecture assessment
   - Technical debt identification

2. **Migration Planning** → Use \`docs/migration/migration-plan.md\`
   - Define migration strategy (big-bang vs incremental)
   - Identify critical components
   - Plan data migration approach
   - Risk assessment and mitigation

3. **Requirements Analysis** → Complete \`docs/migration/analysis-worksheet.md\`
   - Business requirements validation
   - Technical requirements gathering
   - Performance and scalability goals
   - Integration requirements

### Phase 2: Architecture Design (Week 2-3) 🏗️

**Goal:** Design the target architecture using modern patterns

1. **Work with AI to design:**
   - Microservices architecture (if applicable)
   - Database schema modernization
   - API design and integration patterns
   - Security and compliance framework

2. **Create target architecture documentation:**
   - System architecture diagrams
   - Data flow documentation
   - Integration specifications
   - Deployment architecture

### Phase 3: Incremental Migration (Week 4+) 🔄

**Goal:** Execute migration in manageable phases

1. **Start with low-risk components**
2. **Implement new architecture patterns**
3. **Migrate data incrementally**
4. **Maintain system availability**
5. **Validate each phase**

## 📁 Project Structure

\`\`\`
${config.projectName}/
├── docs/
│   ├── analysis/                     # System analysis results
│   ├── planning/                     # Migration planning documents
│   └── migration/                    # Migration templates and guides
│       ├── ai-discovery-guide.md     # AI-assisted system discovery
│       ├── migration-plan.md         # 4-phase migration strategy
│       └── analysis-worksheet.md     # Systematic analysis checklist
├── analysis/
│   └── generated/                    # AI-generated analysis reports
├── planning/
│   └── phases/                       # Phase-specific planning
├── target-architecture/              # Target system design
│   ├── schemas/                      # Database schemas
│   ├── apis/                         # API specifications
│   └── components/                   # Component designs
└── tools/
    └── scripts/                      # Migration utilities
        ├── analyze-codebase.js       # Automated analysis
        ├── create-migration-plan.js  # Planning utilities
        └── validate-migration.js     # Validation tools
\`\`\`

## 🚀 Quick Start

### 1. Set Up Analysis Environment

\`\`\`bash
${config.packageManager} install
\`\`\`

### 2. Begin AI-Assisted Discovery

Start with the AI discovery guide:

\`\`\`bash
# Open the discovery guide
code docs/migration/ai-discovery-guide.md

# Begin interactive analysis session with your AI assistant
\`\`\`

**Example AI Prompt:**
\`\`\`
I'm migrating a legacy ${config.migrationTarget === 'web' ? 'web application' : 
  config.migrationTarget === 'mobile' ? 'mobile app' : 
  config.migrationTarget === 'microservices' ? 'monolith to microservices' : 'system'}.

Source codebase: ${config.migrationSource || '[your-source-path]'}
Target platform: ${config.migrationTarget || 'modern full-stack'}

Help me analyze the codebase structure, identify key components, 
and plan a migration strategy. Use the framework in docs/migration/ai-discovery-guide.md.
\`\`\`

### 3. Complete Analysis Worksheet

Work through the systematic analysis:

\`\`\`bash
code docs/migration/analysis-worksheet.md
\`\`\`

### 4. Create Migration Plan

Develop your phase-by-phase strategy:

\`\`\`bash
code docs/migration/migration-plan.md
\`\`\`

## 🛠️ Migration Tools

### Analysis Scripts

\`\`\`bash
# Analyze codebase structure
npm run analyze

# Generate migration plan
npm run plan

# Validate migration progress
npm run validate
\`\`\`

### AI Assistance Prompts

#### For Codebase Analysis
\`\`\`
Analyze this ${config.migrationTarget === 'web' ? 'web application' : 'codebase'} located at: ${config.migrationSource || '[source-path]'}

Please help me:
1. Map the overall architecture and dependencies
2. Identify core business logic vs infrastructure code
3. Assess the current technology stack and versions
4. Identify potential migration challenges and opportunities
5. Suggest modernization priorities

Use the analysis framework from docs/migration/analysis-worksheet.md
\`\`\`

#### For Migration Planning
\`\`\`
Based on my codebase analysis, help me create a detailed migration plan.

Target architecture: ${config.migrationTarget === 'web' ? 'Modern web application (React + TypeScript + Supabase)' :
  config.migrationTarget === 'mobile' ? 'Mobile application (React Native + Capacitor)' :
  config.migrationTarget === 'fullstack' ? 'Full-stack application (React + TypeScript + Mobile)' :
  config.migrationTarget === 'microservices' ? 'Microservices architecture' : 'Modern application'}

Requirements:
- Minimize downtime during migration
- Maintain data integrity
- Ensure performance improvements
- Enable future scalability

Use the 4-phase migration template from docs/migration/migration-plan.md
\`\`\`

#### For Implementation Guidance
\`\`\`
I'm ready to implement Phase [X] of my migration plan.

Current component: [component-name]
Target pattern: [modern-pattern]
Requirements: [specific-requirements]

Help me:
1. Design the new component architecture
2. Plan the data migration approach
3. Ensure backward compatibility during transition
4. Create testing strategy for the migrated component
\`\`\`

## 📊 Migration Success Metrics

### Technical Metrics
- [ ] **Performance**: Response times improved by X%
- [ ] **Reliability**: Uptime improved to 99.9%+
- [ ] **Maintainability**: Code complexity reduced
- [ ] **Security**: Modern security practices implemented
- [ ] **Scalability**: System can handle X% more load

### Business Metrics  
- [ ] **Development velocity**: Feature delivery accelerated
- [ ] **Operational costs**: Infrastructure costs optimized
- [ ] **User satisfaction**: User experience improved
- [ ] **Compliance**: Security and regulatory requirements met

## 📚 Documentation & Resources

### Migration Templates
- **AI Discovery Guide** - \`docs/migration/ai-discovery-guide.md\`
- **Migration Plan Template** - \`docs/migration/migration-plan.md\`
- **Analysis Worksheet** - \`docs/migration/analysis-worksheet.md\`

### Best Practices
- Start small with low-risk components
- Maintain parallel systems during transition
- Implement comprehensive testing at each phase
- Document decisions and lessons learned
- Use feature flags for gradual rollouts

## 🎯 Next Steps

1. **Complete Discovery Phase** (Week 1-2)
   - Run AI-assisted codebase analysis
   - Complete analysis worksheet
   - Identify migration priorities

2. **Design Target Architecture** (Week 2-3)
   - Define modern architecture patterns
   - Plan data migration strategy
   - Design integration approach

3. **Execute Migration** (Week 4+)
   - Implement in small, manageable phases
   - Test thoroughly at each step
   - Monitor performance and user impact

4. **Optimize & Scale** (Ongoing)
   - Performance tuning
   - Feature enhancements
   - Team training on new architecture

---

**Migration Type:** ${config.migrationTarget || 'Full-stack modernization'}  
**Created:** ${new Date().toISOString().split('T')[0]}  
**AI-Assisted Development Ready** 🤖
`;

    await fs.writeFile(path.join(config.projectPath, 'README.md'), readmeContent);
    spinner.succeed('Migration project README created');
  } catch (error: any) {
    spinner.warn(`Could not create migration README: ${error.message}`);
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
  
  if (config.projectType === 'migration') {
    // Migration project next steps
    console.log(chalk.cyan.bold('🔄 AI-Assisted Migration Workflow:\n'));
    console.log(chalk.yellow(`  Your migration project is ready for AI-assisted legacy system modernization.`));
    console.log(chalk.yellow(`  Start by analyzing your existing codebase with AI assistance!\n`));
    
    console.log(chalk.cyan.bold('📂 Next steps:\n'));
    
    // Navigate to project
    console.log(chalk.white(`  1. Navigate to your migration project:`));
    console.log(chalk.gray(`     cd ${config.projectName}\n`));
    
    // Install dependencies if skipped
    if (config.skipInstall) {
      console.log(chalk.white(`  2. Install dependencies:`));
      console.log(chalk.gray(`     ${config.packageManager} install\n`));
    }
    
    // AI-assisted migration planning
    console.log(chalk.white(`  ${config.skipInstall ? '3' : '2'}. 🔍 Begin AI-assisted discovery (START HERE):`));
    console.log(chalk.gray(`     • Open docs/migration/ai-discovery-guide.md`));
    console.log(chalk.gray(`     • Start an AI chat session (GitHub Copilot, ChatGPT, Claude)`));
    console.log(chalk.gray(`     • Use this prompt template:\n`));
    
    console.log(chalk.cyan(`       "I'm migrating a ${config.migrationTarget === 'web' ? 'web application' : 
      config.migrationTarget === 'mobile' ? 'mobile app' : 
      config.migrationTarget === 'microservices' ? 'monolith to microservices' : 'system'}.`));
    console.log(chalk.cyan(`       Source: ${config.migrationSource || '[your-source-path]'}`));
    console.log(chalk.cyan(`       Target: ${config.migrationTarget || 'modern full-stack'}`));
    console.log(chalk.cyan(`       Help me analyze the codebase and plan migration strategy.`));
    console.log(chalk.cyan(`       Use docs/migration/ai-discovery-guide.md framework."\n`));
    
    console.log(chalk.white(`  ${config.skipInstall ? '4' : '3'}. 📋 Complete systematic analysis:`));
    console.log(chalk.gray(`     • Work through docs/migration/analysis-worksheet.md`));
    console.log(chalk.gray(`     • Fill out docs/migration/migration-plan.md`));
    console.log(chalk.gray(`     • Document decisions and insights\n`));
    
    console.log(chalk.white(`  ${config.skipInstall ? '5' : '4'}. 🏗️ Design target architecture:`));
    console.log(chalk.gray(`     • Use AI to design modern architecture patterns`));
    console.log(chalk.gray(`     • Plan data migration approach`));
    console.log(chalk.gray(`     • Design integration strategy\n`));
    
    console.log(chalk.white(`  ${config.skipInstall ? '6' : '5'}. 🔄 Execute incremental migration:`));
    console.log(chalk.gray(`     • Start with low-risk components`));
    console.log(chalk.gray(`     • Test thoroughly at each phase`));
    console.log(chalk.gray(`     • Monitor and validate progress\n`));
    
    // Documentation links
    console.log(chalk.cyan.bold('📚 Migration Documentation:\n'));
    console.log(chalk.gray(`  • README.md - Migration project overview`));
    console.log(chalk.gray(`  • docs/migration/ai-discovery-guide.md - AI-assisted system discovery`));
    console.log(chalk.gray(`  • docs/migration/migration-plan.md - 4-phase migration strategy`));
    console.log(chalk.gray(`  • docs/migration/analysis-worksheet.md - Systematic analysis checklist\n`));
    
    console.log(chalk.green(`Happy migrating! Your legacy system will be modern soon! 🚀\n`));
    return;
  }
  
  // New SGE app workflow
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
    if (config.projectType === 'migration') {
      // Migration project workflow
      await createMigrationProject(config, spinner);
      await setupCopilotInstructions(config, spinner);
      await createMigrationReadme(config, spinner);
      await installDependencies(config, spinner);
    } else {
      // New SGE app workflow
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
    }
    
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
  .option('--migration', 'Create a migration project instead of new app')
  .option('--source <path>', 'Source codebase path (for migration projects)')
  .option('--target <type>', 'Migration target (web|mobile|fullstack|microservices)')
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
          projectType: options.migration ? 'migration' : 'new',
          includeMobile: options.mobile !== false,
          includeSubscriptions: options.subscriptions !== false,
          includeNotifications: options.notifications !== false,
          includeAuth: options.auth !== false,
          emailProvider: options.email || 'resend',
          skipInstall: options.skipInstall || false,
          migrationSource: options.source,
          migrationTarget: options.target || 'fullstack'
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
