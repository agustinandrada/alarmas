'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronRight, Edit3, Plus, Radio, Settings2, Sparkles, Volume2, Waves, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; text: string; sound: string }
type Alert = { id: string; message_id: string; sender_nickname: string; created_at: string }

const fallbackMessages: Message[] = [
  { id: 'food', text: 'Vamos a comer', sound: 'pop' },
  { id: 'chipa', text: 'Hora de Chipa', sound: 'bell' },
  { id: 'ice', text: 'Vamos a tomar helado', sound: 'party' },
]
const soundNames: Record<string, string> = { pop: 'Pop alegre', bell: 'Campanita', party: 'Fiesta', chime: 'Brillitos', horn: 'Bocina', clap: 'Aplausos' }

export default function Page() {
  const supabase = useRef<ReturnType<typeof createClient> | null>(null)
  const messagesRef = useRef<Message[]>(fallbackMessages)
  const audio = useRef<AudioContext | null>(null)
  const [nickname, setNickname] = useState('')
  const [messages, setMessages] = useState<Message[]>(fallbackMessages)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Message>(fallbackMessages[0])
  const [newMessage, setNewMessage] = useState('')
  const [sound, setSound] = useState('pop')
  const [status, setStatus] = useState('Conectando...')
  const [toast, setToast] = useState<string | null>(null)
  const [pushReady, setPushReady] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [installEvent, setInstallEvent] = useState<Event | null>(null)
  const [permissionPrompt, setPermissionPrompt] = useState(false)

  function decodeVapidKey(key: string) {
    const padding = '='.repeat((4 - (key.length % 4)) % 4)
    const raw = window.atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
  }

  async function enablePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setToast('Este navegador no admite notificaciones push'); return }
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setToast('Activá las notificaciones para recibir alertas'); return }
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) })
      const { error } = await createClient().from('push_subscriptions').upsert({ endpoint: subscription.endpoint, subscription: subscription.toJSON(), updated_at: new Date().toISOString() }, { onConflict: 'endpoint' })
      if (error) throw error
      setPushReady(true); setToast('Notificaciones activadas en este dispositivo')
    } catch { setToast('No se pudieron activar las notificaciones') } finally { setPushBusy(false) }
  }

  const playSound = useCallback((kind: string) => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = audio.current ?? new AudioContextClass()
    audio.current = ctx
    void ctx.resume()
    const notes = kind === 'bell' ? [740, 988] : kind === 'party' ? [440, 660, 880] : kind === 'chime' ? [880, 1174, 1480] : kind === 'horn' ? [220, 330, 220] : kind === 'clap' ? [180, 120, 180, 120] : [420, 620]
    const now = ctx.currentTime
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain(); const start = now + index * 0.18
      osc.type = kind === 'bell' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.22, start + 0.035); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.48)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + 0.5)
    })
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js')
    if ('Notification' in window && Notification.permission === 'default') setPermissionPrompt(true)
    const handleInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event) }
    window.addEventListener('beforeinstallprompt', handleInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleInstall)
  }, [])

  useEffect(() => {
    const client = createClient(); supabase.current = client
    setNickname(window.sessionStorage.getItem('alerta-nickname') ?? '')
    async function load() {
      const { data, error } = await client.from('alert_messages').select('id,text,sound').order('created_at')
      if (error) { setStatus('Modo local'); return }
      if (data?.length) { messagesRef.current = data; setMessages(data); setSelected(data[0]) }
      setStatus('Sala conectada')
      const history = await client.from('alerts').select('id,message_id,sender_nickname,created_at').order('created_at', { ascending: false }).limit(5)
      if (history.data) setAlerts(history.data)
    }
    void load()
    const channel = client.channel('alert-room').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
      const incoming = payload.new as Alert
      setAlerts((current) => [incoming, ...current].slice(0, 5))
      if (incoming.sender_nickname !== window.sessionStorage.getItem('alerta-nickname')) { const message = messagesRef.current.find((item) => item.id === incoming.message_id); setToast(`${incoming.sender_nickname} dice: ${message?.text ?? '¡Atención!'}`); playSound(message?.sound ?? 'party'); navigator.vibrate?.([700, 180, 700, 180, 1200]) }
    }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [playSound])

  async function sendAlert() {
    const name = nickname.trim()
    if (!name) { setToast('Escribí tu apodo primero'); return }
    window.sessionStorage.setItem('alerta-nickname', name); playSound(selected.sound); navigator.vibrate?.([600, 160, 600])
    if (!supabase.current) return
    const { error } = await supabase.current.from('alerts').insert({ message_id: selected.id, sender_nickname: name })
    if (!error) void fetch('/api/push/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `${name} dice`, body: selected.text, sound: selected.sound }) })
    setToast(error ? 'No se pudo enviar la señal. Revisá la conexión.' : `${name} dice: ${selected.text}`)
  }

  async function addMessage() {
    const text = newMessage.trim(); if (!text) return
    if (!supabase.current) return
    const { data } = await supabase.current.from('alert_messages').insert({ text, sound }).select('id,text,sound').single()
    if (data) { messagesRef.current = [...messagesRef.current, data]; setMessages((current) => [...current, data]); setSelected(data); setNewMessage(''); setToast('Mensaje agregado') }
  }

  return <main className="min-h-screen bg-background" onPointerDown={() => { void audio.current?.resume() }}>
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-5 pt-5 lg:max-w-6xl lg:px-12">
      <header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="brand-mark"><Radio size={21} /></div><div><p className="eyebrow">Alerta</p><p className="font-bold leading-tight">La señal del grupo</p></div></div><div className="flex items-center gap-2"><button className="install-button" onClick={() => { void (installEvent as Event & { prompt: () => Promise<void> })?.prompt(); setInstallEvent(null) }} hidden={!installEvent}>Instalar</button><button className={`status-pill ${pushReady ? 'push-on' : ''}`} onClick={enablePush} disabled={pushBusy}><span />{pushBusy ? 'Activando...' : pushReady ? 'Push activo' : 'Activar avisos'}</button></div></header>
      <section className="mt-7 flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16">
        <div className="text-center lg:text-left"><div className="kicker"><Sparkles size={14} /> Tocá. Todos se enteran.</div><h1 className="mt-4 text-balance text-5xl font-black leading-[0.95] tracking-tight">Un toque y<br /><span>se arma.</span></h1><p className="mx-auto mt-4 max-w-sm text-pretty text-sm leading-6 text-muted-foreground lg:mx-0">Mandá una señal instantánea a tu gente. Elegí el mensaje y que nadie se quede afuera.</p>
          <div className="mt-5 flex gap-2"><input aria-label="Tu apodo" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Tu apodo" className="field" /><button onClick={sendAlert} className="send-button" aria-label="Enviar alerta"><Zap size={20} /></button></div>
          <div className="pulse-wrap"><div className="pulse-ring" /><button className="pulse-button" onClick={sendAlert}><Zap size={38} fill="currentColor" /><strong>PULSAR</strong><small>avisar a todos</small></button></div><p className="hint"><Bell size={13} /> Sonido largo y vibración intensa</p>
        </div>
        <div className="panel"><div className="panel-heading"><div><p className="font-black">Mis alertas</p><p className="text-xs text-muted-foreground">Eleg�� tu señal favorita</p></div><Settings2 size={18} className="text-muted-foreground" /></div><div className="message-list">{messages.map((message) => <button key={message.id} onClick={() => { setSelected(message); playSound(message.sound) }} className={`message-card ${selected.id === message.id ? 'selected' : ''}`}><span className="message-icon"><Volume2 size={15} /></span><span className="min-w-0 flex-1 text-left"><b className="block truncate">{message.text}</b><small>{soundNames[message.sound] ?? 'Sonido suave'}</small></span>{selected.id === message.id ? <Check size={17} /> : <ChevronRight size={17} />}</button>)}</div><div className="add-row"><input aria-label="Nuevo mensaje" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Agregar mensaje..." className="field" /><select aria-label="Sonido" value={sound} onChange={(e) => setSound(e.target.value)} className="sound-select"><option value="pop">Pop</option><option value="bell">Campana</option><option value="party">Fiesta</option><option value="chime">Brillitos</option><option value="horn">Bocina</option><option value="clap">Aplausos</option></select><button aria-label="Agregar mensaje" onClick={addMessage} className="add-button"><Plus size={18} /></button></div><div className="panel-note"><Edit3 size={14} /> Los mensajes son compartidos con todo el grupo</div></div>
      </section>
      <section className="history"><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-black"><Waves size={15} className="text-primary" /> Últimas señales</p><span className="text-xs text-muted-foreground">{alerts.length} recientes</span></div>{alerts.length ? alerts.slice(0, 3).map((alert) => <div key={alert.id} className="history-item"><span className="history-dot"><Bell size={13} /></span><span><b>{alert.sender_nickname}</b> activó una alerta<small>{new Date(alert.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></span></div>) : <p className="empty-history">Todavía no hay señales. Sé el primero.</p>}</section>
      {permissionPrompt && <div className="toast-backdrop"><section className="permission-card" role="dialog" aria-modal="true" aria-labelledby="permission-title"><div className="toast-icon"><Bell size={22} /></div><h2 id="permission-title">No te pierdas ninguna señal</h2><p>Activá los avisos para recibir sonido y vibración aunque la app esté cerrada o el teléfono bloqueado.</p><div className="permission-actions"><button className="secondary-action" onClick={() => setPermissionPrompt(false)}>Ahora no</button><button className="primary-action" onClick={() => { setPermissionPrompt(false); void enablePush() }}>Activar avisos</button></div></section></div>}
      {toast && <div className="toast-backdrop" role="presentation" onClick={() => setToast(null)}><section className="toast" role="alertdialog" aria-modal="true" aria-label="Alerta del grupo" onClick={(event) => event.stopPropagation()}><div className="toast-icon"><Bell size={22} /></div><div className="min-w-0 flex-1"><strong>{toast}</strong><small>Alerta del grupo</small></div><button onClick={() => setToast(null)} aria-label="Cerrar mensaje"><Check size={18} /></button></section></div>}
    </div>
  </main>
}
