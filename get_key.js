const { execSync } = require('child_process');
try {
  const output = execSync('netlify env:get SUPABASE_SERVICE_ROLE_KEY').toString();
  console.log('KEY_START' + output.trim() + 'KEY_END');
} catch (e) {
  console.log('Error:', e.message);
}
