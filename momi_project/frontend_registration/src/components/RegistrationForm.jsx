import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { supabase } from '../utils/supabaseClient'

const RegistrationForm = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [showOtherConcern, setShowOtherConcern] = useState(false)
  const [showOtherDietary, setShowOtherDietary] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    getValues
  } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      familyRoles: [],
      childrenCount: '0',
      childrenAges: [],
      mainConcerns: [],
      mainConcernsOther: '',
      dietaryPreferences: [],
      dietaryPreferencesOther: '',
      personalizedSupport: false,
      agreeToTerms: false
    }
  })

  // Watch for changes to show/hide "Other" fields
  const watchedConcerns = watch('mainConcerns')
  const watchedDietary = watch('dietaryPreferences')

  React.useEffect(() => {
    setShowOtherConcern(watchedConcerns?.includes('other'))
  }, [watchedConcerns])

  React.useEffect(() => {
    setShowOtherDietary(watchedDietary?.includes('other'))
  }, [watchedDietary])

  // Family role options
  const familyRoleOptions = [
    { value: 'hoping_to_become_mother', label: 'Hoping to become a mother one day' },
    { value: 'currently_pregnant', label: 'Currently pregnant' },
    { value: 'mom_young_children', label: 'Mom of young children (0–5)' },
    { value: 'mom_school_age', label: 'Mom of school-age children (6–12)' },
    { value: 'mom_teens', label: 'Mom of teens (13–18)' },
    { value: 'wise_woman', label: 'Wise Woman (Grandparent, Aunt, etc) helping raise children' }
  ]

  // Children age options
  const childrenAgeOptions = [
    { value: '0-2', label: '0–2 (Infant/Toddler)' },
    { value: '3-5', label: '3–5 (Preschool)' },
    { value: '6-12', label: '6–12 (School-age)' },
    { value: '13-18', label: '13–18 (Teen)' },
    { value: '18+', label: '18+ (Young Adult)' },
    { value: 'expecting', label: 'Expecting a child' }
  ]

  // Main concerns options
  const mainConcernOptions = [
    { value: 'food', label: 'Food: Nourishment and healing' },
    { value: 'resilience', label: 'Resilience: Stress, sleep, nervous system support' },
    { value: 'movement', label: 'Movement: Physical activity and energy' },
    { value: 'community', label: 'Community: Relationships and support' },
    { value: 'spiritual', label: 'Spiritual: Purpose and emotional healing' },
    { value: 'environment', label: 'Environment: Detoxifying your home' },
    { value: 'abundance', label: 'Abundance: Financial health and resources' },
    { value: 'other', label: 'Other' }
  ]

  // Dietary preference options
  const dietaryOptions = [
    { value: 'gluten_free', label: 'Gluten-free' },
    { value: 'dairy_free', label: 'Dairy-free' },
    { value: 'nut_free', label: 'Nut-free' },
    { value: 'soy_free', label: 'Soy-free' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'no_preference', label: 'No specific preference' },
    { value: 'other', label: 'Other' }
  ]

  // Handle checkbox arrays
  const handleCheckboxChange = (fieldName, value, checked) => {
    const currentValues = getValues(fieldName) || []
    if (checked) {
      setValue(fieldName, [...currentValues, value])
    } else {
      setValue(fieldName, currentValues.filter(v => v !== value))
    }
  }

  const onSubmit = async (data) => {
    setIsLoading(true)

    try {
      // Validate passwords match
      if (data.password !== data.confirmPassword) {
        toast.error('Passwords do not match')
        setIsLoading(false)
        return
      }

      // Validate required fields
      if (!data.agreeToTerms) {
        toast.error('You must agree to the Terms and Conditions')
        setIsLoading(false)
        return
      }

      if (data.familyRoles.length === 0) {
        toast.error('Please select at least one family role')
        setIsLoading(false)
        return
      }

      if (data.mainConcerns.length === 0) {
        toast.error('Please select at least one main concern or goal')
        setIsLoading(false)
        return
      }

      // Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName
          }
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        if (authError.message.includes('already registered')) {
          toast.error('This email is already registered. Please try logging in instead.')
        } else {
          toast.error(authError.message || 'Failed to create account')
        }
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        toast.error('Failed to create user account')
        setIsLoading(false)
        return
      }

      // Prepare profile data
      const profileData = {
        auth_user_id: authData.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        family_roles: data.familyRoles,
        children_count: parseInt(data.childrenCount),
        children_ages: data.childrenAges,
        main_concerns: data.mainConcerns.filter(c => c !== 'other'),
        main_concerns_other: data.mainConcernsOther || null,
        dietary_preferences: data.dietaryPreferences.filter(d => d !== 'other'),
        dietary_preferences_other: data.dietaryPreferencesOther || null,
        personalized_support: data.personalizedSupport,
        registration_metadata: {
          registration_date: new Date().toISOString(),
          registration_source: 'web_form',
          form_version: '1.0',
          raw_form_data: data
        }
      }

      // The user profile will be created automatically by the database trigger
      // We just need to update it with the registration data after a short delay
      setTimeout(async () => {
        try {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              family_roles: data.familyRoles,
              children_count: parseInt(data.childrenCount),
              children_ages: data.childrenAges,
              main_concerns: data.mainConcerns.filter(c => c !== 'other'),
              main_concerns_other: data.mainConcernsOther || null,
              dietary_preferences: data.dietaryPreferences.filter(d => d !== 'other'),
              dietary_preferences_other: data.dietaryPreferencesOther || null,
              personalized_support: data.personalizedSupport,
              registration_metadata: {
                registration_date: new Date().toISOString(),
                registration_source: 'web_form',
                form_version: '1.0',
                raw_form_data: data
              }
            })
            .eq('auth_user_id', authData.user.id)

          if (updateError) {
            console.error('Profile update error:', updateError)
          }
        } catch (updateErr) {
          console.error('Profile update failed:', updateErr)
        }
      }, 2000) // Wait 2 seconds for trigger to create basic profile

      // Redirect to email confirmation page
      window.location.href = '/email-confirmation'

    } catch (error) {
      console.error('Registration error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    }

    setIsLoading(false)
  }

  return (
    <div className="registration-form">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* 1. Basic Information */}
        <div className="form-section">
          <h3 className="section-title">1. Basic Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">First Name</label>
              <input
                type="text"
                className={`form-input ${errors.firstName ? 'error' : ''}`}
                {...register('firstName', {
                  required: 'First name is required',
                  minLength: { value: 2, message: 'First name must be at least 2 characters' }
                })}
                placeholder="Enter your first name"
              />
              {errors.firstName && <span className="form-error">{errors.firstName.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Last Name</label>
              <input
                type="text"
                className={`form-input ${errors.lastName ? 'error' : ''}`}
                {...register('lastName', {
                  required: 'Last name is required',
                  minLength: { value: 2, message: 'Last name must be at least 2 characters' }
                })}
                placeholder="Enter your last name"
              />
              {errors.lastName && <span className="form-error">{errors.lastName.message}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Email Address</label>
            <input
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
            />
            {errors.email && <span className="form-error">{errors.email.message}</span>}
            <p className="form-help">Must be the same as Circle. If you are not a current MOMS on a Mission member using the same name and email on record, we reserve the right to revoke your access to MOMi.</p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Password</label>
              <input
                type="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' }
                })}
                placeholder="Choose a secure password"
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Confirm Password</label>
              <input
                type="password"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                {...register('confirmPassword', {
                  required: 'Please confirm your password'
                })}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
            </div>
          </div>
        </div>

        {/* 2. Family Role */}
        <div className="form-section">
          <h3 className="section-title">2. Family Role <span className="required-indicator">(Check all that apply)</span></h3>
          <div className="checkbox-group">
            {familyRoleOptions.map((option) => (
              <div key={option.value} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`family-role-${option.value}`}
                  className="checkbox-input"
                  {...register('familyRoles')}
                  value={option.value}
                  onChange={(e) => handleCheckboxChange('familyRoles', option.value, e.target.checked)}
                />
                <label htmlFor={`family-role-${option.value}`} className="checkbox-label">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Number of Children */}
        <div className="form-section">
          <h3 className="section-title">3. Number of Children</h3>
          <div className="form-group">
            <select
              className="form-select"
              {...register('childrenCount')}
            >
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i.toString()}>
                  {i === 10 ? '10+' : i}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Ages of Children */}
        <div className="form-section">
          <h3 className="section-title">4. Ages of Children <span className="section-subtitle">(Select all that apply)</span></h3>
          <div className="checkbox-group">
            {childrenAgeOptions.map((option) => (
              <div key={option.value} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`children-age-${option.value}`}
                  className="checkbox-input"
                  value={option.value}
                  onChange={(e) => handleCheckboxChange('childrenAges', option.value, e.target.checked)}
                />
                <label htmlFor={`children-age-${option.value}`} className="checkbox-label">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Main Concerns or Goals */}
        <div className="form-section">
          <h3 className="section-title">5. Main Concerns or Goals <span className="section-subtitle">(Select multiple or write in)</span></h3>
          <div className="checkbox-group">
            {mainConcernOptions.map((option) => (
              <div key={option.value} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`concern-${option.value}`}
                  className="checkbox-input"
                  value={option.value}
                  onChange={(e) => handleCheckboxChange('mainConcerns', option.value, e.target.checked)}
                />
                <label htmlFor={`concern-${option.value}`} className="checkbox-label">
                  {option.label}
                </label>
              </div>
            ))}
          </div>

          {showOtherConcern && (
            <div className="form-group mt-4">
              <label className="form-label">Please specify your other concern:</label>
              <input
                type="text"
                className="form-input"
                {...register('mainConcernsOther')}
                placeholder="Describe your specific concern or goal"
              />
            </div>
          )}
        </div>

        {/* 6. Dietary Preferences */}
        <div className="form-section">
          <h3 className="section-title">6. Dietary Preferences and Allergies <span className="section-subtitle">(Lifestyle Preferences Only)</span></h3>
          <div className="checkbox-group">
            {dietaryOptions.map((option) => (
              <div key={option.value} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`dietary-${option.value}`}
                  className="checkbox-input"
                  value={option.value}
                  onChange={(e) => handleCheckboxChange('dietaryPreferences', option.value, e.target.checked)}
                />
                <label htmlFor={`dietary-${option.value}`} className="checkbox-label">
                  {option.label}
                </label>
              </div>
            ))}
          </div>

          {showOtherDietary && (
            <div className="form-group mt-4">
              <label className="form-label">Please specify your other dietary preference:</label>
              <input
                type="text"
                className="form-input"
                {...register('dietaryPreferencesOther')}
                placeholder="Describe your specific dietary preference or allergy"
              />
            </div>
          )}
        </div>

        {/* 7. Future Enhancements */}
        <div className="form-section">
          <h3 className="section-title">7. Future Enhancements: Personalized Support</h3>
          <div className="radio-group">
            <div className="radio-item">
              <input
                type="radio"
                id="personalized-yes"
                className="radio-input"
                {...register('personalizedSupport')}
                value={true}
              />
              <label htmlFor="personalized-yes" className="radio-label">
                Yes, personalize and include future tailored recommendations (including affiliate offers when relevant)
              </label>
            </div>
            <div className="radio-item">
              <input
                type="radio"
                id="personalized-no"
                className="radio-input"
                {...register('personalizedSupport')}
                value={false}
              />
              <label htmlFor="personalized-no" className="radio-label">
                No, I prefer to see only general content based on my own browsing choices
              </label>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="form-section">
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="agree-terms"
              className="checkbox-input"
              {...register('agreeToTerms', {
                required: 'You must agree to the Terms and Conditions'
              })}
            />
            <label htmlFor="agree-terms" className="checkbox-label">
              I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
            </label>
          </div>
          {errors.agreeToTerms && <span className="form-error">{errors.agreeToTerms.message}</span>}
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary btn-large btn-full"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Creating Account...
              </>
            ) : (
              'Create My MOMi Account'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RegistrationForm