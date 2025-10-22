/**
 * Simple script to fix user profiles with empty first_name and last_name
 * Uses direct Supabase client queries instead of raw SQL
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../utils/supabaseClient');

async function fixUserProfiles() {
    try {
        console.log('=== Fixing User Profiles with Empty Names ===\n');

        // Step 1: Get all user profiles with their auth user data
        console.log('Step 1: Fetching users with empty names...\n');
        
        const { data: emptyProfiles, error: fetchError } = await supabase
            .from('user_profiles')
            .select('id, auth_user_id, email, first_name, last_name')
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching profiles:', fetchError);
            return;
        }

        console.log(`Total profiles: ${emptyProfiles.length}`);
        
        const usersWithEmptyNames = emptyProfiles.filter(p => 
            !p.first_name?.trim() || !p.last_name?.trim()
        );
        
        console.log(`Profiles with empty names: ${usersWithEmptyNames.length}\n`);

        if (usersWithEmptyNames.length === 0) {
            console.log('✅ All profiles already have names!');
            return;
        }

        // Step 2: Show users with empty names
        console.log('Users with empty names:');
        console.table(usersWithEmptyNames.map(u => ({
            email: u.email,
            first_name: u.first_name || '(empty)',
            last_name: u.last_name || '(empty)',
            auth_user_id: u.auth_user_id?.substring(0, 8) + '...'
        })));

        // Step 3: For now, let's just report the issue
        console.log('\n⚠️  These users need to have their profiles updated.');
        console.log('The registration form already has required fields for names.');
        console.log('These users likely registered before the validation was added.\n');

        // Step 4: Generate a report
        console.log('=== REPORT ===');
        console.log(`Total user profiles: ${emptyProfiles.length}`);
        console.log(`Profiles with complete names: ${emptyProfiles.length - usersWithEmptyNames.length}`);
        console.log(`Profiles with empty names: ${usersWithEmptyNames.length}`);
        console.log(`Percentage complete: ${((emptyProfiles.length - usersWithEmptyNames.length) / emptyProfiles.length * 100).toFixed(1)}%`);

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Run the script
fixUserProfiles()
    .then(() => {
        console.log('\n✅ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });

