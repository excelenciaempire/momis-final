import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../utils/supabaseClient'

const LoginPage = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const onSubmit = async (data) => {
    setIsLoading(true)

    try {
      // Sign in with Supabase Auth with timeout
      const authPromise = supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timeout')), 15000)
      )

      const { data: authData, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise
      ])

      if (authError) {
        console.error('Login error:', authError)
        if (authError.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please check your credentials.')
        } else if (authError.message.includes('Email not confirmed')) {
          toast.error('Please check your email and click the confirmation link before logging in.')
        } else {
          toast.error(authError.message || 'Failed to log in')
        }
        return
      }

      if (!authData?.user) {
        toast.error('Login failed. Please try again.')
        return
      }

      // Get user profile with timeout
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()

      const profileTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )

      const { data: profile, error: profileError } = await Promise.race([
        profilePromise,
        profileTimeoutPromise
      ])

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError)
        
        // Try to continue with basic auth data if profile fetch fails
        if (authData.user) {
          toast.success('Welcome back! Loading your profile...')
          if (onLoginSuccess) {
            onLoginSuccess(authData.user, null)
          }
          // Force immediate redirect even without profile
          navigate('/chat', { replace: true })
          return
        }
        
        toast.error('Unable to load user profile. Please try again.')
        await supabase.auth.signOut()
        return
      }

      toast.success(`Welcome back, ${profile.first_name}!`)

      // Call success callback and redirect immediately
      if (onLoginSuccess) {
        onLoginSuccess(authData.user, profile)
      }

      // Force immediate redirect to chat
      navigate('/chat', { replace: true })

    } catch (error) {
      console.error('Unexpected login error:', error)
      if (error.message === 'Login timeout' || error.message === 'Profile fetch timeout') {
        toast.error('Login is taking longer than expected. Please check your connection and try again.')
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const email = document.getElementById('email').value

    if (!email) {
      toast.error('Please enter your email address first.')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        console.error('Password reset error:', error)
        toast.error('Failed to send password reset email.')
      } else {
        toast.success('Password reset email sent! Check your inbox.')
      }
    } catch (error) {
      console.error('Unexpected password reset error:', error)
      toast.error('An unexpected error occurred.')
    }
  }

  return (
    <div className="login-page">
      <div className="container">
        <div className="login-container">
          <div className="login-header">
            <img
              src="/momi-icon-2.png"
              alt="MOMi Logo"
              className="login-logo"
            />
            <h1>Welcome Back to MOMi</h1>
            <p className="login-subtitle">
              Your AI-powered wellness assistant is ready to continue supporting your journey.
            </p>
          </div>

          <div className="login-form-container">
            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label required">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Please enter a valid email address'
                    }
                  })}
                  placeholder="Enter your email address"
                  autoComplete="email"
                />
                {errors.email && (
                  <span className="form-error">{errors.email.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label required">
                  Password
                </label>
                <div className="password-input-container">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    {...register('password', {
                      required: 'Password is required'
                    })}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && (
                  <span className="form-error">{errors.password.message}</span>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary btn-large btn-full"
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Signing In...
                    </>
                  ) : (
                    'Sign In to MOMi'
                  )}
                </button>
              </div>

              <div className="form-footer">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="forgot-password-link"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          </div>

          <div className="login-register-link">
            <p>
              Don't have an account?{' '}
              <a href="/register" className="register-link">
                Join MOMi today
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage