import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import AuthLayout from './src/layouts/auth'
import PanelLayout from './src/layouts/panel'
import LoggedMiddleware from './src/middlewares/LoggedMiddleware'
import PanelOnboardingView from './src/views/panel/onboarding'

createRoot(document.getElementById('root')).render(<BrowserRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/auth" replace />} />
    <Route path="/auth/*" element={<AuthLayout />} />
    <Route
      path="/onboarding"
      element={
        <LoggedMiddleware>
          <PanelOnboardingView />
        </LoggedMiddleware>
      }
    />
    <Route path="/panel/*" element={<PanelLayout />} />
    <Route path="*" element={<Navigate to="/auth" replace />} />
  </Routes>
</BrowserRouter>)
