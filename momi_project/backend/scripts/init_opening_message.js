/**
 * Script to initialize the opening_message setting in system_settings
 * Run this script to ensure the Welcome Message is properly configured
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../utils/supabaseClient');

async function initOpeningMessage() {
    try {
        console.log('Checking if opening_message exists in system_settings...');
        
        // Check if opening_message already exists
        const { data: existingData, error: checkError } = await supabase
            .from('system_settings')
            .select('setting_key, setting_value')
            .eq('setting_key', 'opening_message')
            .single();
        
        if (existingData && !checkError) {
            console.log('✅ opening_message already exists:');
            console.log('Current value:', existingData.setting_value);
            console.log('\nNo changes needed. You can update this via the Admin Dashboard.');
            return;
        }
        
        // If it doesn't exist, create it
        console.log('❌ opening_message not found. Creating default...');
        
        const defaultMessage = `Hi, I'm MOMi 👋
Your AI health coach, here to help you build the 7 Pillars of Wellness for you and your family. 🏠
What do you need help with today?`;
        
        const { data, error } = await supabase
            .from('system_settings')
            .insert([{
                setting_key: 'opening_message',
                setting_value: defaultMessage,
                description: 'The welcome message users see when starting a new conversation',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating opening_message:', error);
            process.exit(1);
        }
        
        console.log('✅ Successfully created opening_message:');
        console.log('Value:', data.setting_value);
        console.log('\nYou can now customize this message in the Admin Dashboard > System Prompt > Welcome Message');
        
    } catch (error) {
        console.error('Unexpected error:', error);
        process.exit(1);
    }
}

// Run the script
initOpeningMessage()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });

