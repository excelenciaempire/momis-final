/**
 * @module buildSystemPrompt
 * @description Construye system prompts dinámicos personalizados por usuario
 */

const { buildUserContext, buildPersonalizationInstructions } = require('./buildUserContext');

/**
 * Construye un system prompt completo personalizado para el usuario
 * @param {Object} userProfile - Perfil completo del usuario
 * @param {Object} supabase - Cliente de Supabase
 * @param {string} ragContext - Contexto opcional del RAG
 * @returns {Promise<string>} System prompt completo y personalizado
 */
async function buildSystemPrompt(userProfile, supabase, ragContext = null) {
    try {
        // 1. Cargar base prompt de la base de datos
        let basePrompt = `You are MOMi, a warm, caring, and empathetic wellness assistant dedicated to supporting families and individuals based on the 7 Pillars of Wellness framework.

PERSONALITY TRAITS:
- Warm and approachable, using gentle language and appropriate emojis 😊 💛
- Empathetic and understanding, acknowledging feelings before offering solutions
- Supportive without being overbearing
- Professional yet personable
- Conversational and natural, like talking to a trusted friend

CORE CAPABILITIES:
1. Provide wellness guidance across the 7 Pillars: Food, Resilience, Movement, Community, Spiritual, Environment, and Abundance
2. Offer practical, actionable advice tailored to the user's situation
3. Remember and reference previous conversations
4. Adapt recommendations based on user preferences and constraints
5. Ask clarifying questions when needed

RESPONSE GUIDELINES:
- Start with empathy when appropriate ("I understand this can be challenging...")
- Provide clear, actionable advice
- Break down complex topics into digestible steps
- Use examples relevant to the user's situation
- Encourage and support without judgment
- Never provide medical, legal, or financial advice - recommend professionals for these areas

IMPORTANT DISCLAIMERS:
- You are an AI assistant, not a medical professional
- Always recommend consulting healthcare providers for medical concerns
- You cannot diagnose, treat, or prescribe
- Your role is supportive and educational`;

        // Try to get custom system prompt from database
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'system_prompt')
                .single();

            if (data && !error && data.setting_value) {
                basePrompt = data.setting_value;
            }
        } catch (dbError) {
            console.warn('Could not load custom system prompt, using default:', dbError.message);
        }

        // 2. Add user profile context
        const userContext = buildUserContext(userProfile);
        const personalizationInstructions = buildPersonalizationInstructions(userProfile);

        // 3. Construct final prompt
        let finalPrompt = basePrompt;
        
        // Add user context
        finalPrompt += '\n\n' + userContext;
        
        // Add personalization instructions
        finalPrompt += '\n' + personalizationInstructions;

        // 4. Add RAG context if available
        if (ragContext && ragContext.trim()) {
            finalPrompt += `\n\n==== KNOWLEDGE BASE CONTEXT ====
The following information is from our verified knowledge base. Use this information to provide accurate responses:

${ragContext}

KNOWLEDGE BASE USAGE RULES:
- Prioritize information from the knowledge base when it's relevant
- Blend KB facts with your supportive personality
- Reference specific details from the KB when appropriate
- If the KB contradicts general knowledge, trust the KB (it's from reliable sources)
- If asked about a topic not in the KB, provide general support and acknowledge you don't have specific documentation
==== END KNOWLEDGE BASE CONTEXT ====\n`;
        }

        return finalPrompt;

    } catch (error) {
        console.error('Error building system prompt:', error);
        
        // Fallback to minimal prompt if something goes wrong
        return `You are MOMi, a caring wellness assistant. Be empathetic, supportive, and helpful.

User: ${userProfile?.first_name || 'User'}
Always maintain conversation context and remember what the user tells you.`;
    }
}

/**
 * Obtiene el mensaje de bienvenida personalizado desde la configuración del sistema
 * @param {Object} userProfile - Perfil del usuario
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<string>} Mensaje de bienvenida personalizado
 */
async function getPersonalizedWelcomeMessage(userProfile, supabase) {
    try {
        // Obtener el mensaje de bienvenida configurado en el sistema
        const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'opening_message')
            .single();

        let welcomeMessage = '';
        
        if (data && !error && data.setting_value) {
            // Usar el mensaje configurado en el sistema
            welcomeMessage = data.setting_value;
        } else {
            // Fallback message si no hay configuración
            console.warn('Opening message not found in system_settings, using fallback');
            welcomeMessage = "Hi, I'm MOMi 👋\nYour AI health coach, here to help you build the 7 Pillars of Wellness for you and your family. 🏠\nWhat do you need help with today?";
        }

        // Personalizar el mensaje con el nombre del usuario si está disponible
        // Reemplazar variables comunes en el mensaje
        if (userProfile && userProfile.first_name) {
            // Si el mensaje tiene {name} o similar, reemplazarlo
            welcomeMessage = welcomeMessage.replace(/\{name\}/gi, userProfile.first_name);
            welcomeMessage = welcomeMessage.replace(/\{first_name\}/gi, userProfile.first_name);
        }

        return welcomeMessage;
    } catch (error) {
        console.error('Error getting welcome message:', error);
        // Fallback ultra seguro
        const name = userProfile?.first_name || 'there';
        return `Hi ${name}! 😊 I'm MOMi, your wellness assistant. How can I help you today?`;
    }
}


module.exports = {
    buildSystemPrompt,
    getPersonalizedWelcomeMessage
};

