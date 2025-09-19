import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

const EmailConfirmationPendingPage = () => {
  const email = localStorage.getItem('pendingConfirmationEmail') || 'your email'

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.removeItem('pendingConfirmationEmail')
    }, 10 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#913D9A', marginBottom: '16px' }}>Check Your Email!</h1>
        
        <p style={{ marginBottom: '24px' }}>
          We sent a confirmation email to: <strong>{email}</strong>
        </p>
        
        <div style={{ marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3 style={{ color: '#913D9A', marginBottom: '12px' }}>Next Steps:</h3>
          <ol style={{ textAlign: 'left', paddingLeft: '20px' }}>
            <li>Check your inbox</li>
            <li>Look for an email from MOMi</li>
            <li>Click the confirmation link</li>
            <li>Start your wellness journey!</li>
          </ol>
        </div>
        
        <Link to="/login" className="btn btn-primary btn-large">
          Go to Login
        </Link>
        
        <div style={{ marginTop: '16px' }}>
          <Link to="/register" style={{ color: '#913D9A', textDecoration: 'none' }}>
            Wrong email? Create account again
          </Link>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPendingPage