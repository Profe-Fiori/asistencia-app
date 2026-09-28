'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})
  const [mensaje, setMensaje] = useState('')

  // Cargar lista de alumnos desde Supabase al iniciar
  useEffect(() => {
    cargarAlumnos()
  }, [])

  const cargarAlumnos = async () => {
    const { data, error } = await supabase.from('alumnos').select('*')
    if (error) {
      console.error('Error al cargar alumnos:', error)
    } else if (data) {
      setAlumnos(data)
    }
  }

  // Procesar el texto reconocido para marcar asistencia
  const procesarVoz = async (texto) => {
    const textoLimpio = texto.toLowerCase().trim()
    setTranscript(texto)

    // Buscar si el texto dicho coincide con algún alumno
    const alumnoEncontrado = alumnos.find(a => 
      textoLimpio.includes(a.nombre.toLowerCase()) || 
      textoLimpio.includes(a.apellido.toLowerCase())
    )

    if (alumnoEncontrado) {
      const nuevoEstado = textoLimpio.includes('ausente') ? 'ausente' : 'presente'
      
      // Guardar en estado local
      setAsistencias(prev => ({ ...prev, [alumnoEncontrado.id]: nuevoEstado }))
      setMensaje(`Mapeado: ${alumnoEncontrado.nombre} ${alumnoEncontrado.apellido} ➔ ${nuevoEstado.toUpperCase()}`)

      // Guardar en la base de datos de Supabase
      const { error } = await supabase.from('asistencias').insert([
        { alumno_id: alumnoEncontrado.id, estado: nuevoEstado, fecha: new Date().toISOString().split('T')[0] }
      ])

      if (error) console.error('Error al guardar asistencia:', error)
    }
  }

  const toggleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert('Reconocimiento de voz no soportado')

    if (listening) {
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = (e) => {
      const current = e.resultIndex
      const text = e.results[current][0].transcript
      procesarVoz(text)
    }

    recognition.start()
  }

  return (
    <main className="p-4 max-w-lg mx-auto flex flex-col items-center min-h-screen gap-6 pt-10">
      <h1 className="text-2xl font-bold text-emerald-400">Control de Asistencia</h1>
      
      <button 
        onClick={toggleListen}
        className={`px-6 py-4 rounded-full font-bold text-lg shadow-lg transition-all ${
          listening ? 'bg-red-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {listening ? 'Escuchando...' : 'Iniciar Asistencia por Voz'}
      </button>

      {transcript && (
        <div className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Último dictado:</p>
          <p className="text-slate-200 text-lg font-medium">{transcript}</p>
          {mensaje && <p className="text-emerald-400 text-sm mt-2 font-bold">{mensaje}</p>}
        </div>
      )}

      {/* Listado de Alumnos */}
      <div className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700">
        <h2 className="text-lg font-bold mb-3 text-slate-300">Lista de Alumnos ({alumnos.length})</h2>
        {alumnos.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay alumnos cargados aún en la base de datos.</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {alumnos.map(a => (
              <li key={a.id} className="py-2 flex justify-between items-center">
                <span>{a.nombre} {a.apellido}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  asistencias[a.id] === 'presente' ? 'bg-emerald-900 text-emerald-300' :
                  asistencias[a.id] === 'ausente' ? 'bg-red-900 text-red-300' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {asistencias[a.id] ? asistencias[a.id].toUpperCase() : 'PENDIENTE'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
