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
  const [currentUserProfileId, setCurrentUserProfileId] = useState(null); // ID from public.users table

  useEffect(() => {
    setLoading(true);
    supabase?.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await fetchUserProfile(session.user.id);
      } else {
        ensureGuestSession();
      }
      setLoading(false);
    });

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          await fetchUserProfile(session.user.id);
          // If user is logged in, clear guest session from local storage
          localStorage.removeItem('momiGuestSession');
          setGuestSession(null);
        } else {
          // If user logs out or no Supabase session, clear user profile ID
          setCurrentUserProfileId(null); 
          ensureGuestSession();
        }
      }
    );

    // Initial check for guest session if no Supabase session found initially
    if (!session) {
        ensureGuestSession();
    }
    // setLoading(false); // Moved up

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authUserId) => {
    if (!authUserId) {
      setCurrentUserProfileId(null);
      return;
    }
    try {
      console.log('Fetching user profile for auth_user_id:', authUserId);
      // Assuming RLS allows authenticated user to read their own profile from public.users
      const { data, error } = await supabase
        .from('users') // Your public users table
        .select('id') // Select the primary key of your public.users table
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        if (error.code === 'PGRST116' && !error.message.includes("exact")) { 
          // PGRST116: " exactamente cero filas" (zero rows) - profile not yet created
          console.warn('User profile not found in public.users for auth_user_id:', authUserId, 'Might need to be created via /api/auth/register.');
          // This can happen if signup process didn't complete or sync failed.
          // We don't set error here, as signup flow might create it.
          setCurrentUserProfileId(null);
        } else {
           throw error; // Rethrow other errors
        }
      } else if (data) {
        console.log('Fetched user profile ID from public.users:', data.id);
        setCurrentUserProfileId(data.id);
      } else {
        console.warn('No data returned for user profile, but no error. auth_user_id:', authUserId);
        setCurrentUserProfileId(null);
      }
    } catch (err) {
      console.error('Failed to fetch user profile from public.users:', err);
      setCurrentUserProfileId(null);
      // Optionally, set an error state to show to the user
    }
  };

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
      const response = await axios.post('/api/guest/session'); 
      // Ensure the response is valid JSON and has the expected properties
      if (response.data && response.data.guestUserId && response.data.sessionToken) {
        localStorage.setItem('momiGuestSession', JSON.stringify(response.data));
        setGuestSession(response.data);
        console.log('Created new guest session:', response.data);
      } else {
        // This case means we didn't get the expected JSON structure.
        // The SyntaxError might have already been thrown by axios if Content-Type was wrong.
        console.error('Failed to create guest session: Invalid response data from /api/guest/session', response.data);
        // Ensure guestSession is not set with bad data
        setGuestSession(null);
        localStorage.removeItem('momiGuestSession');
      }
    } catch (error) {
      console.error('Failed to create guest session (axios error):', error);
      // If error.response contains data, it might be the HTML.
      if (error.response && error.response.data) {
        console.error('Error response data:', error.response.data.substring(0, 200) + '...'); // Log a snippet
      }
      setGuestSession(null); // Ensure guestSession is null on error
      localStorage.removeItem('momiGuestSession');
    }
  };

  // Basic login/logout for testing Supabase Auth
  const handleLogin = async () => {
    if (!supabase) return;
    const email = prompt("Enter your email:");
    const password = prompt("Enter your password:");
    if (!email || !password) return;
    try {
      const { error, data: loginData } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Session change will trigger fetchUserProfile via onAuthStateChange
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
        console.log('Attempting to register user profile with auth_user_id:', signUpData.user.id);
        const response = await axios.post('/api/auth/register', {
          auth_user_id: signUpData.user.id,
          email: signUpData.user.email,
        });
        console.log('Profile registration response:', response.data);
        // After successful registration, fetch the profile to get the public.users.id
        // The onAuthStateChange listener should also trigger this, but explicit call ensures it.
        if (response.data && response.data.user && response.data.user.id) {
          console.log('Setting current user profile ID from register response:', response.data.user.id);
          setCurrentUserProfileId(response.data.user.id); 
        } else {
           // Fallback to fetching if register endpoint doesn't return the ID directly in response.data.user.id
           await fetchUserProfile(signUpData.user.id);
        }
        alert('Signed up! Please check your email for verification if enabled.');
      } else {
        alert('Signup successful, but no user data returned from Supabase to sync.')
      }
      
    } catch (error) {
      console.error("Signup or profile sync error:", error.response ? error.response.data : error);
      alert(error.error_description || error.message || 'Signup failed.');
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
      <button className="chat-toggle-button" onClick={toggleChatOpen} aria-label={isChatOpen ? 'Close chat' : 'Open chat with MOMi'}>
        {isChatOpen ? 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> 
          : 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        }
      </button>
      {isChatOpen && (
        <div className="chat-window-wrapper">
          <ChatWindow 
            conversationId={conversationId}
            setConversationId={setConversationId}
            userId={currentUserProfileId}
            guestUserId={guestSession?.guestUserId}
            sessionToken={guestSession?.sessionToken}
            toggleChatOpen={toggleChatOpen}
          />
        </div>
      )}
    </div>
  );
}

export default App;
