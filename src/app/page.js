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

  // 1. Cargar lista de cursos al iniciar
  useEffect(() => {
    async function cargarCursos() {
      const { data, error } = await supabase.from('cursos').select('*').order('nombre')
      if (data && data.length > 0) {
        setCursos(data)
        setCursoSeleccionado(data[0].id)
      }
    }
    cargarCursos()
  }, [])

  // 2. Cargar alumnos cuando cambia el curso seleccionado
  useEffect(() => {
    if (!cursoSeleccionado) return
    async function cargarAlumnosPorCurso() {
      const { data, error } = await supabase
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
      alert('¡Asistencias guardadas exitosamente en Supabase!')
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', color: '#fff' }}>
      <h1 style={{ textAlign: 'center', color: '#10b981' }}>Control Docente - ProfeFioriApp</h1>

      {/* Seleccionar Curso y Fecha */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <select 
          value={cursoSeleccionado} 
          onChange={(e) => setCursoSeleccionado(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', fontSize: '16px', backgroundColor: '#1e293b', color: '#fff' }}
        >
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <input 
          type="date" 
          value={fecha} 
          onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '10px', borderRadius: '8px', fontSize: '16px', backgroundColor: '#1e293b', color: '#fff' }}
        />
      </div>

      {/* Pestañas de Navegación */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button onClick={() => setPestaña('asistencia')} style={{ padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'asistencia' ? '#10b981' : '#334155', color: '#fff', border: 'none' }}>🎙️ Asistencia</button>
        <button onClick={() => setPestaña('participacion')} style={{ padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'participacion' ? '#10b981' : '#334155', color: '#fff', border: 'none' }}>⭐ Participaciones</button>
        <button onClick={() => setPestaña('informe')} style={{ padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'informe' ? '#10b981' : '#334155', color: '#fff', border: 'none' }}>📊 Informes</button>
      </div>

      {/* Vista de Asistencias */}
      {pestaña === 'asistencia' && (
        <div>
          <h3>Tomar Asistencia ({alumnos.length} Alumnos)</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li key={a.id} style={{ padding: '12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{a.apellido}, {a.nombre}</span>
                <button 
                  onClick={() => toggleEstado(a.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: asistencias[a.id] === 'PRESENTE' ? '#10b981' : '#6b7280',
                    color: '#fff',
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
            style={{ width: '100%', padding: '15px', marginTop: '20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Guardar Lista del Día
          </button>
        </div>
      )}

      {/* Vista de Participaciones */}
      {pestaña === 'participacion' && (
        <div>
          <h3>Registrar Participación / Nota</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li key={a.id} style={{ padding: '12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{a.apellido}, {a.nombre}</span>
                <button 
                  onClick={async () => {
                    const desc = prompt(`Ingrese la participación o nota para ${a.nombre} ${a.apellido}:`)
                    if (desc) {
                      await supabase.from('participaciones').insert({ alumno_id: a.id, fecha, tipo: 'Participación', descripcion: desc })
                      alert('¡Participación registrada!')
                    }
                  }}
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
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
          <h3>Informe por Alumno</h3>
          <select 
            onChange={(e) => {
              const alum = alumnos.find((a) => a.id.toString() === e.target.value)
              if (alum) cargarInformeAlumno(alum)
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', marginBottom: '20px', backgroundColor: '#1e293b', color: '#fff' }}
          >
            <option value="">Seleccionar alumno...</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>
            ))}
          </select>

          {alumnoInforme && (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px' }}>
              <h4>Historial de {alumnoInforme.nombre} {alumnoInforme.apellido}:</h4>
              {historialAlumno.length === 0 ? (
                <p>No hay registros guardados aún para este alumno.</p>
              ) : (
                <ul>
                  {historialAlumno.map((h, index) => (
                    <li key={index} style={{ marginBottom: '8px' }}>
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
            
