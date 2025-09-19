import React from 'react'

const ChatPage = ({ user, userProfile }) => {
  console.log('ChatPage rendering with:', { user: user?.email, userProfile: userProfile?.first_name });
  
  if (!user) {
    console.log('ChatPage: No user provided');
    return <div>No user found</div>;
  }
  
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '15px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{ color: '#6366f1', marginBottom: '20px' }}>🤖 MOMi Chat</h1>
        <p style={{ fontSize: '18px', marginBottom: '15px' }}>
          Hello <strong>{userProfile?.first_name || user?.email?.split('@')[0] || 'User'}</strong>!
        </p>
        <p style={{ color: '#64748b', marginBottom: '20px' }}>
          Welcome to your personalized wellness assistant.
        </p>
        <div style={{
          padding: '20px',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '2px dashed #cbd5e1'
        }}>
          <p>✅ Your profile is loaded successfully!</p>
          <p>🔧 Full chat interface coming up next...</p>
        </div>
      </div>
    </div>
  );
}

export default ChatPage
