# MOMi AI Wellness Assistant

## Overview

MOMi is a comprehensive AI-powered wellness assistant built on the 7 Pillars of Wellness framework. The system consists of a chatbot widget that can be embedded on external websites, a user registration and authentication system, an admin dashboard for managing users and content, and a backend API that integrates with OpenAI for conversational AI capabilities.

The project is designed as a multi-tenant solution where users can interact with MOMi through embedded widgets while administrators manage the system through a separate administrative interface. The system supports both guest users (for backward compatibility) and registered users with personalized experiences based on their wellness profiles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The system uses a multi-application frontend architecture with three distinct React applications:

1. **Widget Application** (`frontend_widget/`) - A embeddable chat widget built with React and Vite, designed to be integrated into external websites. Uses CSS custom properties for consistent styling and supports both desktop and mobile responsive designs.

2. **Registration Application** (`frontend_registration/`) - A standalone React application handling user registration, login, and profile management. Implements a comprehensive 7-section registration form capturing family roles, children information, main concerns, dietary preferences, and personalized support preferences.

3. **Admin Dashboard** (`frontend_admin/`) - A React-based administrative interface for managing users, conversations, system settings, and knowledge base content. Features role-based access control and comprehensive analytics.

All frontend applications use Vite as the build tool and share common design patterns through CSS custom properties for consistent branding.

### Backend Architecture
The backend is built with Express.js and follows a middleware-based architecture:

- **Authentication System** - Dual authentication supporting both regular users (via Supabase Auth) and admin users (custom authentication with bcrypt password hashing and session management)
- **API Route Organization** - Modular route structure with separate handlers for chat functionality, admin operations, and user management
- **Middleware Layer** - Authentication middleware for both user and admin routes, with permission-based access control
- **Conversation State Management** - In-memory session management for maintaining conversation context
- **File Upload Handling** - Multer-based file upload system supporting PDF and image analysis

### Data Storage Solutions
The system uses Supabase (PostgreSQL) as the primary database with the following schema design:

- **User Management** - Separate tables for `user_profiles` (registered users) and `admin_users` (administrative access)
- **Conversation System** - `conversations` and `messages` tables with foreign key relationships to user profiles
- **Knowledge Base** - Vector-based document storage using pgvector extension for semantic search
- **Analytics** - Comprehensive tracking of user interactions, knowledge base usage, and system performance
- **Session Management** - Custom admin session handling with `admin_sessions` and `admin_activity_log` tables

### Authentication and Authorization
The system implements a dual-authentication approach:

- **User Authentication** - Leverages Supabase Auth with JWT tokens for registered users, supporting password-based authentication with email verification
- **Admin Authentication** - Custom implementation using bcrypt password hashing, secure session tokens, and activity logging
- **Permission System** - Granular permissions for admin users with role-based access control
- **Row Level Security** - Supabase RLS policies ensuring users can only access their own data

## External Dependencies

### Core Services
- **Supabase** - Primary database (PostgreSQL) and user authentication service
- **OpenAI API** - Conversational AI, image analysis, and text processing capabilities
- **Replit** - Deployment platform and hosting environment

### NPM Packages
- **Backend Dependencies**:
  - `@supabase/supabase-js` - Database and authentication client
  - `express` - Web application framework
  - `openai` - OpenAI API client
  - `bcrypt` - Password hashing for admin authentication
  - `multer` - File upload middleware
  - `pdf-parse` - PDF text extraction
  - `axios` - HTTP client for external API calls
  - `cors` - Cross-origin resource sharing

- **Frontend Dependencies** (shared across applications):
  - `react` and `react-dom` - UI framework
  - `react-router-dom` - Client-side routing
  - `@supabase/supabase-js` - Client-side database operations
  - `react-hook-form` - Form state management
  - `react-hot-toast` - User notifications

### Build Tools and Development
- **Vite** - Frontend build tool and development server
- **ESLint** - Code linting and formatting
- **Concurrently** - Development script orchestration for running multiple services

### Database Extensions
- **pgvector** - Vector similarity search for knowledge base functionality
- **Supabase Extensions** - Authentication, real-time subscriptions, and row-level security