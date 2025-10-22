/**
 * Script to fix user profiles with empty first_name and last_name
 * This updates the database trigger and migrates existing users
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');

async function fixUserProfiles() {
    try {
        console.log('=== Fixing User Profiles with Empty Names ===\n');

        // Read the SQL file
        const sqlPath = path.join(__dirname, '..', 'sql', 'fix_user_profiles_names.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Split SQL into individual statements (rough split by semicolon at end of line)
        const statements = sqlContent
            .split(/;\s*\n/)
            .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
            .map(stmt => stmt.trim() + ';');

        console.log(`Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            
            // Skip comments and empty statements
            if (!stmt || stmt === ';' || stmt.startsWith('--')) continue;
            
            console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
            
            try {
                // For SELECT statements, get the data
                if (stmt.trim().toUpperCase().startsWith('SELECT')) {
                    const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });
                    if (error) {
                        console.error('Error:', error.message);
                    } else {
                        console.log('Query results:');
                        console.table(data || []);
                    }
                } else {
                    // For other statements, just execute
                    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
                    if (error) {
                        console.error('Error:', error.message);
                    } else {
                        console.log('✅ Success');
                    }
                }
            } catch (err) {
                console.error('Statement error:', err.message);
            }
        }

        // Now let's check the results directly
        console.log('\n\n=== Checking Current User Profiles ===\n');
        
        const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, auth_user_id, email, first_name, last_name, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
        } else {
            console.log(`Total profiles retrieved: ${profiles.length}\n`);
            
            let emptyCount = 0;
            let filledCount = 0;
            
            profiles.forEach(profile => {
                const firstName = profile.first_name?.trim() || '';
                const lastName = profile.last_name?.trim() || '';
                const hasName = firstName && lastName;
                
                if (hasName) {
                    filledCount++;
                } else {
                    emptyCount++;
                    console.log(`❌ Empty name: ${profile.email}`);
                    console.log(`   first_name: "${profile.first_name}"`);
                    console.log(`   last_name: "${profile.last_name}"`);
                    console.log(`   auth_user_id: ${profile.auth_user_id}\n`);
                }
            });
            
            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Profiles with names: ${filledCount}`);
            console.log(`   ❌ Profiles with empty names: ${emptyCount}`);
        }

        // Check auth.users metadata for users with empty profiles
        console.log('\n\n=== Checking auth.users metadata ===\n');
        
        const { data: emptyProfiles } = await supabase
            .from('user_profiles')
            .select('auth_user_id, email, first_name, last_name')
            .or('first_name.eq.,last_name.eq.')
            .limit(10);

        if (emptyProfiles && emptyProfiles.length > 0) {
            console.log(`Found ${emptyProfiles.length} profiles with empty names`);
            console.log('These users may need to update their profiles manually\n');
            
            for (const profile of emptyProfiles) {
                console.log(`- ${profile.email}`);
                console.log(`  Profile ID: ${profile.auth_user_id}`);
                console.log(`  first_name: "${profile.first_name || ''}"`);
                console.log(`  last_name: "${profile.last_name || ''}"\n`);
            }
        } else {
            console.log('✅ All profiles have names!');
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Run the script
fixUserProfiles()
    .then(() => {
        console.log('\n✅ Fix user profiles script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fix user profiles script failed:', error);
        process.exit(1);
    });

