import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

const EmailConfirmationPendingPage = () => {
  const email = localStorage.getItem('pendingConfirmationEmail') || 'tu email'

  useEffect(() => {
    // Limpiar el email del localStorage después de 10 minutos
    const timer = setTimeout(() => {
      localStorage.removeItem('pendingConfirmationEmail')
    }, 10 * 60 * 1000) // 10 minutos

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="app-container">
      <div className="auth-container">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="logo-container">
              <div className="logo-icon">🧘‍♀️</div>
              <h1 className="logo-text">MOMi</h1>
            </div>
            <p className="logo-subtitle">Tu asistente personalizado de bienestar</p>
          </div>

          {/* Content */}
          <div className="confirmation-content">
            <div className="confirmation-icon">
              <div className="email-icon">
                📧
              </div>
            </div>

            <h2 className="confirmation-title">
              ¡Cuenta creada exitosamente!
            </h2>

            <div className="confirmation-message">
              <p>
                Hemos enviado un email de confirmación a:
              </p>
              <p className="email-address">
                {email}
              </p>
              
              <div className="instructions">
                <h3>Próximos pasos:</h3>
                <ol>
                  <li>Revisa tu bandeja de entrada</li>
                  <li>Busca el email de MOMi (revisa también spam/promociones)</li>
                  <li>Haz clic en el enlace de confirmación</li>
                  <li>¡Disfruta de tu experiencia personalizada con MOMi!</li>
                </ol>
              </div>

              <div className="help-section">
                <p className="help-text">
                  <strong>¿No encuentras el email?</strong>
                </p>
                <ul className="help-list">
                  <li>Verifica tu carpeta de spam o promociones</li>
                  <li>Asegúrate de que el email sea correcto</li>
                  <li>El enlace expira en 24 horas</li>
                </ul>
              </div>
            </div>

            <div className="confirmation-actions">
              <Link to="/login" className="btn btn-primary btn-large">
                Ir al Login
              </Link>
              
              <div className="secondary-actions">
                <Link to="/register" className="secondary-link">
                  ¿Email incorrecto? Crear cuenta nuevamente
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <p>
            ¿Necesitas ayuda? <a href="mailto:support@momi.com" className="support-link">Contacta soporte</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPendingPage
