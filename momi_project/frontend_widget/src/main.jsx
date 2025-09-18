import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Check for a configuration object on the window
const config = window.momiChatWidget || {}
const mode = config.mode || 'floating'
const containerId = config.containerId || 'momi-chat-widget-container'

// Get the container specified in config or fallback to default
let container = document.getElementById(containerId)

if (!container) {
  // For fullpage mode, try to find the chat container
  if (mode === 'fullpage') {
    container = document.getElementById('momi-chat-container')
  }
  
  // If still no container, create default
  if (!container) {
    console.warn(`MOMi Widget: Container with ID "${containerId}" not found. Creating default container.`)
    container = document.createElement('div')
    container.id = containerId
    document.body.appendChild(container)
  }
}

// Check again if container exists before rendering
if (container) {
    createRoot(container).render(
        <StrictMode>
            <App 
                mode={mode} 
                userId={config.userId}
                userProfile={config.userProfile}
            />
        </StrictMode>,
    )
} else {
    console.error('MOMi Widget: Could not find or create a container to render the widget.')
}

// Expose an init function if needed for more control by the loader script, though IIFE usually self-executes.
// window.MomiWidget = {
//   init: (targetElementId) => { /* ... render logic ... */ }
// }
