import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import messaging from '@react-native-firebase/messaging'
import { createClient } from '@supabase/supabase-js'
import * as Notifications from 'expo-notifications'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native'

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) })
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', { auth: { storage: AsyncStorage, autoRefreshToken: false, persistSession: false } })
const fallback = [{ id: '1', text: 'Vamos a comer', sound: 'pop' }, { id: '2', text: 'Hora de Chipa', sound: 'bell' }, { id: '3', text: 'Vamos a tomar helado', sound: 'party' }]
export default function App() {
  const [name, setName] = useState('')
  const [messages, setMessages] = useState(fallback)
  const [selected, setSelected] = useState(fallback[0])
  const [ready, setReady] = useState(false)
  const client = useMemo(() => supabase, [])
  useEffect(() => {
    AsyncStorage.getItem('nickname').then((value) => { if (value) setName(value) })
    client.from('alert_messages').select('id,text,sound').order('created_at').then(({ data }) => { if (data?.length) { setMessages(data); setSelected(data[0]) } })
    messaging().requestPermission().then(() => messaging().getToken()).then((token) => { if (token) void AsyncStorage.setItem('fcm-token', token); setReady(true) })
    const unsubscribe = messaging().onMessage(async (message) => {
      await Notifications.scheduleNotificationAsync({ content: { title: message.notification?.title ?? 'Nueva alerta', body: message.notification?.body ?? 'Hay una señal del grupo', sound: 'default' }, trigger: null })
      Vibration.vibrate([0, 700, 180, 700, 180, 1200])
    })
    return unsubscribe
  }, [client])
  async function send() { const nickname = name.trim() || 'Alguien'; if (!name.trim()) { Alert.alert('Elegí un apodo', 'Así todos saben quién envió la señal.'); return } await AsyncStorage.setItem('nickname', nickname); const { error } = await client.from('alerts').insert({ message_id: selected.id, sender_nickname: nickname }); if (error) return Alert.alert('No se pudo enviar', 'Revisá tu conexión.'); Vibration.vibrate([0, 700, 180, 700, 180, 1200]); Alert.alert(`${nickname} dice`, selected.text) }
  return (
    <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><View style={styles.header}><View><Text style={styles.kicker}>ALERTA</Text><Text style={styles.title}>La señal del grupo</Text></View><View style={styles.live}><View style={styles.dot}/><Text>{ready ? 'LISTA' : 'CONECTANDO'}</Text></View></View><Text style={styles.label}>TU APODO</Text><TextInput value={name} onChangeText={setName} placeholder="Ej: Agustín" placeholderTextColor="#9f958c" style={styles.input}/><Text style={styles.label}>ELEGÍ EL MENSAJE</Text><View style={styles.cards}>{messages.map((item) => <Pressable key={item.id} onPress={() => setSelected(item)} style={[styles.card, selected.id === item.id && styles.cardSelected]}><Text style={styles.cardEmoji}>{item.sound === 'bell' ? '◉' : item.sound === 'party' ? '✦' : '●'}</Text><Text style={styles.cardText}>{item.text}</Text><Text style={styles.check}>{selected.id === item.id ? '✓' : ''}</Text></Pressable>)}</View><View style={styles.hero}><Text style={styles.heroCaption}>TOCÁ PARA AVISAR</Text><Pressable onPress={send} style={({ pressed }) => [styles.pulse, pressed && styles.pressed]}><Text style={styles.bolt}>ϟ</Text><Text style={styles.pulseText}>¡PULSAR!</Text><Text style={styles.pulseSub}>Todos reciben la señal</Text></Pressable></View><View style={styles.notice}><Text style={styles.noticeTitle}>Notificaciones nativas activas</Text><Text style={styles.noticeBody}>Sonido y vibración aunque la app esté cerrada o el teléfono bloqueado.</Text></View></ScrollView></SafeAreaView>
  )
}
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#fbf7f0'},container:{padding:22,paddingBottom:40},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:30},kicker:{color:'#e84d2d',fontSize:12,fontWeight:'900',letterSpacing:2},title:{color:'#27221e',fontSize:21,fontWeight:'900'},live:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#fff1df',padding:9,borderRadius:20},dot:{width:8,height:8,borderRadius:8,backgroundColor:'#e84d2d'},label:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:'#9f958c',marginTop:10,marginBottom:8},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#eadfd3',borderRadius:14,padding:15,fontSize:16,color:'#27221e'},cards:{gap:10},card:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderWidth:1,borderColor:'#eadfd3',borderRadius:16,padding:14,gap:12},cardSelected:{borderColor:'#e84d2d',backgroundColor:'#fff7ef'},cardEmoji:{color:'#e84d2d',fontSize:18},cardText:{flex:1,color:'#27221e',fontWeight:'800'},check:{color:'#e84d2d',fontSize:18,fontWeight:'900'},hero:{alignItems:'center',marginVertical:34},heroCaption:{color:'#9f958c',fontSize:11,fontWeight:'900',letterSpacing:1.5,marginBottom:14},pulse:{width:205,height:205,borderRadius:110,backgroundColor:'#e84d2d',alignItems:'center',justifyContent:'center',borderWidth:12,borderColor:'#ffd9bd',shadowColor:'#e84d2d',shadowOpacity:.3,shadowRadius:18,elevation:8},pressed:{transform:[{scale:.96}]},bolt:{color:'#fff8ed',fontSize:38,fontWeight:'900'},pulseText:{color:'#fff',fontSize:25,fontWeight:'900'},pulseSub:{color:'#ffe0cf',fontSize:11,fontWeight:'700',marginTop:5},notice:{backgroundColor:'#fff0b9',borderRadius:16,padding:16},noticeTitle:{color:'#27221e',fontWeight:'900'},noticeBody:{color:'#655b51',marginTop:5,lineHeight:20}})
