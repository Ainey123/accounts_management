import { readFileSync, writeFileSync } from 'fs';
import { PrismaClient } from '../src/generated/client/index.js';

// Load DATABASE_URL from .env (production Supabase)
const envRaw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*DATABASE_URL="?([^"\n]+)"?\s*$/);
  if (m) process.env.DATABASE_URL = m[1];
}

const prisma = new PrismaClient();

const tickets = await prisma.ticket.findMany({
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  select: { id: true, serialNo: true },
});

console.log(`Found ${tickets.length} tickets`);

if (tickets.length === 0) {
  console.log('Nothing to renumber.');
  await prisma.$disconnect();
  process.exit(0);
}

// Backup old -> new mapping for safety
const backup = tickets.map((t, i) => ({ id: t.id, oldSerial: t.serialNo, newSerial: String(i + 1) }));
writeFileSync(new URL('./serial-backup.json', import.meta.url), JSON.stringify(backup, null, 2));
console.log('Backup written to scripts/serial-backup.json');

// Stage 1: move to unique temp values to avoid unique-constraint collisions
for (const t of tickets) {
  await prisma.ticket.update({ where: { id: t.id }, data: { serialNo: `REN_${t.id}` } });
}

// Stage 2: assign final sequential plain numbers 1, 2, 3...
for (let i = 0; i < tickets.length; i++) {
  await prisma.ticket.update({ where: { id: tickets[i].id }, data: { serialNo: String(i + 1) } });
}

console.log(`Renumber complete: serials now 1 .. ${tickets.length}`);
await prisma.$disconnect();
