-- Initialize opening_message setting if it doesn't exist
-- This ensures the Welcome Message configured in Admin Dashboard is used in conversations

-- Check if opening_message exists, if not insert it
INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES (
    'opening_message',
    E'Hi, I''m MOMi 👋\nYour AI health coach, here to help you build the 7 Pillars of Wellness for you and your family. 🏠\nWhat do you need help with today?',
    'The welcome message users see when starting a new conversation',
    NOW(),
    NOW()
)
ON CONFLICT (setting_key) 
DO NOTHING;

-- Verify the insert
SELECT setting_key, setting_value, description 
FROM system_settings 
WHERE setting_key = 'opening_message';

