import { useState } from 'react'
import EncodePanel from './EncodePanel'
import DecodePanel from './DecodePanel'
import { applyTheme, loadTheme, type Theme } from './theme'

type Tab = 'encode' | 'decode'

export default function App() {
  const [tab, setTab] = useState<Tab>('encode')
  const [theme, setTheme] = useState<Theme>(loadTheme)

  const onThemeChange = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>TextQR</h1>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'encode'} onClick={() => setTab('encode')}>
            Text to QR
          </button>
          <button role="tab" aria-selected={tab === 'decode'} onClick={() => setTab('decode')}>
            QR to Text
          </button>
        </nav>
        <label className="theme-picker">
          <span className="visually-hidden">Theme</span>
          <select value={theme} onChange={(e) => onThemeChange(e.target.value as Theme)} aria-label="Theme">
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>
      <main className="app-main">{tab === 'encode' ? <EncodePanel /> : <DecodePanel />}</main>
      <footer className="app-footer">Everything runs in your browser. Nothing is uploaded.</footer>
    </div>
  )
}
