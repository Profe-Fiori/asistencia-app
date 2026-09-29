'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [cursos, setCursos] = useState([])
  const [cursoSeleccionado, setCursoSeleccionado] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [pestaña, setPestaña] = useState('asistencia')
  const [alumnoInforme, setAlumnoInforme] = useState(null)
  const [historialAlumno, setHistorialAlumno] = useState([])
  const [escuchando, setEscuchando] = useState(false)
  const [transcripcion, setTranscripcion] = useState('')

  // 1. Cargar cursos al iniciar
  useEffect(() => {
    async function cargarCursos() {
      const { data } = await supabase.from('cursos').select('*').order('nombre')
      if (data && data.length > 0) {
        setCursos(data)
        setCursoSeleccionado(data[0].id)
      }
    }
    cargarCursos()
  }, [])

  // 2. Cargar alumnos según el curso seleccionado
  useEffect(() => {
    if (!cursoSeleccionado) return
    async function cargarAlumnosPorCurso() {
      const { data } = await supabase
        .from('alumnos')
        .select('*')
        .eq('curso_id', cursoSeleccionado)
        .order('apellido')

      if (data) {
        setAlumnos(data)
        const iniciales = {}
        data.forEach((a) => (iniciales[a.id] = 'PENDIENTE'))
        setAsistencias(iniciales)
      }
    }
    cargarAlumnosPorCurso()
  }, [cursoSeleccionado])

  const toggleEstado = (id) => {
    setAsistencias((prev) => ({
      ...prev,
      [id]: prev[id] === 'PRESENTE' ? 'AUSENTE' : 'PRESENTE',
    }))
  }

  // Mando por Voz Inteligente (Asistencia, Participaciones e Informes)
  const iniciarMicrofono = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz por micrófono.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => {
      setEscuchando(true)
      setTranscripcion('Escuchando orden...')
    }

    recognition.onresult = async (event) => {
      const texto = event.results[event.results.length - 1][0].transcript.toLowerCase()
      setTranscripcion(`Comando detectado: "${texto}"`)

      // Procesar comando según la pestaña activa
      alumnos.forEach(async (a) => {
        const apellidoLower = a.apellido.toLowerCase()
        if (texto.includes(apellidoLower)) {

          // Acciones para ASISTENCIA
          if (pestaña === 'asistencia') {
            if (texto.includes('ausente')) {
              setAsistencias((prev) => ({ ...prev, [a.id]: 'AUSENTE' }))
            } else if (texto.includes('presente')) {
              setAsistencias((prev) => ({ ...prev, [a.id]: 'PRESENTE' }))
            }
          }

          // Acciones para PARTICIPACIONES
          else if (pestaña === 'participacion') {
            await supabase.from('participaciones').insert({
              alumno_id: a.id,
              fecha,
              tipo: 'Participación',
              descripcion: texto
            })
            alert(`Nota registrada para ${a.nombre} ${a.apellido}: "${texto}"`)
          }

          // Acciones para INFORMES
          else if (pestaña === 'informe') {
            cargarInformeAlumno(a)
          }

        }
      })
    }

    recognition.onerror = (event) => {
      console.error('Error de voz:', event.error)
      setEscuchando(false)
    }

    recognition.onend = () => {
      setEscuchando(false)
    }

    if (escuchando) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }

  const guardarAsistencias = async () => {
    const registros = Object.entries(asistencias).map(([alumno_id, estado]) => ({
      alumno_id,
      fecha,
      estado,
    }))
    const { error } = await supabase.from('asistencias').insert(registros)
    if (error) {
      alert('Error al guardar asistencias: ' + error.message)
    } else {
      alert('¡Asistencias guardadas exitosamente!')
    }
  }

  const cargarInformeAlumno = async (alumno) => {
    setAlumnoInforme(alumno)
    const { data: asis } = await supabase.from('asistencias').select('*').eq('alumno_id', alumno.id)
    const { data: part } = await supabase.from('participaciones').select('*').eq('alumno_id', alumno.id)

    setHistorialAlumno([
      ...(asis || []).map((a) => ({ ...a, tipo_reg: 'Asistencia' })),
      ...(part || []).map((p) => ({ ...p, tipo_reg: 'Participación' })),
    ])
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh' }}>
      
      {/* Título Principal */}
      <h1 style={{ textAlign: 'center', color: '#ffffff', fontWeight: 'bold', fontSize: '22px', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '12px' }}>
        PROFESOR FIORI NICOLAS
      </h1>

      {/* Botón Principal de Comando por Voz */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button
          onClick={iniciarMicrofono}
          style={{
            padding: '14px 24px',
            borderRadius: '30px',
            backgroundColor: escuchando ? '#ef4444' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
          }}
        >
          {escuchando ? '🔴 Detener Micrófono' : '🎙️ Comando de Voz'}
        </button>
        {transcripcion && (
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#93c5fd', fontStyle: 'italic' }}>
            {transcripcion}
          </p>
        )}
      </div>

      {/* Seleccionar Curso y Fecha */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <select
          value={cursoSeleccionado}
          onChange={(e) => setCursoSeleccionado(e.target.value)}
          style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6', flex: '1', minWidth: '180px' }}
        >
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6' }}
        />
      </div>

      {/* Pestañas de Navegación en Azul y Blanco */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button
          onClick={() => setPestaña('asistencia')}
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: pestaña === 'asistencia' ? '#2563eb' : '#1e293b',
            color: '#ffffff',
            border: pestaña === 'asistencia' ? '2px solid #60a5fa' : '1px solid #334155',
            fontWeight: 'bold',
            flex: 1
          }}
        >
          Asistencia
        </button>
        <button
          onClick={() => setPestaña('participacion')}
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: pestaña === 'participacion' ? '#2563eb' : '#1e293b',
            color: '#ffffff',
            border: pestaña === 'participacion' ? '2px solid #60a5fa' : '1px solid #334155',
            fontWeight: 'bold',
            flex: 1
          }}
        >
          Participaciones
        </button>
        <button
          onClick={() => setPestaña('informe')}
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: pestaña === 'informe' ? '#2563eb' : '#1e293b',
            color: '#ffffff',
            border: pestaña === 'informe' ? '2px solid #60a5fa' : '1px solid #334155',
            fontWeight: 'bold',
            flex: 1
          }}
        >
          Informes
        </button>
      </div>

      {/* Vista de Asistencias */}
      {pestaña === 'asistencia' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Tomar Asistencia ({alumnos.length} Alumnos)</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li
                key={a.id}
                style={{
                  padding: '14px',
                  marginBottom: '8px',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #334155'
                }}
              >
                <span style={{ fontWeight: '500' }}>{a.apellido}, {a.nombre}</span>
                <button
                  onClick={() => toggleEstado(a.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: asistencias[a.id] === 'PRESENTE' ? '#2563eb' : '#64748b',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {asistencias[a.id] || 'PENDIENTE'}
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={guardarAsistencias}
            style={{
              width: '100%',
              padding: '16px',
              marginTop: '20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            Guardar Lista del Día
          </button>
        </div>
      )}

      {/* Vista de Participaciones */}
      {pestaña === 'participacion' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Registrar Participación / Nota</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li
                key={a.id}
                style={{
                  padding: '14px',
                  marginBottom: '8px',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #334155'
                }}
              >
                <span>{a.apellido}, {a.nombre}</span>
                <button
                  onClick={async () => {
                    const desc = prompt(`Ingrese la participación o nota para ${a.nombre} ${a.apellido}:`)
                    if (desc) {
                      await supabase.from('participaciones').insert({ alumno_id: a.id, fecha, tipo: 'Participación', descripcion: desc })
                      alert('¡Participación registrada!')
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  + Agregar Nota
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vista de Informes */}
      {pestaña === 'informe' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Informe por Alumno</h3>
          <select
            onChange={(e) => {
              const alum = alumnos.find((a) => a.id.toString() === e.target.value)
              if (alum) cargarInformeAlumno(alum)
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '16px',
              marginBottom: '20px',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: '1px solid #3b82f6'
            }}
          >
            <option value="">Seleccionar alumno...</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>
            ))}
          </select>

          {alumnoInforme && (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '10px' }}>Historial de {alumnoInforme.nombre} {alumnoInforme.apellido}:</h4>
              {historialAlumno.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No hay registros guardados aún para este alumno.</p>
              ) : (
                <ul style={{ paddingLeft: '20px' }}>
                  {historialAlumno.map((h, index) => (
                    <li key={index} style={{ marginBottom: '8px', color: '#e2e8f0' }}>
                      <strong>{h.fecha}</strong> - {h.tipo_reg}: {h.estado || h.descripcion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
      }
    
