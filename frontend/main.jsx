import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from './src/layouts/auth'
import './styles.css'
import PanelLayout from './src/layouts/panel'

createRoot(document.getElementById('root')).render(<BrowserRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/auth" replace />} />
    <Route path="/auth/*" element={<AuthLayout />} />
    <Route path="/panel/*" element={<PanelLayout />} />
    <Route path="*" element={<Navigate to="/auth" replace />} />
  </Routes>
</BrowserRouter>)
