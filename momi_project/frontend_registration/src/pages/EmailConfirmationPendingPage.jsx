import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

const EmailConfirmationPendingPage = () => {
  const email = localStorage.getItem('pendingConfirmationEmail') || 'your email'

  useEffect(() => {
    // Clear email from localStorage after 10 minutes
    const timer = setTimeout(() => {
      localStorage.removeItem('pendingConfirmationEmail')
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="app-container">
      <div className="auth-container">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="logo-container">
              <div className="logo-icon">🤖</div>
              <h1 className="logo-text">MOMi</h1>
            </div>
            <p className="logo-subtitle">Your personalized wellness assistant</p>
          </div>

          {/* Content */}
          <div className="confirmation-content">
            <div className="confirmation-icon">
              <div className="email-icon" style={{
                fontSize: '48px',
                background: 'linear-gradient(135deg, var(--purple-primary), var(--magenta-vibrant))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '16px'
              }}>
                📧
              </div>
            </div>

            <h2 className="confirmation-title" style={{
              color: 'var(--purple-primary)',
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              Check Your Email!
            </h2>

            <div className="confirmation-message" style={{
              textAlign: 'center',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              <p style={{
                color: 'var(--gray-dark)',
                fontSize: '16px',
                marginBottom: '8px'
              }}>
                We've sent a confirmation email to:
              </p>
              <p className="email-address" style={{
                color: 'var(--purple-primary)',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '24px',
                padding: '12px',
                background: 'var(--white-soft)',
                borderRadius: '8px',
                border: '1px solid var(--purple-light)'
              }}>
                {email}
              </p>
              
              <div className="instructions" style={{
                background: '#f8fafc',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <h3 style={{
                  color: 'var(--purple-primary)',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>Next Steps:</h3>
                <ol style={{
                  color: 'var(--gray-dark)',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  paddingLeft: '20px'
                }}>
                  <li>Check your inbox</li>
                  <li>Look for an email from MOMi (check spam/promotions too)</li>
                  <li>Click the confirmation link</li>
                  <li>Start your personalized wellness journey!</li>
                </ol>
              </div>

              <div className="help-section" style={{
                fontSize: '14px',
                color: 'var(--gray-light)',
                marginBottom: '24px'
              }}>
                <p>
                  <strong>Can't find the email?</strong> Check your spam folder or try creating your account again.
                </p>
              </div>
            </div>

            <div className="confirmation-actions">
              <Link to="/login" className="btn btn-primary btn-large" style={{
                marginBottom: '16px'
              }}>
                Go to Login
              </Link>
              
              <div className="secondary-actions">
                <Link to="/register" className="secondary-link" style={{
                  color: 'var(--purple-primary)',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}>
                  Wrong email? Create account again
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <p style={{ fontSize: '12px', color: 'var(--gray-light)' }}>
            Need help? <a href="mailto:support@momi.com" className="support-link" style={{
              color: 'var(--purple-primary)',
              textDecoration: 'none'
            }}>Contact support</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPendingPage
