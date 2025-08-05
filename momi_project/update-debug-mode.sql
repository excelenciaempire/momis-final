-- Enable debug mode for KB retrieval to see what's happening
UPDATE system_settings 
SET setting_value = '{"similarity_threshold":0.78,"max_chunks":5,"use_top_chunks":3,"debug_mode":true}'
WHERE setting_key = 'kb_retrieval_config';

-- Show the updated value
SELECT setting_key, setting_value 
FROM system_settings 
WHERE setting_key = 'kb_retrieval_config'; 