import { useState, type ChangeEvent } from 'react'
import { Bell, Building2, Check, ImagePlus, Moon, Palette, Save, Settings2, SlidersHorizontal, Sun, X } from 'lucide-react'
import { getPreferredTheme, useTheme } from '../app/theme'
import { Button, PageContainer, Panel } from '../components/shared'
import { NotificationSettingsSection } from '../features/notifications/components/NotificationSettingsSection'
import '../features/settings/settings.css'
import { PasswordSecuritySection } from '../features/auth/PasswordSecuritySection'
import { EmailSecuritySection } from '../features/auth/EmailSecuritySection'
import { SessionSecuritySection } from '../features/auth/SessionSecuritySection'
import { AccountSecuritySection } from '../features/auth/AccountSecuritySection'

type SettingsState = {
  businessName: string
  phone: string
  email: string
  address: string
  currency: string
  weightUnit: string
  dateFormat: string
  defaultTeaType: string
  defaultRegion: string
  tax: string
  lowStockAlerts: boolean
  dailySalesReminder: boolean
  purchaseAlerts: boolean
  theme: 'light' | 'dark'
  layout: 'comfortable' | 'compact'
  logoName: string
}

const INITIAL_SETTINGS: SettingsState = {
  businessName: 'Tea Business', phone: '+92 300 1234567', email: 'hello@teabusiness.example', address: '24 Garden Road, Islamabad, Pakistan', currency: 'PKR - Pakistani Rupee', weightUnit: 'Kilograms (kg)', dateFormat: 'DD MMM YYYY', defaultTeaType: 'Green Tea', defaultRegion: 'Islamabad', tax: '0', lowStockAlerts: true, dailySalesReminder: true, purchaseAlerts: false, theme: 'light', layout: 'comfortable', logoName: '',
}

export function SettingsPage() {
  const [, setTheme] = useTheme()
  const [savedSettings, setSavedSettings] = useState(() => ({ ...INITIAL_SETTINGS, theme: getPreferredTheme() }))
  const [draft, setDraft] = useState(() => ({ ...INITIAL_SETTINGS, theme: getPreferredTheme() }))
  const [notice, setNotice] = useState('')

  function update<K extends keyof SettingsState>(field: K, value: SettingsState[K]) {
    setDraft(current => ({ ...current, [field]: value }))
    if (field === 'theme') setTheme(value as SettingsState['theme'])
  }
  function handleLogo(event: ChangeEvent<HTMLInputElement>) { update('logoName', event.target.files?.[0]?.name ?? '') }
  function saveChanges() { setSavedSettings(draft); setTheme(draft.theme); setNotice('Settings saved locally.'); window.setTimeout(() => setNotice(''), 2600) }
  function cancelChanges() { setDraft(savedSettings); setTheme(savedSettings.theme); setNotice('Unsaved changes discarded.'); window.setTimeout(() => setNotice(''), 2600) }

  return <PageContainer className="settings-page"><div className="page-heading settings-page-heading"><div><div className="eyebrow"><span className="pulse" /> Workspace configuration</div><h1>Settings</h1><p>Manage your business preferences and dashboard experience.</p></div><div className="settings-actions"><Button onClick={cancelChanges}><X size={15} /> Cancel</Button><Button variant="primary" className="primary-button" onClick={saveChanges}><Save size={15} /> Save Changes</Button></div></div><div className="settings-layout"><aside className="settings-nav" aria-label="Settings sections"><a className="settings-nav-item active" href="#business-profile"><Building2 size={16} /> Business Profile</a><a className="settings-nav-item" href="#regional-settings"><SlidersHorizontal size={16} /> Regional Settings</a><a className="settings-nav-item" href="#sales-settings"><Settings2 size={16} /> Sales Settings</a><a className="settings-nav-item" href="#account-security">Account &amp; Security</a><a className="settings-nav-item" href="#notifications"><Bell size={16} /> Notifications</a><a className="settings-nav-item" href="#appearance"><Palette size={16} /> Appearance</a></aside><div className="settings-content"><section className="account-security-grid" aria-label="Account and security"><AccountSecuritySection /><EmailSecuritySection /><PasswordSecuritySection /><SessionSecuritySection /></section><Panel className="settings-panel" id="business-profile"><SectionHeading icon={<Building2 size={16} />} title="Business Profile" detail="Keep your company details up to date." /><div className="settings-form-grid"><Field label="Business Name"><input value={draft.businessName} onChange={event => update('businessName', event.target.value)} /></Field><Field label="Phone"><input type="tel" value={draft.phone} onChange={event => update('phone', event.target.value)} /></Field><Field label="Email"><input type="email" value={draft.email} onChange={event => update('email', event.target.value)} /></Field><Field label="Address" wide><textarea rows={3} value={draft.address} onChange={event => update('address', event.target.value)} /></Field><div className="settings-field settings-field-wide"><span>Logo</span><div className="logo-upload"><div className="logo-preview"><span>{draft.logoName ? draft.logoName.slice(0, 2).toUpperCase() : 'TB'}</span></div><div><label className="upload-button"><ImagePlus size={15} /> {draft.logoName ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/*" onChange={handleLogo} /></label><small>PNG or JPG, up to 2MB. The preview updates locally before saving.</small></div></div></div></div></Panel><Panel className="settings-panel" id="regional-settings"><SectionHeading icon={<SlidersHorizontal size={16} />} title="Regional Settings" detail="Choose the formats your team uses every day." /><div className="settings-form-grid"><Field label="Currency"><select value={draft.currency} onChange={event => update('currency', event.target.value)}><option>PKR - Pakistani Rupee</option><option>USD - US Dollar</option><option>EUR - Euro</option></select></Field><Field label="Weight Unit"><select value={draft.weightUnit} onChange={event => update('weightUnit', event.target.value)}><option>Kilograms (kg)</option><option>Pounds (lb)</option></select></Field><Field label="Date Format"><select value={draft.dateFormat} onChange={event => update('dateFormat', event.target.value)}><option>DD MMM YYYY</option><option>MMM DD, YYYY</option><option>YYYY-MM-DD</option></select></Field></div></Panel><Panel className="settings-panel" id="sales-settings"><SectionHeading icon={<Settings2 size={16} />} title="Sales Settings" detail="Set sensible defaults for daily entries." /><div className="settings-form-grid"><Field label="Default Tea Type"><select value={draft.defaultTeaType} onChange={event => update('defaultTeaType', event.target.value)}><option>Green Tea</option><option>Black Tea</option></select></Field><Field label="Default Region"><select value={draft.defaultRegion} onChange={event => update('defaultRegion', event.target.value)}><option>Islamabad</option><option>Lahore</option><option>Peshawar</option><option>Karachi</option><option>Rawalpindi</option></select></Field><Field label="Tax (%)"><input type="number" min="0" max="100" step="0.1" value={draft.tax} onChange={event => update('tax', event.target.value)} /></Field></div></Panel><Panel className="settings-panel" id="notifications"><SectionHeading icon={<Bell size={16} />} title="Notification Settings" detail="Choose which operational reminders appear." /><NotificationSettingsSection /></Panel><Panel className="settings-panel" id="appearance"><SectionHeading icon={<Palette size={16} />} title="Appearance" detail="Tune the workspace for your preferred rhythm." /><div className="appearance-options"><div><span className="settings-label">Light / Dark Mode</span><div className="segmented-control"><button type="button" aria-pressed={draft.theme === 'light'} className={draft.theme === 'light' ? 'selected' : ''} onClick={() => update('theme', 'light')}><Sun size={14} /> Light</button><button type="button" aria-pressed={draft.theme === 'dark'} className={draft.theme === 'dark' ? 'selected' : ''} onClick={() => update('theme', 'dark')}><Moon size={14} /> Dark</button></div></div><div><span className="settings-label">Layout Density</span><div className="segmented-control"><button type="button" aria-pressed={draft.layout === 'comfortable'} className={draft.layout === 'comfortable' ? 'selected' : ''} onClick={() => update('layout', 'comfortable')}>Comfortable</button><button type="button" aria-pressed={draft.layout === 'compact'} className={draft.layout === 'compact' ? 'selected' : ''} onClick={() => update('layout', 'compact')}>Compact</button></div></div></div></Panel></div></div>{notice && <div className="settings-toast" role="status"><Check size={15} /> {notice}</div>}</PageContainer>
}

function SectionHeading({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="settings-section-heading"><span>{icon}</span><div><h2>{title}</h2><p>{detail}</p></div></div> }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`settings-field ${wide ? 'settings-field-wide' : ''}`}><span>{label}</span>{children}</label> }
