import React from 'react'
import { Link } from 'react-router-dom'

const EmailConfirmationPage = () => {
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
              onClick={() => window.location.reload()} 
              className="btn btn-outline"
            >
              Resend Email
            </button>
          </div>

          <div className="help-section">
            <h4>Need Help?</h4>
            <ul>
              <li>Check your spam/junk folder</li>
              <li>Make sure you entered the correct email address</li>
              <li>Contact us at <a href="mailto:admin@7pillarsmission.com">admin@7pillarsmission.com</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPage
