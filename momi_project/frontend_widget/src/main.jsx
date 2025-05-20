import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Ensure this ID matches the one the loader script in the landing page will create
const WIDGET_CONTAINER_ID = 'momi-chat-widget-container'

let container = document.getElementById(WIDGET_CONTAINER_ID)

if (!container) {
  // Fallback or for standalone dev: if the specific container isn't found, 
  // try to use a generic 'root' or create the container dynamically.
  // For production widget, the host page (landing page) MUST create this container.
  console.warn(`MOMi Widget: Container with ID "${WIDGET_CONTAINER_ID}" not found. Attempting to create or use #root.`)
  container = document.createElement('div')
  container.id = WIDGET_CONTAINER_ID
  document.body.appendChild(container)
  // Or, fallback to 'root' if it exists and you want to support standalone dev easily
  // container = document.getElementById('root')
  // if (!container) { // if root also doesn't exist, then create the widget container
  //    container = document.createElement('div')
  //    container.id = WIDGET_CONTAINER_ID
  //    document.body.appendChild(container)
  // }
}

// Check again if container exists before rendering
if (container) {
    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )
} else {
    console.error('MOMi Widget: Could not find or create a container to render the widget.')
}

// Expose an init function if needed for more control by the loader script, though IIFE usually self-executes.
// window.MomiWidget = {
//   init: (targetElementId) => { /* ... render logic ... */ }
// }
