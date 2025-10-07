/**
 * @module updateChatbotMemory
 * @description Extrae y guarda preferencias mencionadas durante la conversación
 */

const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analiza la conversación y extrae nuevas preferencias o información importante
 * @param {string} userId - ID del usuario
 * @param {string} userMessage - Mensaje del usuario
 * @param {string} momiReply - Respuesta de MOMi
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<Object|null>} Preferencias extraídas o null
 */
async function extractAndSavePreferences(userId, userMessage, momiReply, supabase) {
    try {
        // No procesar si el mensaje es muy corto o vacío
        if (!userMessage || userMessage.trim().length < 10) {
            return null;
        }

        // Construir prompt para extraer información
        const extractionPrompt = `You are analyzing a conversation to extract important user preferences and information.

User message: "${userMessage}"
AI response: "${momiReply}"

Extract any NEW preferences, facts, dietary restrictions, allergies, interests, or important information about the user that should be remembered for future conversations.

Focus on:
- Dietary restrictions or allergies mentioned (e.g., "I'm allergic to peanuts")
- Food preferences (e.g., "I love chicken", "I don't eat seafood")
- Family information (e.g., "My daughter loves soccer", "My son is vegetarian")
- Health conditions or concerns (e.g., "I have trouble sleeping")
- Lifestyle preferences (e.g., "I prefer quick recipes", "I work from home")
- Goals or challenges (e.g., "I want to lose weight", "I'm trying to reduce stress")

Return a JSON object with extracted information. Use descriptive keys and concise values.

If no new meaningful information is found, return an empty object: {}

Examples of good outputs:
{"daughter_interests": "soccer", "prefers": "quick recipes under 30 minutes"}
{"allergy": "peanuts and tree nuts", "goal": "improve sleep quality"}
{"son_diet": "vegetarian", "concern": "managing teen stress"}

Return ONLY valid JSON, no additional text.`;

        // Call OpenAI to extract preferences
        const extraction = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that extracts structured information from conversations. Always return valid JSON.'
                },
                {
                    role: 'user',
                    content: extractionPrompt
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 150,
            temperature: 0.3 // Lower temperature for more consistent extraction
        });

        const responseText = extraction.choices[0].message.content;
        
        if (!responseText || responseText.trim() === '') {
            console.log('No preferences extracted (empty response)');
            return null;
        }

        const extracted = JSON.parse(responseText);

        // Check if we extracted anything meaningful
        if (!extracted || Object.keys(extracted).length === 0) {
            console.log('No new preferences extracted');
            return null;
        }

        console.log('Extracted preferences:', extracted);

        // Load current chatbot_memory
        const { data: profile, error: fetchError } = await supabase
            .from('user_profiles')
            .select('chatbot_memory')
            .eq('auth_user_id', userId)
            .single();

        if (fetchError) {
            console.error('Error fetching user profile for memory update:', fetchError);
            return null;
        }

        const currentMemory = profile?.chatbot_memory || {};

        // Merge new preferences with existing ones
        const updatedMemory = {
            ...currentMemory,
            ...extracted,
            last_memory_update: new Date().toISOString()
        };

        // Save to database
        const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
                chatbot_memory: updatedMemory,
                updated_at: new Date().toISOString()
            })
            .eq('auth_user_id', userId);

        if (updateError) {
            console.error('Error updating chatbot memory:', updateError);
            return null;
        }

        console.log(`✅ Updated chatbot memory for user ${userId}:`, extracted);
        return extracted;

    } catch (error) {
        console.error('Error in extractAndSavePreferences:', error);
        
        // Don't throw - memory extraction is non-critical
        // The conversation should continue even if this fails
        return null;
    }
}

/**
 * Actualiza el chatbot_memory con información específica
 * @param {string} userId - ID del usuario
 * @param {Object} memoryUpdate - Objeto con los campos a actualizar
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
async function updateMemoryDirectly(userId, memoryUpdate, supabase) {
    try {
        if (!memoryUpdate || typeof memoryUpdate !== 'object') {
            console.warn('Invalid memory update object');
            return false;
        }

        // Load current memory
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('chatbot_memory')
            .eq('auth_user_id', userId)
            .single();

        const currentMemory = profile?.chatbot_memory || {};

        // Merge
        const updatedMemory = {
            ...currentMemory,
            ...memoryUpdate,
            last_memory_update: new Date().toISOString()
        };

        // Save
        const { error } = await supabase
            .from('user_profiles')
            .update({ 
                chatbot_memory: updatedMemory,
                updated_at: new Date().toISOString()
            })
            .eq('auth_user_id', userId);

        if (error) {
            console.error('Error updating memory directly:', error);
            return false;
        }

        console.log(`✅ Direct memory update for user ${userId}:`, memoryUpdate);
        return true;

    } catch (error) {
        console.error('Error in updateMemoryDirectly:', error);
        return false;
    }
}

/**
 * Limpia el chatbot_memory del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<boolean>} True si se limpió correctamente
 */
async function clearChatbotMemory(userId, supabase) {
    try {
        const { error } = await supabase
            .from('user_profiles')
            .update({ 
                chatbot_memory: {},
                updated_at: new Date().toISOString()
            })
            .eq('auth_user_id', userId);

        if (error) {
            console.error('Error clearing chatbot memory:', error);
            return false;
        }

        console.log(`✅ Cleared chatbot memory for user ${userId}`);
        return true;

    } catch (error) {
        console.error('Error in clearChatbotMemory:', error);
        return false;
    }
}

module.exports = {
    extractAndSavePreferences,
    updateMemoryDirectly,
    clearChatbotMemory
};

