/**
 * Migration Helper Script
 * Reads all migration files and outputs a combined SQL file
 *
 * Usage: node supabase/apply-migrations.js
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');

// Migration files in correct order
const migrationOrder = [
  '00001_initial_schema.sql',
  '00002_hero_slides.sql',
  '00003_store_settings.sql',
  '00004_multibuy_offers.sql',
  '00005_add_weight_grams.sql',
  '00006_add_category_emoji.sql',
  '00007_vendors_multivendor.sql',
  '00008_marketplace_features.sql',
  '00009_coupons_system.sql',
  '00010_referral_system.sql',
  '00010a_profile_enhancements.sql',
  '00011_loyalty_system.sql',
  '00012_ticket_support_system.sql',
  '00013_newsletter_system.sql',
  '00014_notifications_system.sql',
  '00015_recently_viewed.sql',
  '00016_delivery_slots.sql',
  '00017_live_chat.sql',
  '00018_chatbot_system.sql',
  '00019_high_priority_features.sql',
  '00020_admin_features.sql',
  '20240125_returns_system.sql',
  '20240126_automation_system.sql'
];

function combineMigrations() {
  console.log('🗄️  UK Grocery Store - Database Migration Helper\n');
  console.log('=' .repeat(60));

  let combinedSql = `-- ================================================================
-- UK GROCERY STORE - COMPLETE DATABASE SETUP
-- Combined Migration File
-- Generated: ${new Date().toISOString()}
-- ================================================================

-- IMPORTANT: Run this in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor

`;

  let totalMigrations = 0;
  let errors = [];

  for (const filename of migrationOrder) {
    const filepath = path.join(migrationsDir, filename);

    if (fs.existsSync(filepath)) {
      console.log(`✅ Reading: ${filename}`);
      const content = fs.readFileSync(filepath, 'utf8');

      combinedSql += `\n-- ================================================================
-- MIGRATION: ${filename}
-- ================================================================\n\n`;
      combinedSql += content;
      combinedSql += '\n\n';
      totalMigrations++;
    } else {
      console.log(`❌ Missing: ${filename}`);
      errors.push(filename);
    }
  }

  // Write combined file
  const outputPath = path.join(__dirname, 'FULL_DATABASE_SETUP.sql');
  fs.writeFileSync(outputPath, combinedSql);

  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   - Migrations found: ${totalMigrations}/${migrationOrder.length}`);
  console.log(`   - Output file: supabase/FULL_DATABASE_SETUP.sql`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Missing files: ${errors.join(', ')}`);
  }

  console.log(`\n📋 Next Steps:`);
  console.log(`   1. Open Supabase Dashboard (https://supabase.com/dashboard)`);
  console.log(`   2. Go to SQL Editor`);
  console.log(`   3. Copy contents of FULL_DATABASE_SETUP.sql`);
  console.log(`   4. Paste and click "Run"`);
  console.log(`\n✨ Done!\n`);
}

// Run
combineMigrations();
