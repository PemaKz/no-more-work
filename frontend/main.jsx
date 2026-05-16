import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import AuthLayout from './src/layouts/auth'
import PanelLayout from './src/layouts/panel'

createRoot(document.getElementById('root')).render(<BrowserRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/auth" replace />} />
    <Route path="/auth/*" element={<AuthLayout />} />
    <Route path="/panel/*" element={<PanelLayout />} />
    <Route path="*" element={<Navigate to="/auth" replace />} />
  </Routes>
</BrowserRouter>)
