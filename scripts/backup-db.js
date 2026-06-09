/**
 * Database Backup Script
 * Creates a backup of the PostgreSQL database
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  try {
    console.log('Starting database backup...');
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be set in environment variables');
    }
    
    // Parse the database URL
    const url = new URL(databaseUrl);
    const dbName = url.pathname.slice(1);
    const host = url.hostname;
    const port = url.port || '5432';
    const user = url.username;
    
    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    const backupFile = path.join(backupDir, `educlub-backup-${timestamp}.sql`);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Build pg_dump command
    const pgDumpCommand = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} > "${backupFile}"`;
    
    console.log(`Running: ${pgDumpCommand}`);
    
    // Execute the backup
    exec(pgDumpCommand, { env: { ...process.env, PGPASSWORD: url.password } }, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', error);
        process.exit(1);
      }
      
      console.log(`Database backup completed: ${backupFile}`);
      
      // Get file size
      const stats = fs.statSync(backupFile);
      console.log(`Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

backupDatabase();
