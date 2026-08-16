const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // If it has "import { format } from 'date-fns'" exactly
      if (content.includes("import { format } from 'date-fns'")) {
        content = content.replace("import { format } from 'date-fns'", "import { format } from '@/lib/utils/date'");
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      } 
      // If it imports format with other things from date-fns
      else if (content.match(/import\s+{.*?\bformat\b.*?}\s+from\s+['"]date-fns['"]/)) {
        // We'll replace `format, ` or `format ` from the import list
        const match = content.match(/import\s+{(.*?)}\s+from\s+['"]date-fns['"]/);
        if (match) {
          const imports = match[1].split(',').map(s => s.trim());
          if (imports.includes('format')) {
            const newImports = imports.filter(i => i !== 'format');
            if (newImports.length === 0) {
               content = content.replace(match[0], "import { format } from '@/lib/utils/date'");
            } else {
               content = content.replace(match[0], `import { ${newImports.join(', ')} } from 'date-fns'\nimport { format } from '@/lib/utils/date'`);
            }
            fs.writeFileSync(fullPath, content);
            console.log('Fixed multiline', fullPath);
          }
        }
      }
    }
  }
}

processDir(path.join(__dirname, '../src'));
