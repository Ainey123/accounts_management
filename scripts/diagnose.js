const { PrismaClient } = require('../src/generated/client');
const { google } = require('googleapis');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log("=== DIAGNOSTIC START ===");
    console.log("Environment Variables:");
    console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Configured" : "MISSING");
    console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Configured" : "MISSING");
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Configured" : "MISSING");

    const accounts = await prisma.gmailAccount.findMany();
    console.log(`\nConnected Gmail Accounts in DB: ${accounts.length}`);
    
    for (const account of accounts) {
      console.log(`\nAccount: ${account.gmailEmail}`);
      console.log(`- Expiry Date: ${new Date(Number(account.expiryDate)).toISOString()}`);
      console.log(`- Token Expired: ${Date.now() > Number(account.expiryDate)}`);
      console.log(`- Synced At: ${account.syncedAt}`);

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "https://your-app.vercel.app/api/gmail/callback"
      );

      oauth2Client.setCredentials({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
        expiry_date: Number(account.expiryDate),
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      try {
        console.log("- Testing user profile API call...");
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log(`  Profile Email: ${profile.data.emailAddress}`);
        console.log(`  Total Messages: ${profile.data.messagesTotal}`);
      } catch (err) {
        console.log(`  ❌ API Profile call failed: ${err.message}`);
        continue;
      }

      const q = 'after:2026/07/07';
      console.log(`- Querying Gmail for '${q}'...`);
      try {
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: q,
          maxResults: 20
        });

        const msgs = listRes.data.messages || [];
        console.log(`  Found ${msgs.length} messages in Gmail query.`);

        const dbTickets = await prisma.ticket.findMany({
          select: { gmailMessageId: true, subject: true, serialNo: true }
        });
        const dbMsgIds = new Set(dbTickets.map(t => t.gmailMessageId));
        console.log(`  Total tickets in DB: ${dbTickets.length}`);

        for (const msg of msgs) {
          const inDb = dbMsgIds.has(msg.id);
          const ticketInDb = dbTickets.find(t => t.gmailMessageId === msg.id);
          console.log(`  * Message ID: ${msg.id} | In DB: ${inDb ? "YES (Serial: " + ticketInDb.serialNo + ")" : "NO"}`);
          
          if (!inDb) {
            // Let's get the subject
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date']
            });
            const headers = detail.data.payload.headers || [];
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const date = headers.find(h => h.name === 'Date')?.value || 'Unknown';
            console.log(`    Subject: "${subject}"`);
            console.log(`    From: ${from}`);
            console.log(`    Date: ${date}`);
          }
        }
      } catch (err) {
        console.log(`  ❌ Gmail query failed: ${err.message}`);
      }
    }

  } catch (err) {
    console.error("Fatal diagnostic error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
