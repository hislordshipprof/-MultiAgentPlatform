// Quick connection test - Run with: npx ts-node test-connection.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Ensure DATABASE_URL is available in process.env
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in environment variables!');
  console.error('Make sure .env file exists in backend/ directory and is correctly configured.');
  process.exit(1);
}

const safeUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
console.log('DATABASE_URL found:', safeUrl);

// Prisma 7: Requires adapter when using engine type "client"
const pool = new Pool({
  connectionString: dbUrl,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testConnection() {
  try {
    console.log('\nAttempting to connect to database...');
    await prisma.$connect();
    console.log('Successfully connected to database!');
    
    // Try a simple query
    console.log('\nTesting database query...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Database query successful!');
    console.log('PostgreSQL version:', result);
    
    await prisma.$disconnect();
    console.log('\nTest completed successfully!');
  } catch (error: any) {
    console.error('\nConnection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'P1000') {
      console.log('\nAuthentication failed. Possible solutions:');
      console.log('1. Try with 127.0.0.1 instead of localhost');
      console.log('2. Add SSL parameter: ?sslmode=prefer');
      console.log('3. Verify password is URL-encoded (@ becomes %40)');
      console.log('4. Check PostgreSQL service is running');
    }
    
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

testConnection();
