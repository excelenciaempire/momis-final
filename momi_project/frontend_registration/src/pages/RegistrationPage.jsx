import React from 'react'
import RegistrationForm from '../components/RegistrationForm'

const RegistrationPage = ({ onRegistrationSuccess }) => {
  return (
    <div className="registration-page">
      <div className="container">
        <div className="registration-container">
          <div className="registration-header">
            <img
              src="/momi-icon-2.png"
              alt="MOMi Logo"
              className="registration-logo"
            />
            <h1>Join the MOMi Community</h1>
            <p className="registration-subtitle">
              Get personalized wellness support based on the 7 Pillars of Wellness.
              Create your account to start your journey with MOMi, your AI-powered wellness assistant.
            </p>
          </div>

          <div className="registration-form-container">
            <RegistrationForm onSuccess={onRegistrationSuccess} />
          </div>

          <div className="registration-login-link">
            <p>
              Already have an account?{' '}
              <a href="/login" className="login-link">
                Sign in here
              </a>
            </p>
          </div>

          <div className="registration-trust-indicators">
            <div className="trust-item">
              <span className="trust-icon">🔒</span>
              <span>Your data is secure and private</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon">🤝</span>
              <span>MOMS on a Mission community</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon">💜</span>
              <span>Empathetic AI support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegistrationPage