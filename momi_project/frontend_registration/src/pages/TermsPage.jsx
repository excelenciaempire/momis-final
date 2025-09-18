import React from 'react'
import { Link } from 'react-router-dom'

const TermsPage = () => {
  return (
    <div className="terms-page">
      <div className="container">
        <div className="terms-header">
          <img
            src="/momi-icon-2.png"
            alt="MOMS on a Mission Logo"
            className="terms-logo"
          />
          <h1>Terms of Service & Privacy Policy</h1>
          <p className="terms-subtitle">MOMi AI Chatbot</p>
        </div>

        <div className="terms-content">
          <div className="terms-section">
            <h2>Terms of Service</h2>
            <p className="effective-date"><strong>Effective Date:</strong> September 8, 2025</p>
            <p className="contact-info"><strong>Contact Email:</strong> admin@7pillarsmission.com</p>

            <div className="term-item">
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing or using MOMi (the Moms on a Mission Intelligent Assistant), you agree to these Terms of Service. If you do not agree, please discontinue use of MOMi immediately.</p>
            </div>

            <div className="term-item">
              <h3>2. Purpose of MOMi</h3>
              <p>MOMi is an AI-powered health and wellness coach designed to provide general educational content, encouragement, and lifestyle support for moms and families. MOMi does not provide medical advice, diagnosis, or treatment. MOMi is not a substitute for professional medical care. Always consult with a licensed healthcare provider for medical concerns.</p>
            </div>

            <div className="term-item">
              <h3>3. User Eligibility</h3>
              <p>You must be at least 18 years old to use MOMi. By using MOMi, you represent that you are legally able to enter into these Terms.</p>
            </div>

            <div className="term-item">
              <h3>4. Privacy and Data</h3>
              <p>MOMi may collect information you provide during conversations to personalize your experience. We respect your privacy and do not sell personal information. For details, please see our Privacy Policy below.</p>
              <ul>
                <li>MOMi is not HIPAA-compliant and should not be used to store or transmit protected health information (PHI).</li>
                <li>Do not share sensitive personal information such as social security numbers, financial data, or medical record numbers.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>5. Community Guidelines</h3>
              <p>When using MOMi and participating in the MOMS on a Mission community:</p>
              <ul>
                <li>Engage with kindness, respect, and authenticity.</li>
                <li>Do not use MOMi for unlawful, harmful, or abusive purposes.</li>
                <li>Do not attempt to misuse, copy, or reverse-engineer the MOMi platform.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>6. Disclaimer of Warranties</h3>
              <p>MOMi is provided "as is" and "as available." We do not guarantee uninterrupted access, accuracy, or reliability of responses. MOMi's information should be considered supportive guidance, not professional advice.</p>
            </div>

            <div className="term-item">
              <h3>7. Limitation of Liability</h3>
              <p>To the fullest extent permitted by law:</p>
              <ul>
                <li>MOMS on a Mission, its team members, and affiliates are not liable for any damages resulting from the use or inability to use MOMi.</li>
                <li>You agree that any reliance on MOMi's content is at your own risk.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>8. Modifications</h3>
              <p>We may update these Terms of Service at any time. Updated terms will be posted here with a revised effective date. Your continued use of MOMi after changes indicates acceptance.</p>
            </div>

            <div className="term-item">
              <h3>9. Termination</h3>
              <p>We reserve the right to suspend or terminate access to MOMi at our discretion, without notice, if you violate these Terms or misuse the service.</p>
            </div>

            <div className="term-item">
              <h3>10. Governing Law</h3>
              <p>These Terms are governed by the laws of the State of North Carolina, without regard to conflict of law principles.</p>
            </div>

            <div className="contact-section">
              <h3>Questions?</h3>
              <p>Please contact us at <a href="mailto:admin@7pillarsmission.com">admin@7pillarsmission.com</a>.</p>
            </div>
          </div>

          <div className="terms-section">
            <h2>Privacy Policy</h2>
            <p className="effective-date"><strong>Effective Date:</strong> September 8, 2025</p>
            <p className="contact-info"><strong>Contact Email:</strong> admin@7pillarsmission.com</p>
            <p>MOMi (Moms on a Mission Intelligent Assistant) is committed to respecting your privacy and protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your information when you use MOMi.</p>

            <div className="term-item">
              <h3>1. Purpose of Data Collection</h3>
              <p>Your information is used to customize your MOMi experience and improve the platform. This includes tailoring content, recommendations, and resources based on your preferences and goals.</p>
            </div>

            <div className="term-item">
              <h3>2. How Your Data Is Used</h3>
              <p>Your information may be used:</p>
              <ul>
                <li>By MOMS on a Mission team members to improve MOMi's accuracy, outputs, and overall community experience.</li>
                <li>By vetted, contracted employees to enhance technology, tools, and features.</li>
                <li>For aggregated, anonymized insights that help us refine our offerings.</li>
              </ul>
              <p><strong>We never sell or share your personal information for marketing or profit outside of these purposes.</strong></p>
            </div>

            <div className="term-item">
              <h3>3. Data Storage & Security</h3>
              <ul>
                <li>Information is stored on secure, encrypted servers.</li>
                <li>Access is restricted to authorized personnel and contractors under confidentiality agreements.</li>
                <li>We conduct annual security audits and additional reviews as needed to ensure compliance and protection.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>4. Retention Policy</h3>
              <ul>
                <li>Your data is retained while your account is active.</li>
                <li>Data is deleted or anonymized within 6 months of account closure or prolonged inactivity.</li>
                <li>Aggregated, anonymized data may be retained indefinitely to help improve MOMi.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>5. Your Rights</h3>
              <p>You have the right to:</p>
              <ul>
                <li>Request a copy of your data by emailing admin@7pillarsmission.com.</li>
                <li>Request deletion of your data at any time by emailing admin@7pillarsmission.com.</li>
              </ul>
            </div>

            <div className="term-item">
              <h3>6. Voluntary Participation</h3>
              <p>Participation in MOMi is voluntary. You may withdraw at any time without penalty. If you choose to withdraw, your personal data will be deleted or anonymized in accordance with our retention policy.</p>
            </div>

            <div className="term-item">
              <h3>7. Limitations of AI Guidance</h3>
              <p>MOMi provides educational and coaching support only. MOMi is not a medical provider and does not offer medical advice, diagnosis, or treatment. Always consult a licensed healthcare professional for any medical concerns.</p>
            </div>

            <div className="term-item">
              <h3>8. Consent</h3>
              <p>By using MOMi, you acknowledge and consent to the collection and use of your data as described in this Privacy Policy.</p>
            </div>

            <div className="contact-section">
              <h3>Questions?</h3>
              <p>For privacy-related questions, please contact: <a href="mailto:admin@7pillarsmission.com">admin@7pillarsmission.com</a></p>
            </div>
          </div>
        </div>

        <div className="terms-footer">
          <Link to="/" className="btn btn-primary">
            Back to MOMi
          </Link>
        </div>
      </div>
    </div>
  )
}

export default TermsPage