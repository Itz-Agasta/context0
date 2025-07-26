#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnvEditor {
  constructor() {
    // Handle both development and npm package scenarios
    this.projectPath = this.findProjectRoot(__dirname);
    this.envPath = path.join(this.projectPath, '.env');
    this.envExamplePath = path.join(this.projectPath, '.env.example');
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Find the project root (handles both dev and npm package scenarios)
  findProjectRoot(startDir) {
    let currentDir = startDir;
    
    // Go up one level from scripts/ directory
    const parentDir = path.dirname(currentDir);
    
    // Check if we're in an npm package (look for dist/ and package.json)
    if (fs.existsSync(path.join(parentDir, 'dist')) && 
        fs.existsSync(path.join(parentDir, 'package.json'))) {
      return parentDir;
    }
    
    // If not found, assume we're in development mode
    return parentDir;
  }

  // Parse command line arguments
  parseArgs() {
    const args = process.argv.slice(2);
    const help = args.includes('--help') || args.includes('-h');
    const interactive = args.includes('--interactive') || args.includes('-i');
    const reset = args.includes('--reset');
    const show = args.includes('--show');
    
    // Parse key=value pairs
    const updates = {};
    args.forEach(arg => {
      if (arg.includes('=') && !arg.startsWith('-')) {
        const [key, ...valueParts] = arg.split('=');
        updates[key.trim()] = valueParts.join('=').trim();
      }
    });

    return {
      help,
      interactive,
      reset,
      show,
      updates
    };
  }

  // Display help information
  displayHelp() {
    console.log(`
🔧 ArchiveNet Environment Editor

Usage: edit-env [options] [KEY=VALUE...]

Options:
  --interactive, -i   Interactive mode to edit all settings
  --reset            Reset .env file to default template
  --show             Show current environment configuration
  --help, -h         Show this help message

Direct Updates:
  You can directly set environment variables using KEY=VALUE syntax:
  
  edit-env INSERT_CONTEXT_ENDPOINT=https://api.example.com/insert
  edit-env SEARCH_CONTEXT_ENDPOINT=https://api.example.com/search
  edit-env TOKEN=your-bearer-token
  edit-env API_TIMEOUT=30000

Examples:
  edit-env --interactive                    # Interactive setup
  edit-env --show                          # Show current config
  edit-env --reset                         # Reset to defaults
  edit-env INSERT_CONTEXT_ENDPOINT=https://my-api.com/insert
  edit-env TOKEN=abc123 API_TIMEOUT=60000

Environment Variables:
  INSERT_CONTEXT_ENDPOINT    API endpoint for inserting context (required)
  SEARCH_CONTEXT_ENDPOINT    API endpoint for searching context (required)
  TOKEN                      Bearer token for authentication (optional)
  API_TIMEOUT                Request timeout in milliseconds (default: 30000)
`);
  }

  // Create .env file from template if it doesn't exist
  ensureEnvFile() {
    if (!fs.existsSync(this.envPath)) {
      console.log('📝 Creating .env file...');
      
      if (fs.existsSync(this.envExamplePath)) {
        fs.copyFileSync(this.envExamplePath, this.envPath);
        console.log('✅ Created .env file from template');
      } else {
        // Create basic .env file
        const basicEnv = `# ArchiveNet API Configuration
INSERT_CONTEXT_ENDPOINT=https://your-api.com/insert
SEARCH_CONTEXT_ENDPOINT=https://your-api.com/search
# Optional: Bearer token for authentication
# TOKEN=your-bearer-token-here
# Optional: Request timeout in milliseconds
API_TIMEOUT=30000
`;
        fs.writeFileSync(this.envPath, basicEnv);
        console.log('✅ Created basic .env file');
      }
    }
  }

  // Read current environment variables
  readEnvFile() {
    if (!fs.existsSync(this.envPath)) {
      return {};
    }

    const envContent = fs.readFileSync(this.envPath, 'utf8');
    const envVars = {};
    const comments = {};
    
    envContent.split('\n').forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('#')) {
        // Store comments
        const nextLine = envContent.split('\n')[index + 1];
        if (nextLine && !nextLine.trim().startsWith('#') && nextLine.includes('=')) {
          const [key] = nextLine.split('=');
          comments[key.trim()] = trimmedLine;
        }
      } else if (trimmedLine && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return { envVars, comments };
  }

  // Write environment variables to file
  writeEnvFile(envVars, comments = {}) {
    const lines = [];
    
    // Add header comment
    lines.push('# ArchiveNet API Configuration');
    lines.push('');
    
    // Define the order of variables
    const orderedKeys = [
      'INSERT_CONTEXT_ENDPOINT',
      'SEARCH_CONTEXT_ENDPOINT',
      'TOKEN',
      'API_TIMEOUT'
    ];

    // Add variables in order
    orderedKeys.forEach(key => {
      if (key === 'TOKEN') {
        lines.push('# Optional: Bearer token for authentication');
        if (envVars[key]) {
          lines.push(`${key}=${envVars[key]}`);
        } else {
          lines.push(`# ${key}=your-bearer-token-here`);
        }
      } else if (key === 'API_TIMEOUT') {
        lines.push('# Optional: Request timeout in milliseconds');
        lines.push(`${key}=${envVars[key] || '30000'}`);
      } else {
        if (comments[key]) {
          lines.push(comments[key]);
        }
        lines.push(`${key}=${envVars[key] || ''}`);
      }
      lines.push('');
    });

    // Add any additional variables not in the ordered list
    Object.keys(envVars).forEach(key => {
      if (!orderedKeys.includes(key)) {
        lines.push(`${key}=${envVars[key]}`);
      }
    });

    fs.writeFileSync(this.envPath, lines.join('\n'));
  }

  // Prompt user for input
  async prompt(question, defaultValue = '') {
    return new Promise((resolve) => {
      const displayDefault = defaultValue ? ` (${defaultValue})` : '';
      this.rl.question(`${question}${displayDefault}: `, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  // Validate URL
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Interactive mode
  async runInteractive() {
    console.log('🔧 Interactive Environment Configuration\n');
    
    this.ensureEnvFile();
    const { envVars } = this.readEnvFile();
    
    console.log('Configure your API endpoints and settings:\n');

    // Insert endpoint
    let insertEndpoint;
    do {
      insertEndpoint = await this.prompt(
        'Insert Context Endpoint (required)',
        envVars.INSERT_CONTEXT_ENDPOINT
      );
      if (!insertEndpoint) {
        console.log('❌ Insert endpoint is required');
      } else if (!this.isValidUrl(insertEndpoint)) {
        console.log('❌ Please enter a valid URL');
        insertEndpoint = null;
      }
    } while (!insertEndpoint);

    // Search endpoint
    let searchEndpoint;
    do {
      searchEndpoint = await this.prompt(
        'Search Context Endpoint (required)',
        envVars.SEARCH_CONTEXT_ENDPOINT
      );
      if (!searchEndpoint) {
        console.log('❌ Search endpoint is required');
      } else if (!this.isValidUrl(searchEndpoint)) {
        console.log('❌ Please enter a valid URL');
        searchEndpoint = null;
      }
    } while (!searchEndpoint);

    // Bearer Token (optional)
    const token = await this.prompt(
      'Bearer Token (optional, leave empty if not needed)',
      envVars.TOKEN
    );

    // API Timeout
    let apiTimeout;
    do {
      const timeoutInput = await this.prompt(
        'API Timeout in milliseconds',
        envVars.API_TIMEOUT || '30000'
      );
      apiTimeout = parseInt(timeoutInput);
      if (isNaN(apiTimeout) || apiTimeout <= 0) {
        console.log('❌ Please enter a valid positive number');
        apiTimeout = null;
      }
    } while (!apiTimeout);

    // Update environment variables
    const newEnvVars = {
      INSERT_CONTEXT_ENDPOINT: insertEndpoint,
      SEARCH_CONTEXT_ENDPOINT: searchEndpoint,
      API_TIMEOUT: apiTimeout.toString()
    };

    if (token) {
      newEnvVars.TOKEN = token;
    }

    this.writeEnvFile(newEnvVars);
    console.log('\n✅ Environment configuration updated successfully!');
    this.showCurrentConfig();
  }

  // Show current configuration
  showCurrentConfig() {
    console.log('\n📋 Current Configuration:');
    console.log('─'.repeat(50));
    
    if (!fs.existsSync(this.envPath)) {
      console.log('❌ No .env file found');
      return;
    }

    const { envVars } = this.readEnvFile();
    
    // Required variables
    console.log('Required Settings:');
    console.log(`  INSERT_CONTEXT_ENDPOINT: ${envVars.INSERT_CONTEXT_ENDPOINT || '❌ Not set'}`);
    console.log(`  SEARCH_CONTEXT_ENDPOINT: ${envVars.SEARCH_CONTEXT_ENDPOINT || '❌ Not set'}`);
    
    // Optional variables
    console.log('\nOptional Settings:');
    console.log(`  TOKEN: ${envVars.TOKEN ? '✅ Set (hidden)' : '⚪ Not set'}`);
    console.log(`  API_TIMEOUT: ${envVars.API_TIMEOUT || '30000'} ms`);

    // Validation
    console.log('\nValidation:');
    const hasRequired = envVars.INSERT_CONTEXT_ENDPOINT && envVars.SEARCH_CONTEXT_ENDPOINT;
    const validUrls = (!envVars.INSERT_CONTEXT_ENDPOINT || this.isValidUrl(envVars.INSERT_CONTEXT_ENDPOINT)) &&
                    (!envVars.SEARCH_CONTEXT_ENDPOINT || this.isValidUrl(envVars.SEARCH_CONTEXT_ENDPOINT));
    
    if (hasRequired && validUrls) {
      console.log('✅ Configuration is valid');
    } else {
      console.log('❌ Configuration needs attention:');
      if (!hasRequired) {
        console.log('   - Missing required endpoints');
      }
      if (!validUrls) {
        console.log('   - Invalid URL format detected');
      }
    }
  }

  // Reset to default template
  resetEnvFile() {
    console.log('🔄 Resetting .env file to default template...');
    
    if (fs.existsSync(this.envPath)) {
      // Backup existing file
      const backupPath = `${this.envPath}.backup.${Date.now()}`;
      fs.copyFileSync(this.envPath, backupPath);
      console.log(`📦 Backed up existing .env to: ${backupPath}`);
    }

    // Create new default file
    const defaultEnv = {
      INSERT_CONTEXT_ENDPOINT: 'https://your-api.com/insert',
      SEARCH_CONTEXT_ENDPOINT: 'https://your-api.com/search',
      API_TIMEOUT: '30000'
    };

    this.writeEnvFile(defaultEnv);
    console.log('✅ Reset .env file to default template');
    console.log('💡 Please edit the endpoints with your actual API URLs');
  }

  // Update specific environment variables
  updateEnvVars(updates) {
    console.log('🔧 Updating environment variables...');
    
    this.ensureEnvFile();
    const { envVars, comments } = this.readEnvFile();
    
    // Validate updates
    const validKeys = ['INSERT_CONTEXT_ENDPOINT', 'SEARCH_CONTEXT_ENDPOINT', 'TOKEN', 'API_TIMEOUT'];
    const invalidKeys = Object.keys(updates).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      console.log('⚠️  Warning: Unknown environment variables:');
      invalidKeys.forEach(key => console.log(`   - ${key}`));
    }

    // Validate URLs
    ['INSERT_CONTEXT_ENDPOINT', 'SEARCH_CONTEXT_ENDPOINT'].forEach(key => {
      if (updates[key] && !this.isValidUrl(updates[key])) {
        console.error(`❌ Invalid URL for ${key}: ${updates[key]}`);
        process.exit(1);
      }
    });

    // Validate timeout
    if (updates.API_TIMEOUT) {
      const timeout = parseInt(updates.API_TIMEOUT);
      if (isNaN(timeout) || timeout <= 0) {
        console.error(`❌ Invalid timeout value: ${updates.API_TIMEOUT}`);
        process.exit(1);
      }
    }

    // Apply updates
    const newEnvVars = { ...envVars, ...updates };
    this.writeEnvFile(newEnvVars, comments);
    
    console.log('✅ Environment variables updated:');
    Object.keys(updates).forEach(key => {
      const value = key === 'TOKEN' ? '***hidden***' : updates[key];
      console.log(`   ${key} = ${value}`);
    });
  }

  // Main execution
  async run() {
    const { help, interactive, reset, show, updates } = this.parseArgs();

    try {
      if (help) {
        this.displayHelp();
        return;
      }

      if (reset) {
        this.resetEnvFile();
        return;
      }

      if (show) {
        this.showCurrentConfig();
        return;
      }

      if (interactive) {
        await this.runInteractive();
        return;
      }

      if (Object.keys(updates).length > 0) {
        this.updateEnvVars(updates);
        console.log('\n📋 Updated Configuration:');
        this.showCurrentConfig();
        return;
      }

      // No specific action, show current config and help
      this.showCurrentConfig();
      console.log('\n💡 Use --help to see available options');
      console.log('💡 Use --interactive for guided setup');

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run the editor if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const editor = new EnvEditor();
  editor.run();
}

export default EnvEditor;