import React from 'react'

const TermsPage = () => {
  return (
    <div className="terms-page">
      <div className="container">
        <div className="terms-header">
          <h1>Terms and Conditions</h1>
          <p className="terms-updated">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="terms-content">
          <div className="terms-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using MOMi (the "Service"), you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to abide by the above, please do not
              use this service.
            </p>
          </div>

          <div className="terms-section">
            <h2>2. Description of Service</h2>
            <p>
              MOMi is an AI-powered wellness assistant designed to provide support and guidance based on
              the 7 Pillars of Wellness. The Service is provided by MOMS on a Mission and is intended
              to support your wellness journey through personalized recommendations and empathetic
              conversation.
            </p>
          </div>

          <div className="terms-section">
            <h2>3. Medical Disclaimer</h2>
            <div className="medical-disclaimer">
              <p>
                <strong>IMPORTANT:</strong> MOMi is not a medical professional and does not provide
                medical advice, diagnosis, or treatment. The information provided by MOMi is for
                educational and wellness support purposes only.
              </p>
              <p>
                Always consult with qualified healthcare professionals before making any medical
                decisions or if you have concerns about your health or your family's health.
                Never disregard professional medical advice or delay seeking medical treatment
                because of information provided by MOMi.
              </p>
            </div>
          </div>

          <div className="terms-section">
            <h2>4. User Eligibility and Circle Membership</h2>
            <p>
              To use MOMi, you must be a current member of MOMS on a Mission Circle community.
              Your registration email must match your Circle membership email. We reserve the
              right to verify your membership status and revoke access if membership requirements
              are not met.
            </p>
          </div>

          <div className="terms-section">
            <h2>5. Privacy and Data Protection</h2>
            <p>
              We take your privacy seriously. Your personal information, conversations with MOMi,
              and profile data are protected and will not be shared with third parties except as
              necessary to provide the Service or as required by law.
            </p>
            <p>
              By using MOMi, you consent to the collection and use of your information as described
              in our Privacy Policy. Your conversation history is stored to provide personalized
              support and improve the Service.
            </p>
          </div>

          <div className="terms-section">
            <h2>6. Personalized Recommendations and Affiliate Content</h2>
            <p>
              If you opt-in to personalized support, MOMi may provide tailored recommendations
              including affiliate offers when relevant. These recommendations are based on your
              profile information and wellness goals. You can opt-out of personalized content
              at any time.
            </p>
          </div>

          <div className="terms-section">
            <h2>7. User Conduct</h2>
            <p>You agree to use MOMi responsibly and agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of these Terms</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Share your account credentials with others</li>
              <li>Use the Service to harass, abuse, or harm others</li>
              <li>Submit false or misleading information</li>
            </ul>
          </div>

          <div className="terms-section">
            <h2>8. Intellectual Property</h2>
            <p>
              The Service, including its content, features, and functionality, is owned by
              MOMS on a Mission and is protected by copyright, trademark, and other intellectual
              property laws. You may not reproduce, distribute, or create derivative works
              without explicit permission.
            </p>
          </div>

          <div className="terms-section">
            <h2>9. Data Deletion and Account Termination</h2>
            <p>
              You have the right to request deletion of your personal data at any time.
              To request data deletion or account termination, please contact our administrators.
              Upon termination, your access to the Service will be immediately revoked.
            </p>
          </div>

          <div className="terms-section">
            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, MOMS on a Mission and its affiliates
              shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, including but not limited to loss of profits, data, or other
              intangible losses resulting from your use of the Service.
            </p>
          </div>

          <div className="terms-section">
            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users
              of any material changes through the Service or via email. Your continued use
              of the Service after changes are posted constitutes acceptance of the new Terms.
            </p>
          </div>

          <div className="terms-section">
            <h2>12. Contact Information</h2>
            <p>
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="contact-info">
              <p>MOMS on a Mission<br />
              Website: <a href="https://7pillarsmission.com" target="_blank" rel="noopener noreferrer">
                7pillarsmission.com
              </a></p>
            </div>
          </div>
        </div>

        <div className="terms-footer">
          <a href="/" className="btn btn-outline">
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}

export default TermsPage