const fs = require('fs');
const path = require('path');

const DIR = 'c:\\Users\\adibh\\vertex-picks\\src';

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFiles(DIR);

const results = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const fileIssues = [];
  
  lines.forEach((line, idx) => {
    const num = idx + 1;
    // Dead Buttons & Fake Actions
    if (line.match(/onClick=\{\s*\(\)\s*=>\s*toast\.(success|error)\([^)]+\)\s*\}/)) {
      fileIssues.push(`- [ ] Line ${num}: Fake action (toast-only onClick handler): \`${line.trim()}\``);
    }
    if (line.match(/onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/) || line.match(/onClick=\{\s*\(\)\s*=>\s*console\.log/)) {
      fileIssues.push(`- [ ] Line ${num}: Dead button (empty function or console.log): \`${line.trim()}\``);
    }
    // Hardcoded Analytics & Charts
    if (line.match(/const\s+(?:revenue|sales|chart|city)[A-Za-z0-9_]*\s*=\s*\[/)) {
      fileIssues.push(`- [ ] Line ${num}: Hardcoded analytics array: \`${line.trim().substring(0, 50)}\``);
    }
    if (line.match(/>\s*[\d,]+\s*(?:orders|sales|revenue|users)\s*</i) || line.match(/>\s*৳\s*[\d,]+\s*</)) {
      fileIssues.push(`- [ ] Line ${num}: Hardcoded summary number: \`${line.trim()}\``);
    }
    // Mock Databases & Static State
    if (line.match(/const\s+(?:PRODUCTS|DEMO_USERS|MOCK_DATA|TRANSACTIONS)\s*=\s*\[/)) {
      fileIssues.push(`- [ ] Line ${num}: Mock database/static state: \`${line.trim().substring(0, 50)}\``);
    }
    // Dummy Assets & Placeholders
    if (line.match(/unsplash\.com/) || line.match(/i\.ibb\.co/)) {
      fileIssues.push(`- [ ] Line ${num}: Hardcoded external image URL (unsplash/i.ibb.co): \`${line.trim().substring(0, 80)}\``);
    }
    if (line.match(/Example Aam|Testing|Lorem Ipsum/i)) {
      fileIssues.push(`- [ ] Line ${num}: Placeholder text: \`${line.trim().substring(0, 80)}\``);
    }
  });

  // Buttons without onClick
  const buttonRegex = /<button([^>]+)>/g;
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    if (!match[1].includes('onClick') && !match[1].includes('type="submit"')) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      // Let's just check if the button tag is on one line for simplicity, or just report it
      fileIssues.push(`- [ ] Line ${lineNum}: Button missing onClick handler (and not type="submit")`);
    }
  }

  if (fileIssues.length > 0) {
    const relPath = path.relative(DIR, file).replace(/\\/g, '/');
    results[`### 📊 ${path.basename(file)} (\`${relPath}\`)`] = fileIssues;
  }
}

let md = `# Fake Data & Dead End Audit\n\n`;
for (const [key, issues] of Object.entries(results)) {
  md += `${key}\n`;
  const uniqueIssues = [...new Set(issues)];
  uniqueIssues.forEach(issue => md += `${issue}\n`);
  md += `\n`;
}

fs.writeFileSync('C:\\Users\\adibh\\.gemini\\antigravity-ide\\brain\\72b7a5ae-a414-4d7b-a473-b15194a014d1\\fake_data_audit.md', md);
console.log('Audit complete.');
