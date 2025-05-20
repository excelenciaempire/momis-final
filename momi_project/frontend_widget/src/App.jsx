import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import './App.css';

function App() {
  const [session, setSession] = useState(null); // For Supabase Auth session
  const [guestSession, setGuestSession] = useState(null); // For our custom guest session
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Attempt to get Supabase Auth session
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          // If user logs out or no Supabase session, try to get/create guest session
          ensureGuestSession();
        } else {
          // If user is logged in, clear guest session from local storage
          localStorage.removeItem('momiGuestSession');
          setGuestSession(null);
        }
      }
    );

    // Load existing guest session from local storage or create a new one
    ensureGuestSession();
    setLoading(false);

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const ensureGuestSession = async () => {
    if (session) return; // Don't create guest session if Supabase session exists

    let storedGuestSession = localStorage.getItem('momiGuestSession');
    if (storedGuestSession) {
      try {
        storedGuestSession = JSON.parse(storedGuestSession);
        // Optionally: add a check to see if this session is still valid on the backend
        setGuestSession(storedGuestSession);
        console.log('Using stored guest session:', storedGuestSession);
        return;
      } catch (e) {
        localStorage.removeItem('momiGuestSession'); // Clear invalid session
      }
    }

    console.log('No active guest session, creating new one...');
    try {
      const response = await axios.post('/api/guest/session'); // Assuming backend is on same host or proxied
      localStorage.setItem('momiGuestSession', JSON.stringify(response.data));
      setGuestSession(response.data);
      console.log('Created new guest session:', response.data);
    } catch (error) {
      console.error('Failed to create guest session:', error);
      // Handle error appropriately, maybe show a message to the user
    }
  };

  // Basic login/logout for testing Supabase Auth
  const handleLogin = async () => {
    if (!supabase) return;
    const email = prompt("Enter your email:");
    const password = prompt("Enter your password:");
    if (!email || !password) return;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      alert('Logged in!');
    } catch (error) {
      alert(error.error_description || error.message);
    }
  };

  const handleSignup = async () => {
    if (!supabase) return;
    const email = prompt("Enter your email:");
    const password = prompt("Enter your password:");
    if (!email || !password) return;
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (signUpData.user && signUpData.user.id) {
        // Sync with our public.users table
        await axios.post('/api/auth/register', {
          auth_user_id: signUpData.user.id,
          email: signUpData.user.email,
          // password field is not sent here, it's handled by Supabase Auth
        });
        alert('Signed up! Please check your email for verification if enabled.');
      } else {
        alert('Signup successful, but no user data returned from Supabase to sync.')
      }
      
    } catch (error) {
      alert(error.error_description || error.message);
    }
  };


  const handleLogout = async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      alert('Logged out!');
    } catch (error) {
      alert(error.error_description || error.message);
    }
  };

  const toggleChatOpen = () => {
    setIsChatOpen(!isChatOpen);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={`chat-widget-container ${isChatOpen ? 'open' : 'closed'}`}>
      <button className="chat-toggle-button" onClick={toggleChatOpen}>
        {isChatOpen ? 'Close MOMi' : 'Chat with MOMi'}
      </button>
      {isChatOpen && (
        <div className="chat-window-wrapper">
          <ChatWindow 
            conversationId={conversationId}
            setConversationId={setConversationId}
            userId={user?.id}
            guestUserId={guestSession?.guestUserId}
          />
          <div className="chat-disclaimer">
            <p>MOMi is an AI assistant and does not provide professional medical advice. Information shared is for general well-being and support purposes only.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
