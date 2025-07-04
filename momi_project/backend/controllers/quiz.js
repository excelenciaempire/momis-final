const conversationState = require('../utils/conversationState');

// Quiz data structure
const RESILIENT_RESET_QUIZ = {
  title: "Resilient Reset Month Quiz",
  questions: [
    {
      id: 1,
      question: "When I wake up in the morning, I usually feel:",
      options: {
        A: "Energized and ready to start my day",
        B: "A bit tired but able to get going after some time",
        C: "Exhausted and struggle to get out of bed"
      }
    },
    {
      id: 2,
      question: "When something unexpected happens during my day, I tend to:",
      options: {
        A: "Take a deep breath and adapt quickly",
        B: "Feel stressed initially but manage to cope",
        C: "Feel overwhelmed and have difficulty recovering"
      }
    },
    {
      id: 3,
      question: "My sleep quality is generally:",
      options: {
        A: "Good - I fall asleep easily and wake up refreshed",
        B: "Okay - Sometimes I have trouble but mostly manageable",
        C: "Poor - I often have trouble falling or staying asleep"
      }
    },
    {
      id: 4,
      question: "When it comes to taking breaks during the day, I:",
      options: {
        A: "Regularly take short breaks to recharge",
        B: "Try to take breaks but often forget or skip them",
        C: "Rarely take breaks and often feel burned out"
      }
    },
    {
      id: 5,
      question: "My overall stress level lately has been:",
      options: {
        A: "Low - I feel calm and in control most days",
        B: "Moderate - Some stress but I'm managing",
        C: "High - I feel constantly stressed and anxious"
      }
    }
  ],
  results: {
    green: {
      title: "Green Zone - Thriving! 🌟",
      description: "Your nervous system is in a great place! You're managing stress well and have good resilience. Keep up these healthy patterns!",
      recommendations: [
        "Continue your current self-care practices",
        "Share your strategies with others who might benefit",
        "Consider deepening your practice with advanced relaxation techniques"
      ],
      tools: [
        "Gratitude journaling to maintain positive mindset",
        "Regular mindfulness meditation",
        "Sharing wellness tips in community groups"
      ],
      cta: "Would you like some ideas to maintain your wellness momentum?"
    },
    yellow: {
      title: "Yellow Zone - Managing but Stretched 💛",
      description: "You're coping, but your nervous system could use some extra support. Small changes can make a big difference!",
      recommendations: [
        "Prioritize 5-10 minute daily relaxation breaks",
        "Practice saying 'no' to prevent overcommitment",
        "Focus on improving sleep quality"
      ],
      tools: [
        "Box breathing exercises (4-4-4-4 pattern)",
        "Evening wind-down routine checklist",
        "Weekly self-care planning template"
      ],
      cta: "Can I help you create a simple stress-relief routine?"
    },
    red: {
      title: "Red Zone - Time for a Reset ❤️",
      description: "Your nervous system is showing signs of overwhelm. This is common for busy moms! Let's work on gentle ways to restore balance.",
      recommendations: [
        "Start with just 2-3 minutes of deep breathing daily",
        "Reach out to your support network",
        "Consider professional support if needed"
      ],
      tools: [
        "Simple 3-minute breathing exercises",
        "Daily check-in journal prompts",
        "List of local support resources",
        "Gentle movement videos (5-10 minutes)"
      ],
      cta: "Would you like me to guide you through a calming exercise right now?"
    }
  }
};

/**
 * Calculate the quiz result based on answers
 * @param {Array} answers - Array of answer choices (A, B, or C)
 * @returns {string} Result key: 'green', 'yellow', or 'red'
 */
function calculateResult(answers) {
  const counts = { A: 0, B: 0, C: 0 };
  
  // Count occurrences of each answer
  answers.forEach(answer => {
    if (counts.hasOwnProperty(answer)) {
      counts[answer]++;
    }
  });
  
  // Determine result based on most frequent answer
  // If mostly A's -> green, mostly B's -> yellow, mostly C's -> red
  const maxCount = Math.max(counts.A, counts.B, counts.C);
  
  if (counts.A === maxCount) return 'green';
  if (counts.B === maxCount) return 'yellow';
  return 'red';
}

/**
 * Start the quiz for a user
 */
async function startQuiz(req, res) {
  const { userId, guestUserId } = req.body;
  
  if (!userId && !guestUserId) {
    return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
  }
  
  const userIdentifier = userId || guestUserId;
  
  try {
    // Initialize quiz state
    const quizState = {
      phase: "question",
      index: 0,
      answers: [],
      startedAt: new Date().toISOString()
    };
    
    // Update conversation state with quiz data
    conversationState.updateState(userIdentifier, { quiz: quizState });
    
    // Return first question
    const firstQuestion = RESILIENT_RESET_QUIZ.questions[0];
    
    res.json({
      success: true,
      message: "Let's start the Resilient Reset Month quiz! This will help us understand how your nervous system is doing. 💜",
      question: {
        number: 1,
        total: RESILIENT_RESET_QUIZ.questions.length,
        text: firstQuestion.question,
        options: firstQuestion.options
      },
      instruction: "Please respond with A, B, or C",
      // Format the response for the chat widget
      reply: `Let's start the Resilient Reset Month quiz! This will help us understand how your nervous system is doing. 💜\n\n**Question 1 of ${RESILIENT_RESET_QUIZ.questions.length}:**\n${firstQuestion.question}\n\nA) ${firstQuestion.options.A}\nB) ${firstQuestion.options.B}\nC) ${firstQuestion.options.C}\n\nPlease respond with A, B, or C`,
      isQuiz: true,
      quizData: {
        phase: 'question',
        questionNumber: 1,
        totalQuestions: RESILIENT_RESET_QUIZ.questions.length
      }
    });
    
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Failed to start quiz', details: error.message });
  }
}

/**
 * Process a quiz answer
 */
async function answerQuiz(req, res) {
  const { userId, guestUserId, choice } = req.body;
  
  if (!userId && !guestUserId) {
    return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
  }
  
  if (!choice || !['A', 'B', 'C'].includes(choice.toUpperCase())) {
    return res.status(400).json({ error: 'Please provide a valid choice: A, B, or C' });
  }
  
  const userIdentifier = userId || guestUserId;
  const normalizedChoice = choice.toUpperCase();
  
  try {
    // Get current state
    const state = conversationState.getState(userIdentifier);
    
    if (!state.quiz || state.quiz.phase !== 'question') {
      return res.status(400).json({ 
        error: 'No active quiz found. Type "start nervous system quiz" to begin!' 
      });
    }
    
    // Add answer to the list
    state.quiz.answers.push(normalizedChoice);
    
    // Check if quiz is complete
    if (state.quiz.answers.length >= RESILIENT_RESET_QUIZ.questions.length) {
      // Calculate result
      const resultKey = calculateResult(state.quiz.answers);
      const result = RESILIENT_RESET_QUIZ.results[resultKey];
      
      // Update state to mark quiz as complete
      state.quiz.phase = 'complete';
      state.quiz.result = resultKey;
      state.quiz.completedAt = new Date().toISOString();
      conversationState.updateState(userIdentifier, { quiz: state.quiz });
      
      // Format response with result
      const response = {
        success: true,
        quizComplete: true,
        result: {
          zone: resultKey,
          title: result.title,
          description: result.description,
          recommendations: result.recommendations,
          tools: result.tools,
          cta: result.cta
        },
        message: `Quiz complete! ${result.title}\n\n${result.description}`,
        // Format for chat widget
        reply: `Quiz complete! ${result.title}\n\n${result.description}\n\n**Recommendations:**\n${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n**Helpful Tools:**\n${result.tools.map((t, i) => `• ${t}`).join('\n')}\n\n${result.cta}`,
        isQuiz: true,
        quizData: {
          phase: 'complete',
          result: resultKey
        }
      };
      
      return res.json(response);
    }
    
    // Quiz not complete, return next question
    const nextIndex = state.quiz.answers.length;
    const nextQuestion = RESILIENT_RESET_QUIZ.questions[nextIndex];
    
    // Update quiz index
    state.quiz.index = nextIndex;
    conversationState.updateState(userIdentifier, { quiz: state.quiz });
    
    res.json({
      success: true,
      message: `Great! You answered ${normalizedChoice}.`,
      question: {
        number: nextIndex + 1,
        total: RESILIENT_RESET_QUIZ.questions.length,
        text: nextQuestion.question,
        options: nextQuestion.options
      },
      instruction: "Please respond with A, B, or C",
      // Format for chat widget
      reply: `Great! You answered ${normalizedChoice}.\n\n**Question ${nextIndex + 1} of ${RESILIENT_RESET_QUIZ.questions.length}:**\n${nextQuestion.question}\n\nA) ${nextQuestion.options.A}\nB) ${nextQuestion.options.B}\nC) ${nextQuestion.options.C}\n\nPlease respond with A, B, or C`,
      isQuiz: true,
      quizData: {
        phase: 'question',
        questionNumber: nextIndex + 1,
        totalQuestions: RESILIENT_RESET_QUIZ.questions.length
      }
    });
    
  } catch (error) {
    console.error('Error processing quiz answer:', error);
    res.status(500).json({ error: 'Failed to process quiz answer', details: error.message });
  }
}

/**
 * Get current quiz status
 */
async function getQuizStatus(req, res) {
  const { userId, guestUserId } = req.body;
  
  if (!userId && !guestUserId) {
    return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
  }
  
  const userIdentifier = userId || guestUserId;
  
  try {
    const state = conversationState.getState(userIdentifier);
    
    if (!state.quiz) {
      return res.json({ 
        hasActiveQuiz: false,
        message: 'No quiz in progress. Type "start nervous system quiz" to begin!'
      });
    }
    
    res.json({
      hasActiveQuiz: true,
      phase: state.quiz.phase,
      currentQuestion: state.quiz.index + 1,
      totalQuestions: RESILIENT_RESET_QUIZ.questions.length,
      answersGiven: state.quiz.answers.length
    });
    
  } catch (error) {
    console.error('Error getting quiz status:', error);
    res.status(500).json({ error: 'Failed to get quiz status', details: error.message });
  }
}

module.exports = {
  startQuiz,
  answerQuiz,
  getQuizStatus,
  RESILIENT_RESET_QUIZ
}; 