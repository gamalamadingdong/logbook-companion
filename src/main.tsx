import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const storedTheme = localStorage.getItem('logbook_theme_preference');
const isThemePreference = storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'system';
const initialPreference = isThemePreference ? storedTheme : 'dark';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = initialPreference === 'system'
  ? (prefersDark ? 'dark' : 'light')
  : initialPreference;

document.documentElement.classList.toggle('dark', initialTheme === 'dark');
document.documentElement.classList.toggle('light', initialTheme === 'light');
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
