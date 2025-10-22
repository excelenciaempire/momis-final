/**
 * Debug script to check conversations and user_profiles relationship
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../utils/supabaseClient');

async function debugConversations() {
    try {
        console.log('=== Debugging Conversations and User Profiles ===\n');

        // 1. Get a sample conversation
        console.log('1. Fetching sample conversations...');
        const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .not('user_id', 'is', null)
            .limit(3);

        if (convError) {
            console.error('Error fetching conversations:', convError);
            return;
        }

        console.log(`Found ${conversations?.length || 0} conversations\n`);

        if (conversations && conversations.length > 0) {
            for (const conv of conversations) {
                console.log(`\n--- Conversation ID: ${conv.id} ---`);
                console.log(`   user_id: ${conv.user_id}`);
                console.log(`   created_at: ${conv.created_at}`);

                // 2. Try to find user_profile by id
                console.log('\n   Trying to find user_profile by id...');
                const { data: profileById, error: profileByIdError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', conv.user_id)
                    .single();

                if (profileByIdError) {
                    console.log(`   ❌ Error finding by id:`, profileByIdError.message);
                } else if (profileById) {
                    console.log(`   ✅ Found profile by id:`);
                    console.log(`      - first_name: ${profileById.first_name}`);
                    console.log(`      - last_name: ${profileById.last_name}`);
                    console.log(`      - email: ${profileById.email}`);
                } else {
                    console.log(`   ❌ No profile found by id`);
                }

                // 3. Try to find user_profile by auth_user_id
                console.log('\n   Trying to find user_profile by auth_user_id...');
                const { data: profileByAuthId, error: profileByAuthIdError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('auth_user_id', conv.user_id)
                    .single();

                if (profileByAuthIdError) {
                    console.log(`   ❌ Error finding by auth_user_id:`, profileByAuthIdError.message);
                } else if (profileByAuthId) {
                    console.log(`   ✅ Found profile by auth_user_id:`);
                    console.log(`      - id: ${profileByAuthId.id}`);
                    console.log(`      - first_name: ${profileByAuthId.first_name}`);
                    console.log(`      - last_name: ${profileByAuthId.last_name}`);
                    console.log(`      - email: ${profileByAuthId.email}`);
                } else {
                    console.log(`   ❌ No profile found by auth_user_id`);
                }
            }
        }

        // 4. Check all user_profiles
        console.log('\n\n=== All User Profiles ===');
        const { data: allProfiles, error: allProfilesError } = await supabase
            .from('user_profiles')
            .select('id, auth_user_id, first_name, last_name, email')
            .limit(10);

        if (allProfilesError) {
            console.error('Error fetching all profiles:', allProfilesError);
        } else {
            console.log(`Total profiles found: ${allProfiles?.length || 0}\n`);
            allProfiles?.forEach(profile => {
                console.log(`- ID: ${profile.id}`);
                console.log(`  Auth User ID: ${profile.auth_user_id}`);
                console.log(`  Name: ${profile.first_name} ${profile.last_name}`);
                console.log(`  Email: ${profile.email}\n`);
            });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Run the debug script
debugConversations()
    .then(() => {
        console.log('\n✅ Debug script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Debug script failed:', error);
        process.exit(1);
    });

