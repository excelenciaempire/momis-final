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
 * Obtiene el mensaje de bienvenida personalizado
 * @param {Object} userProfile - Perfil del usuario
 * @returns {string} Mensaje de bienvenida personalizado
 */
function getPersonalizedWelcomeMessage(userProfile) {
    if (!userProfile) {
        return "Hi there! 😊 I'm MOMi, your wellness assistant. How can I help you today?";
    }

    const name = userProfile.first_name || 'there';
    const timeOfDay = getTimeOfDay();
    
    // Diferentes saludos basados en el perfil
    const greetings = [];

    // Greeting base con nombre
    greetings.push(`Good ${timeOfDay}, ${name}! 😊`);

    // Personalización basada en roles
    if (userProfile.family_roles && userProfile.family_roles.includes('currently_pregnant')) {
        greetings.push("How are you and baby doing today?");
    } else if (userProfile.family_roles && userProfile.family_roles.includes('mom_young_children')) {
        greetings.push("I hope you and your little ones are having a great day!");
    } else if (userProfile.family_roles && userProfile.family_roles.includes('mom_teens')) {
        greetings.push("How's everything going with your teens?");
    } else {
        greetings.push("How are you doing today?");
    }

    // Agregar referencia a sus preocupaciones principales si es primera conversación
    if (userProfile.main_concerns && userProfile.main_concerns.length > 0) {
        const concerns = userProfile.main_concerns.slice(0, 2).join(' and ');
        greetings.push(`I'm here to support you with ${concerns} and more.`);
    } else {
        greetings.push("I'm here to support you with wellness, nutrition, family life, and more.");
    }

    greetings.push("What can I help you with today? 💛");

    return greetings.join(' ');
}

/**
 * Determina la hora del día para saludos
 * @returns {string} 'morning', 'afternoon', o 'evening'
 */
function getTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return 'morning';
    } else if (hour >= 12 && hour < 17) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

module.exports = {
    buildSystemPrompt,
    getPersonalizedWelcomeMessage
};

