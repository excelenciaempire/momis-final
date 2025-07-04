/**
 * @module conversationState
 * @description Módulo para gestionar el estado temporal de las conversaciones en memoria
 */

// Map para almacenar los estados de conversación por userId
const sessions = new Map();

/**
 * Obtiene el estado de conversación para un usuario específico
 * @param {string} userId - ID del usuario (puede ser user_id o guest_user_id)
 * @returns {Object} Estado de la conversación con valores por defecto si no existe
 * @property {boolean} is_first_message - Indica si es el primer mensaje de la sesión
 * @property {string} user_status - Estado del usuario: "first_time", "second_time" o "returning"
 * @property {Array<string>} greetings_shown - Lista de saludos ya mostrados en la sesión
 * @property {string|null} previous_greeting - Último saludo mostrado
 * @property {string|null} last_context - Último contexto de conversación
 */
function getState(userId) {
  if (!userId) {
    throw new Error('userId is required to get conversation state');
  }

  // Si no existe el estado, crear uno nuevo con valores por defecto
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      is_first_message: true,
      user_status: "first_time",
      greetings_shown: [],
      previous_greeting: null,
      last_context: null
    });
  }

  return sessions.get(userId);
}

/**
 * Actualiza parcialmente el estado de conversación para un usuario
 * @param {string} userId - ID del usuario (puede ser user_id o guest_user_id)
 * @param {Object} partialState - Objeto con las propiedades a actualizar
 * @returns {Object} Estado actualizado completo
 * @throws {Error} Si userId no es proporcionado
 */
function updateState(userId, partialState) {
  if (!userId) {
    throw new Error('userId is required to update conversation state');
  }

  if (!partialState || typeof partialState !== 'object') {
    throw new Error('partialState must be an object');
  }

  // Obtener el estado actual (crea uno nuevo si no existe)
  const currentState = getState(userId);
  
  // Actualizar con los nuevos valores
  const updatedState = Object.assign(currentState, partialState);
  
  // Guardar el estado actualizado
  sessions.set(userId, updatedState);
  
  return updatedState;
}

/**
 * Reinicia o elimina el estado de conversación para un usuario
 * @param {string} userId - ID del usuario (puede ser user_id o guest_user_id)
 * @returns {boolean} true si se eliminó exitosamente, false si no existía
 * @throws {Error} Si userId no es proporcionado
 */
function resetState(userId) {
  if (!userId) {
    throw new Error('userId is required to reset conversation state');
  }

  // Eliminar el estado del Map
  return sessions.delete(userId);
}

// Opcional: Función auxiliar para limpiar estados antiguos (puede ser útil para evitar memory leaks)
/**
 * Limpia todos los estados de conversación en memoria
 * @returns {void}
 */
function clearAllStates() {
  sessions.clear();
}

// Opcional: Función para obtener el tamaño actual del Map (útil para debugging)
/**
 * Obtiene el número de sesiones activas en memoria
 * @returns {number} Número de sesiones almacenadas
 */
function getActiveSessionsCount() {
  return sessions.size;
}

module.exports = {
  getState,
  updateState,
  resetState,
  // Exportar también las funciones opcionales por si son útiles
  clearAllStates,
  getActiveSessionsCount
}; 