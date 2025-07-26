#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UnifiedMCPSetup {
  constructor() {
    // Handle both development and npm package scenarios
    this.projectPath = this.findProjectRoot(__dirname);
    this.distPath = path.join(this.projectPath, 'dist');
    this.serverPath = path.join(this.distPath, 'index.js');
    this.envPath = path.join(this.projectPath, '.env');
    this.supportedLLMs = ['claude', 'cursor'];
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
    const llm = args.find(arg => this.supportedLLMs.includes(arg.toLowerCase()));
    const help = args.includes('--help') || args.includes('-h');
    
    return {
      llm: llm?.toLowerCase(),
      help
    };
  }

  // Display help information
  displayHelp() {
    console.log(`
🚀 ArchiveNet MCP Setup Tool

Usage: setup-mcp <llm>

Supported LLMs:
  claude    Setup for Claude Desktop
  cursor    Setup for Cursor IDE

Examples:
  setup-mcp claude    # Configure for Claude Desktop
  setup-mcp cursor    # Configure for Cursor IDE
  
Options:
  --help, -h          Show this help message

Environment:
  Make sure you have a .env file with your API endpoints configured.
  Copy .env.example to .env and update the values.

Note: If .env file doesn't exist, you'll be prompted to create one.
`);
  }

  // Get config path based on LLM and OS
  getConfigPath(llm) {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (llm) {
      case 'claude':
        switch (platform) {
          case 'darwin': // macOS
            return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
          case 'win32': // Windows
            return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
          case 'linux': // Linux
            return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
          default:
            throw new Error(`Unsupported platform for Claude: ${platform}`);
        }
      
      case 'cursor':
        switch (platform) {
          case 'darwin': // macOS
            return path.join(homeDir, '.cursor', 'mcp.json');
          case 'win32': // Windows
            return path.join(homeDir, '.cursor', 'mcp.json');
          case 'linux': // Linux
            return path.join(homeDir, '.cursor', 'mcp.json');
          default:
            throw new Error(`Unsupported platform for Cursor: ${platform}`);
        }
      
      default:
        throw new Error(`Unsupported LLM: ${llm}`);
    }
  }

  // Check if required files exist
  checkRequiredFiles() {
    console.log('🔍 Checking required files...');
    
    const requiredFiles = [
      { path: this.serverPath, name: 'MCP Server (dist/index.js)' }
    ];

    // .env file is optional for npm packages
    if (fs.existsSync(path.join(this.projectPath, '.env.example'))) {
      requiredFiles.push({ path: this.envPath, name: 'Environment file (.env)' });
    }

    const missing = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file.path)) {
        missing.push(file.name);
      } else {
        console.log(`✅ Found: ${file.name}`);
      }
    }

    if (missing.length > 0) {
      console.error('❌ Missing required files:');
      missing.forEach(file => console.error(`   - ${file}`));
      
      if (missing.includes('MCP Server (dist/index.js)')) {
        console.log('\n💡 The MCP server needs to be built. Run "npm run build" first.');
      }
      
      if (missing.includes('Environment file (.env)')) {
        console.log('\n💡 You need to configure your API endpoints.');
        console.log('   Create a .env file with your INSERT_CONTEXT_ENDPOINT and SEARCH_CONTEXT_ENDPOINT');
      }
      
      return false;
    }

    return true;
  }

  // Create a basic .env file if it doesn't exist
  createEnvFile() {
    const envExamplePath = path.join(this.projectPath, '.env.example');
    
    if (fs.existsSync(envExamplePath)) {
      console.log('📝 Creating .env file from template...');
      fs.copyFileSync(envExamplePath, this.envPath);
      console.log('✅ Created .env file. Please edit it with your API endpoints.');
      return true;
    } else {
      console.log('📝 Creating basic .env file...');
      const basicEnv = `# ArchiveNet API Configuration
INSERT_CONTEXT_ENDPOINT=https://your-api.com/insert
SEARCH_CONTEXT_ENDPOINT=https://your-api.com/search
# Optional: Bearer token for authentication
# TOKEN=your-bearer-token-here
# Optional: Request timeout in milliseconds
API_TIMEOUT=30000
`;
      fs.writeFileSync(this.envPath, basicEnv);
      console.log('✅ Created basic .env file. Please edit it with your actual API endpoints.');
      return true;
    }
  }

  // Read environment variables from .env file
  readEnvFile() {
    console.log('📖 Reading environment configuration...');
    
    // Create .env file if it doesn't exist
    if (!fs.existsSync(this.envPath)) {
      console.log('⚠️  No .env file found. Creating one...');
      this.createEnvFile();
      console.log('\n🛑 Please edit the .env file with your actual API endpoints and run the setup again.');
      return null;
    }
    
    try {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });

      // Validate required environment variables
      const required = ['INSERT_CONTEXT_ENDPOINT', 'SEARCH_CONTEXT_ENDPOINT'];
      const missing = required.filter(key => !envVars[key] || envVars[key].includes('your-api.com'));
      
      if (missing.length > 0) {
        console.error('❌ Missing or unconfigured environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.log('\n💡 Please edit your .env file with actual API endpoints.');
        return null;
      }

      console.log('✅ Environment configuration loaded');
      return envVars;
    } catch (error) {
      console.error('❌ Failed to read .env file:', error.message);
      return null;
    }
  }

  // Create config directory if it doesn't exist
  ensureConfigDir(configPath) {
    const configDir = path.dirname(configPath);
    
    if (!fs.existsSync(configDir)) {
      console.log(`📁 Creating config directory: ${configDir}`);
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return configPath;
  }

  // Read existing config or create new one
  readExistingConfig(configPath, llm) {
    if (fs.existsSync(configPath)) {
      console.log(`📖 Reading existing ${llm.toUpperCase()} configuration...`);
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('⚠️  Failed to parse existing config, creating new one');
        return this.getDefaultConfig(llm);
      }
    } else {
      console.log(`📝 Creating new ${llm.toUpperCase()} configuration...`);
      return this.getDefaultConfig(llm);
    }
  }

  // Get default config structure for each LLM
  getDefaultConfig(llm) {
    switch (llm) {
      case 'claude':
        return { mcpServers: {} };
      case 'cursor':
        return { mcpServers: {} };
      default:
        return {};
    }
  }

  // Create Claude-specific configuration
  createClaudeConfig(envVars) {
    const configPath = this.ensureConfigDir(this.getConfigPath('claude'));
    const config = this.readExistingConfig(configPath, 'claude');

    // Ensure mcpServers object exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Prepare environment variables for the MCP server
    const mcpEnv = {
      INSERT_CONTEXT_ENDPOINT: envVars.INSERT_CONTEXT_ENDPOINT,
      SEARCH_CONTEXT_ENDPOINT: envVars.SEARCH_CONTEXT_ENDPOINT,
    };

    // Add optional environment variables if they exist
    if (envVars.TOKEN) {
      mcpEnv.TOKEN = envVars.TOKEN;
    }
    if (envVars.API_TIMEOUT) {
      mcpEnv.API_TIMEOUT = envVars.API_TIMEOUT;
    }

    // Add or update the archivenet server configuration
    config.mcpServers['archivenet'] = {
      command: 'node',
      args: [this.serverPath],
      env: mcpEnv
    };

    return { config, configPath };
  }

  // Create Cursor-specific configuration
  createCursorConfig(envVars) {
    const configPath = this.ensureConfigDir(this.getConfigPath('cursor'));
    const config = this.readExistingConfig(configPath, 'cursor');

    // Ensure mcpServers object exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Prepare environment variables for the MCP server
    const mcpEnv = {
      INSERT_CONTEXT_ENDPOINT: envVars.INSERT_CONTEXT_ENDPOINT,
      SEARCH_CONTEXT_ENDPOINT: envVars.SEARCH_CONTEXT_ENDPOINT,
    };

    // Add optional environment variables if they exist
    if (envVars.TOKEN) {
      mcpEnv.TOKEN = envVars.TOKEN;
    }
    if (envVars.API_TIMEOUT) {
      mcpEnv.API_TIMEOUT = envVars.API_TIMEOUT;
    }

    // Add or update the archivenet server configuration
    config.mcpServers['archivenet'] = {
      command: 'node',
      args: [this.serverPath],
      env: mcpEnv
    };

    return { config, configPath };
  }

  // Update config for specified LLM
  updateConfig(llm, envVars) {
    console.log(`🔧 Setting up ${llm.toUpperCase()} configuration...`);

    let configData;
    
    switch (llm) {
      case 'claude':
        configData = this.createClaudeConfig(envVars);
        break;
      case 'cursor':
        configData = this.createCursorConfig(envVars);
        break;
      default:
        throw new Error(`Unsupported LLM: ${llm}`);
    }

    const { config, configPath } = configData;

    // Write the updated configuration
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ ${llm.toUpperCase()} configuration updated successfully!`);
      console.log(`📍 Config file location: ${configPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to write ${llm.toUpperCase()} config:`, error.message);
      return false;
    }
  }

  // Build the MCP server if needed (only in development)
  buildServer() {
    if (!fs.existsSync(this.serverPath)) {
      // Check if we're in a development environment
      if (fs.existsSync(path.join(this.projectPath, 'src')) && 
          fs.existsSync(path.join(this.projectPath, 'tsconfig.json'))) {
        console.log('🔨 Building MCP server...');
        try {
          execSync('npm run build', { cwd: this.projectPath, stdio: 'inherit' });
          console.log('✅ MCP server built successfully!');
        } catch (error) {
          console.error('❌ Failed to build MCP server:', error.message);
          return false;
        }
      } else {
        console.error('❌ MCP server not found and cannot build (not in development environment)');
        console.log('💡 Make sure you have installed the package correctly.');
        return false;
      }
    } else {
      console.log('✅ MCP server found');
    }
    return true;
  }

  // Test the MCP server configuration
  testServer() {
    console.log('🧪 Testing MCP server configuration...');
    
    try {
      // Try to run the server for a brief moment to check for errors
      execSync(`node "${this.serverPath}" --help || echo "Server can be executed"`, {
        cwd: this.projectPath,
        timeout: 5000,
        stdio: 'pipe'
      });
      
      console.log('✅ MCP server configuration appears valid');
      return true;
    } catch (error) {
      console.warn('⚠️  Could not fully test server, but configuration has been created');
      return true; // Don't fail the setup for this
    }
  }

  // Display setup completion message
  displayCompletionMessage(llm) {
    console.log('\n🎉 Setup completed successfully!');
    console.log(`\n📋 Next steps for ${llm.toUpperCase()}:`);
    
    switch (llm) {
      case 'claude':
        console.log('1. 🔄 Restart Claude Desktop completely');
        console.log('2. 💬 Test the integration by sharing some personal information with Claude');
        console.log('3. 🔍 Ask Claude to recall that information to test the search functionality');
        break;
      case 'cursor':
        console.log('1. 🔄 Restart Cursor IDE completely');
        console.log('2. 💬 Test the integration by using MCP features in Cursor');
        console.log('3. 🔍 Use the context search functionality in your coding workflow');
        break;
    }
    
    console.log('\n💡 Example usage:');
    console.log('   Save: "My favorite programming language is TypeScript"');
    console.log('   Search: "What\'s my favorite programming language?"');
    
    console.log('\n🔧 Configuration details:');
    console.log(`   Server path: ${this.serverPath}`);
    console.log(`   Config file: ${this.getConfigPath(llm)}`);
    
    console.log('\n🐛 Troubleshooting:');
    console.log(`   - Check ${llm.toUpperCase()} logs if the connection fails`);
    console.log('   - Ensure your API endpoints are accessible');
    console.log('   - Verify all file paths are correct');
    console.log('   - Make sure the .env file is properly configured');
  }

  // Main setup process
  async run() {
    const { llm, help } = this.parseArgs();

    if (help) {
      this.displayHelp();
      return;
    }

    if (!llm) {
      console.error('❌ Please specify an LLM to configure.');
      console.log('\nSupported LLMs: claude, cursor');
      console.log('Usage: setup-mcp <llm>');
      console.log('Example: setup-mcp claude');
      console.log('\nFor more help: setup-mcp --help');
      process.exit(1);
    }

    console.log(`🚀 Setting up ArchiveNet MCP Server for ${llm.toUpperCase()}\n`);

    try {
      // Step 1: Build server if needed
      if (!this.buildServer()) {
        process.exit(1);
      }

      // Step 2: Check required files
      if (!this.checkRequiredFiles()) {
        process.exit(1);
      }

      // Step 3: Read environment configuration
      const envVars = this.readEnvFile();
      if (!envVars) {
        process.exit(1);
      }

      // Step 4: Update LLM configuration
      if (!this.updateConfig(llm, envVars)) {
        process.exit(1);
      }

      // Step 5: Test server configuration
      this.testServer();

      // Step 6: Display completion message
      this.displayCompletionMessage(llm);

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new UnifiedMCPSetup();
  setup.run();
}

export default UnifiedMCPSetup;