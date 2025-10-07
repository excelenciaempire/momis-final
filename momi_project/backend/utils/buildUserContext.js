/**
 * @module buildUserContext
 * @description Construye un contexto completo del usuario para personalizar las respuestas de MOMi
 */

/**
 * Construye un contexto detallado del perfil del usuario para inyectar en el system prompt
 * @param {Object} userProfile - Perfil completo del usuario desde user_profiles table
 * @returns {string} Contexto formateado como texto para OpenAI
 */
function buildUserContext(userProfile) {
    if (!userProfile) {
        return "\n--- USER PROFILE CONTEXT ---\nNo user profile data available.\n--- END USER PROFILE ---\n";
    }

    const contextParts = [];
    
    contextParts.push("--- USER PROFILE CONTEXT ---");
    contextParts.push(`User: ${userProfile.first_name} ${userProfile.last_name}`);
    contextParts.push(`Email: ${userProfile.email}`);

    // Family Roles
    if (userProfile.family_roles && userProfile.family_roles.length > 0) {
        const roleMap = {
            'hoping_to_become_mother': 'Hoping to become a mother one day',
            'currently_pregnant': 'Currently pregnant',
            'mom_young_children': 'Mom of young children (0-5 years)',
            'mom_school_age': 'Mom of school-age children (6-12 years)',
            'mom_teens': 'Mom of teens (13-18 years)',
            'wise_woman': 'Wise Woman (Grandparent, Aunt, etc) helping raise children'
        };
        
        const roles = userProfile.family_roles
            .filter(role => role && role !== 'other')
            .map(role => roleMap[role] || role);
        
        if (roles.length > 0) {
            contextParts.push(`\nFamily Role(s): ${roles.join(', ')}`);
        }
    }

    // Children Information
    if (userProfile.children_count > 0) {
        contextParts.push(`Number of Children: ${userProfile.children_count}`);
        
        if (userProfile.children_ages && userProfile.children_ages.length > 0) {
            const ageMap = {
                '0-2': '0-2 years (Infant/Toddler)',
                '3-5': '3-5 years (Preschool)',
                '6-12': '6-12 years (School-age)',
                '13-18': '13-18 years (Teen)',
                '18+': '18+ years (Young Adult)',
                'expecting': 'Expecting a child'
            };
            
            const ages = userProfile.children_ages
                .filter(age => age)
                .map(age => ageMap[age] || age);
            
            if (ages.length > 0) {
                contextParts.push(`Children Ages: ${ages.join(', ')}`);
            }
        }
    }

    // Main Wellness Concerns/Goals
    if (userProfile.main_concerns && userProfile.main_concerns.length > 0) {
        const concernsMap = {
            'food': 'Food: Nourishment and healing',
            'resilience': 'Resilience: Stress, sleep, nervous system support',
            'movement': 'Movement: Physical activity and energy',
            'community': 'Community: Relationships and support',
            'spiritual': 'Spiritual: Purpose and emotional healing',
            'environment': 'Environment: Detoxifying home',
            'abundance': 'Abundance: Financial health and resources'
        };
        
        const concerns = userProfile.main_concerns
            .filter(concern => concern && concern !== 'other')
            .map(concern => concernsMap[concern] || concern);
        
        if (concerns.length > 0) {
            contextParts.push(`\nMain Wellness Goals:`);
            concerns.forEach(concern => contextParts.push(`  - ${concern}`));
        }
        
        if (userProfile.main_concerns_other && userProfile.main_concerns_other.trim()) {
            contextParts.push(`  - Additional: ${userProfile.main_concerns_other}`);
        }
    }

    // Dietary Preferences - CRITICAL FOR PERSONALIZATION
    if (userProfile.dietary_preferences && userProfile.dietary_preferences.length > 0) {
        const prefsMap = {
            'gluten_free': 'Gluten-free',
            'dairy_free': 'Dairy-free',
            'nut_free': 'Nut-free',
            'soy_free': 'Soy-free',
            'vegetarian': 'Vegetarian',
            'vegan': 'Vegan',
            'no_preference': 'No specific dietary restrictions'
        };
        
        const prefs = userProfile.dietary_preferences
            .filter(pref => pref && pref !== 'other' && pref !== 'no_preference')
            .map(pref => prefsMap[pref] || pref);
        
        if (prefs.length > 0) {
            contextParts.push(`\n⚠️ DIETARY PREFERENCES (ALWAYS RESPECT THESE):`);
            prefs.forEach(pref => contextParts.push(`  - ${pref}`));
        }
        
        if (userProfile.dietary_preferences_other && userProfile.dietary_preferences_other.trim()) {
            contextParts.push(`  - Additional: ${userProfile.dietary_preferences_other}`);
        }
    }

    // Personalization Preference
    if (userProfile.personalized_support) {
        contextParts.push(`\nPersonalization: User wants personalized recommendations and tailored content`);
    }

    // Chatbot Memory - Learned preferences from conversations
    if (userProfile.chatbot_memory && typeof userProfile.chatbot_memory === 'object') {
        const memoryKeys = Object.keys(userProfile.chatbot_memory);
        
        if (memoryKeys.length > 0) {
            contextParts.push(`\n--- LEARNED PREFERENCES FROM CONVERSATIONS ---`);
            
            for (const [key, value] of Object.entries(userProfile.chatbot_memory)) {
                // Skip internal tracking fields
                if (key === 'last_conversation_at' || key === 'recent_topics') continue;
                
                if (value && typeof value === 'string' && value.trim()) {
                    contextParts.push(`${key}: ${value}`);
                } else if (typeof value === 'object' && value !== null) {
                    contextParts.push(`${key}: ${JSON.stringify(value)}`);
                }
            }
        }
    }

    contextParts.push("--- END USER PROFILE ---\n");

    return contextParts.join('\n');
}

/**
 * Construye instrucciones específicas basadas en el perfil del usuario
 * @param {Object} userProfile - Perfil completo del usuario
 * @returns {string} Instrucciones personalizadas para el AI
 */
function buildPersonalizationInstructions(userProfile) {
    if (!userProfile) {
        return '';
    }

    const instructions = [];
    
    instructions.push("\n==== PERSONALIZATION RULES ====");

    // Dietary restrictions - HIGHEST PRIORITY
    if (userProfile.dietary_preferences && userProfile.dietary_preferences.length > 0) {
        const validPrefs = userProfile.dietary_preferences.filter(
            pref => pref && pref !== 'other' && pref !== 'no_preference'
        );
        
        if (validPrefs.length > 0) {
            instructions.push("\n🚨 CRITICAL DIETARY RULES:");
            instructions.push(`- The user follows these dietary preferences: ${validPrefs.join(', ')}`);
            instructions.push("- ALWAYS consider these preferences when suggesting meals, recipes, or food-related advice");
            instructions.push("- If you suggest a food that conflicts with their restrictions, immediately apologize and correct yourself");
            instructions.push("- When unsure if something fits their diet, ask first or provide alternatives");
            
            if (userProfile.dietary_preferences_other) {
                instructions.push(`- Additional dietary information: ${userProfile.dietary_preferences_other}`);
            }
        }
    }

    // Focus areas based on main concerns
    if (userProfile.main_concerns && userProfile.main_concerns.length > 0) {
        const validConcerns = userProfile.main_concerns.filter(c => c && c !== 'other');
        
        if (validConcerns.length > 0) {
            instructions.push("\n🎯 FOCUS AREAS:");
            instructions.push(`- Prioritize support in these wellness pillars: ${validConcerns.join(', ')}`);
            instructions.push("- When providing advice, relate it back to their stated goals");
        }
    }

    // Children-specific guidance
    if (userProfile.children_count > 0 && userProfile.children_ages && userProfile.children_ages.length > 0) {
        instructions.push("\n👶 CHILDREN CONTEXT:");
        instructions.push(`- User has ${userProfile.children_count} child(ren) aged: ${userProfile.children_ages.join(', ')}`);
        instructions.push("- Tailor parenting advice, meal suggestions, and activities to these specific ages");
        instructions.push("- Consider age-appropriate portions, safety, and developmental stages");
    }

    // Conversation continuity
    instructions.push("\n💬 CONVERSATION RULES:");
    instructions.push("- ALWAYS maintain context from previous messages in this conversation");
    instructions.push("- If the user asks a follow-up question, refer back to the previous topic");
    instructions.push("- Never abruptly change topics unless the user explicitly asks about something new");
    instructions.push("- If you're unsure about continuing a topic, ask for clarification");
    instructions.push("- Remember details the user shares and reference them naturally in future messages");

    instructions.push("==== END PERSONALIZATION RULES ====\n");

    return instructions.join('\n');
}

module.exports = {
    buildUserContext,
    buildPersonalizationInstructions
};

