'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})

  useEffect(() => {
    // Si no hay API de voz disponible en el navegador
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('El navegador no soporta reconocimiento de voz')
    }
  }, [])

  const toggleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert('Reconocimiento de voz no soportado en este navegador')

    if (listening) {
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = (e) => {
      const current = e.resultIndex
      const text = e.results[current][0].transcript
      setTranscript(text)
    }

    recognition.start()
  }

  return (
    <main className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-screen gap-6">
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
          <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Último comando dictado:</p>
          <p className="text-slate-200">{transcript}</p>
        </div>
      )}

      <div className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
        <p className="text-slate-400 text-sm">Seleccioná un curso para comenzar o dictá los nombres directamente.</p>
      </div>
    </main>
  )
        }
