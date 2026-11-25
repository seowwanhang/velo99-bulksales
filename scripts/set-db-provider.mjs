import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const mode = process.argv[2] === 'sqlite' ? 'sqlite' : 'postgresql';
const raw = fs.readFileSync(schemaPath, 'utf8');
const updated = raw.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${mode}"`
);
fs.writeFileSync(schemaPath, updated, 'utf8');
console.log(`Updated prisma/schema.prisma datasource provider to "${mode}".`);
