/**
 * JWT Token Extraction Script
 *
 * This script helps extract the JWT token from Supabase authentication
 * for testing purposes.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n📋 JWT Token Extraction Guide');
console.log('===============================\n');

console.log('To extract your JWT token, follow these steps:\n');

console.log('1. Open the application in your browser:');
console.log('   http://localhost:3000\n');

console.log('2. Open Browser DevTools:');
console.log('   - Chrome/Edge: Press F12 or Ctrl+Shift+I');
console.log('   - Firefox: Press F12\n');

console.log('3. Login to the application (if not already logged in)\n');

console.log('4. In DevTools Console, run this command:');
console.log('   ----------------------------------------');
console.log('   const session = await _supabase.auth.getSession();');
console.log('   console.log(session.data.session.access_token);');
console.log('   ----------------------------------------\n');

console.log('5. Copy the displayed token (long string starting with "eyJ...")\n');

console.log('6. Paste the token below and press Enter:\n');

rl.question('JWT Token: ', (token) => {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    console.error('\n❌ Error: No token provided');
    rl.close();
    process.exit(1);
  }

  // Basic JWT format validation (should start with eyJ)
  if (!trimmedToken.startsWith('eyJ')) {
    console.error('\n❌ Error: Invalid JWT token format');
    console.error('   JWT tokens should start with "eyJ"');
    rl.close();
    process.exit(1);
  }

  // Path to .env file
  const envPath = path.join(__dirname, 'services', 'ai', '.env');

  try {
    // Read existing .env content
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Check if TEST_JWT_TOKEN already exists
    const tokenRegex = /^TEST_JWT_TOKEN=.*$/m;
    const newTokenLine = `TEST_JWT_TOKEN=${trimmedToken}`;

    if (tokenRegex.test(envContent)) {
      // Replace existing token
      envContent = envContent.replace(tokenRegex, newTokenLine);
      console.log('\n✅ Updated existing TEST_JWT_TOKEN in .env file');
    } else {
      // Add new token at the end
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `\n# JWT Token for Testing (expires in ~1 hour)\n`;
      envContent += `${newTokenLine}\n`;
      console.log('\n✅ Added TEST_JWT_TOKEN to .env file');
    }

    // Write back to file
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('\n📄 File location: services/ai/.env');
    console.log('⚠️  Note: JWT tokens expire after ~1 hour');
    console.log('   You will need to re-extract the token when it expires\n');

    console.log('Next steps:');
    console.log('1. Run Phase 5.2 SSE streaming tests:');
    console.log('   cd services/ai');
    console.log('   python test_sse_streaming.py\n');

  } catch (error) {
    console.error('\n❌ Error writing to .env file:', error.message);
    process.exit(1);
  }

  rl.close();
});
