import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import toast from 'react-hot-toast'

const EmailConfirmationPage = () => {
  const [isResending, setIsResending] = useState(false)
  const [showSkipOption, setShowSkipOption] = useState(false)
  
  const handleResendEmail = async () => {
    setIsResending(true)
    
    try {
      // Get email from localStorage or prompt user
      const email = localStorage.getItem('pendingConfirmationEmail') || 
                   prompt('Please enter your email address to resend the confirmation:')
      
      if (!email) {
        toast.error('Email address is required to resend confirmation.')
        setIsResending(false)
        return
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (error) {
        console.error('Resend error:', error)
        if (error.message.includes('Email rate limit exceeded')) {
          toast.error('Please wait a moment before requesting another email.')
        } else if (error.message.includes('User already registered')) {
          toast.error('This email is already confirmed. Try logging in instead.')
        } else {
          toast.error('Failed to resend email. Please try again later.')
        }
      } else {
        toast.success('Confirmation email has been resent! Check your inbox.')
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    }
    
    setIsResending(false)
  }

  const handleSkipVerification = async () => {
    try {
      const email = localStorage.getItem('pendingConfirmationEmail')
      if (!email) {
        toast.error('No pending registration found.')
        return
      }

      // For development/testing purposes - attempt to sign in directly
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: prompt('Please enter your password to continue without email verification:')
      })

      if (error) {
        toast.error('Unable to sign in. Please verify your email first.')
        return
      }

      toast.success('Signed in successfully!')
      localStorage.removeItem('pendingConfirmationEmail')
      window.location.href = '/chat'
    } catch (error) {
      console.error('Skip verification error:', error)
      toast.error('Unable to skip verification. Please verify your email.')
    }
  }
  return (
    <div className="email-confirmation-page">
      <div className="confirmation-container">
        <div className="confirmation-card">
          <img
            src="/momi-icon-2.png"
            alt="MOMS on a Mission Logo"
            className="confirmation-logo"
          />
          
          <div className="success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22,4 12,14.01 9,11.01"></polyline>
            </svg>
          </div>

          <h1 className="confirmation-title">Check Your Email!</h1>
          <p className="confirmation-subtitle">
            We've sent you a confirmation email to complete your MOMi registration.
          </p>

          <div className="confirmation-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Check Your Inbox</h3>
                <p>Look for an email from MOMi with the subject "Confirm your MOMi account"</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Click the Confirmation Link</h3>
                <p>Click the "Confirm Email" button in the email to activate your account</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Start Your Wellness Journey</h3>
                <p>Once confirmed, you can log in and start chatting with MOMi!</p>
              </div>
            </div>
          </div>

          <div className="confirmation-actions">
            <Link to="/login" className="btn btn-primary">
              Go to Login
            </Link>
            <button 
              onClick={handleResendEmail}
              disabled={isResending}
              className="btn btn-outline"
            >
              {isResending ? 'Sending...' : 'Resend Email'}
            </button>
          </div>

          {/* Development/Testing option */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button 
              onClick={() => setShowSkipOption(!showSkipOption)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#666', 
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Having trouble with email? Click here
            </button>
            
            {showSkipOption && (
              <div style={{ 
                marginTop: '15px', 
                padding: '15px', 
                border: '1px solid #ddd', 
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
              }}>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                  If you're having persistent email delivery issues, you can try to access your account directly:
                </p>
                <button 
                  onClick={handleSkipVerification}
                  className="btn btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  Try Direct Login
                </button>
              </div>
            )}
          </div>

          <div className="help-section">
            <h4>Not receiving the email?</h4>
            <ul>
              <li><strong>Check your spam/junk folder</strong> - Sometimes confirmation emails end up there</li>
              <li><strong>Wait a few minutes</strong> - Email delivery can take up to 10 minutes</li>
              <li><strong>Check the email address</strong> - Make sure you entered it correctly during registration</li>
              <li><strong>Try a different email provider</strong> - Some providers block automated emails</li>
              <li><strong>Whitelist our domain</strong> - Add our sending domain to your email whitelist</li>
              <li><strong>Contact support</strong> - Email us at <a href="mailto:admin@7pillarsmission.com">admin@7pillarsmission.com</a></li>
            </ul>
            
            <div className="email-tips">
              <p><strong>Common email providers that work well:</strong></p>
              <p>Gmail, Outlook, Yahoo Mail, ProtonMail</p>
              
              <p><strong>If you're using a work email:</strong></p>
              <p>Your IT department might be blocking external emails. Try using a personal email address instead.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPage
