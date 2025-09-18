import React from 'react'

const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <img
              src="/momi-icon-2.png"
              alt="MOMi Logo"
              className="hero-logo"
            />
            <h1 className="hero-title">
              Meet MOMi
              <span className="hero-subtitle">Your AI-Powered Wellness Assistant</span>
            </h1>
            <p className="hero-description">
              Get personalized support based on the 7 Pillars of Wellness. Join the MOMS on a Mission
              community and start your journey toward better health and wellbeing.
            </p>
            <div className="hero-actions">
              <a href="/register" className="btn btn-primary btn-large">
                Start Your Journey
              </a>
              <a href="/login" className="btn btn-outline btn-large">
                Sign In
              </a>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="features-section">
          <h2>How MOMi Supports You</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🍎</div>
              <h3>Nourishment & Healing</h3>
              <p>Get personalized food and nutrition guidance tailored to your family's needs and preferences.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🧘‍♀️</div>
              <h3>Stress & Sleep Support</h3>
              <p>Learn resilience techniques and nervous system support for better stress management and sleep.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💃</div>
              <h3>Movement & Energy</h3>
              <p>Discover physical activities that work for your lifestyle and boost your energy levels.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Community & Support</h3>
              <p>Connect with relationships and community resources that strengthen your support network.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✨</div>
              <h3>Purpose & Healing</h3>
              <p>Explore spiritual wellness and emotional healing practices for inner peace and purpose.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏠</div>
              <h3>Healthy Environment</h3>
              <p>Learn about detoxifying your home and creating a healthier living environment for your family.</p>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="trust-section">
          <h2>Why Choose MOMi?</h2>
          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-icon">🔒</div>
              <h4>Secure & Private</h4>
              <p>Your personal information and conversations are protected with enterprise-grade security.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">💜</div>
              <h4>Empathetic AI</h4>
              <p>MOMi understands the unique challenges of motherhood and responds with genuine empathy.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🎯</div>
              <h4>Personalized</h4>
              <p>Get recommendations tailored to your family role, children's ages, and wellness goals.</p>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🌟</div>
              <h4>Expert-Backed</h4>
              <p>Built on the proven 7 Pillars of Wellness framework trusted by the MOMS on a Mission community.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <div className="cta-content">
            <h2>Ready to Start Your Wellness Journey?</h2>
            <p>
              Join thousands of moms who are already using MOMi to improve their health,
              reduce stress, and create happier families.
            </p>
            <div className="cta-actions">
              <a href="/register" className="btn btn-primary btn-large">
                Create Your Free Account
              </a>
            </div>
            <p className="cta-note">
              Already have an account? <a href="/login">Sign in here</a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <div className="footer-content">
            <div className="footer-links">
              <a href="/terms">Terms & Conditions</a>
              <span>•</span>
              <a href="https://7pillarsmission.com" target="_blank" rel="noopener noreferrer">
                MOMS on a Mission
              </a>
            </div>
            <p className="footer-disclaimer">
              <strong>Medical Disclaimer:</strong> MOMi is an AI assistant and does not provide medical advice.
              Always consult with healthcare professionals for medical concerns.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage