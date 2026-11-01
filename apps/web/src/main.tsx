import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegram } from './lib/telegram'
// Шрифт лежит вместе с мини-аппом: без запроса к Google Fonts, который блокировал первый показ
import '@fontsource/manrope/cyrillic-300.css'
import '@fontsource/manrope/latin-300.css'
import '@fontsource/manrope/cyrillic-400.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/cyrillic-500.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/cyrillic-600.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/cyrillic-700.css'
import '@fontsource/manrope/latin-700.css'
import './styles.css'

initTelegram()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
