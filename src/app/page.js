'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [autenticado, setAutenticado] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const [cursos, setCursos] = useState([])
  const [cursoSeleccionado, setCursoSeleccionado] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})
  const [conteos, setConteos] = useState({}) 
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [pestaña, setPestaña] = useState('asistencia')
  const [alumnoInforme, setAlumnoInforme] = useState(null)
  const [historialAlumno, setHistorialAlumno] = useState([])
  const [totalParticipacionesAlumno, setTotalParticipacionesAlumno] = useState(0)
  const [resumenFecha, setResumenFecha] = useState([])

  const logoSrc = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=150&auto=format&fit=crop&q=80"

  useEffect(() => {
    if (!autenticado) return
    async function cargarCursos() {
      const { data } = await supabase.from('cursos').select('*').order('nombre')
      if (data && data.length > 0) {
        setCursos(data)
        setCursoSeleccionado(data[0].id)
      }
    }
    cargarCursos()
  }, [autenticado])

  useEffect(() => {
    if (!cursoSeleccionado || !autenticado) return
    async function cargarDatosCurso() {
      const { data: alms } = await supabase
        .from('alumnos')
        .select('*')
        .eq('curso_id', cursoSeleccionado)
        .order('apellido')

      if (alms) {
        setAlumnos(alms)
        const inicialesAsis = {}
        alms.forEach((a) => (inicialesAsis[a.id] = 'PENDIENTE'))
        setAsistencias(inicialesAsis)

        const { data: conts } = await supabase
          .from('conteo_participaciones')
          .select('*')
          .eq('fecha', fecha)

        const mapaConteos = {}
        alms.forEach((a) => {
          const encontrado = conts?.find((c) => c.alumno_id === a.id)
          mapaConteos[a.id] = encontrado ? encontrado.cantidad : 0
        })
        setConteos(mapaConteos)
      }
    }
    cargarDatosCurso()
  }, [cursoSeleccionado, fecha, autenticado])

  useEffect(() => {
    if (pestaña === 'resumen' && cursoSeleccionado && autenticado) {
      async function cargarResumenPorFecha() {
        const { data } = await supabase
          .from('asistencias')
          .select('*, alumnos!inner(curso_id, apellido, nombre)')
          .eq('fecha', fecha)
          .eq('alumnos.curso_id', cursoSeleccionado)

        if (data) {
          setResumenFecha(data)
        }
      }
      cargarResumenPorFecha()
    }
  }, [pestaña, fecha, cursoSeleccionado, autenticado])

  const toggleEstado = (id) => {
    setAsistencias((prev) => ({
      ...prev,
      [id]: prev[id] === 'PRESENTE' ? 'AUSENTE' : 'PRESENTE',
    }))
  }

  const cambiarConteo = async (alumno_id, delta) => {
    const valorActual = conteos[alumno_id] || 0
    const nuevoValor = valorActual + delta

    setConteos((prev) => ({ ...prev, [alumno_id]: nuevoValor }))

    await supabase
      .from('conteo_participaciones')
      .upsert(
        { alumno_id, fecha, cantidad: nuevoValor },
        { onConflict: ['alumno_id', 'fecha'] }
      )
  }

  const guardarAsistencias = async () => {
    const registros = Object.entries(asistencias).map(([alumno_id, estado]) => ({
      alumno_id,
      fecha,
      estado,
    }))
    
    const { error } = await supabase
      .from('asistencias')
      .upsert(registros, { onConflict: ['alumno_id', 'fecha'] })

    if (error) {
      alert('Error al guardar asistencias: ' + error.message)
    } else {
      alert('¡Asistencias guardadas exitosamente!')
      setPestaña('resumen')
    }
  }

  const exportarACSV = (tipo) => {
    let csvContent = "data:text/csv;charset=utf-8,"
    if (tipo === 'asistencia') {
      csvContent += "Apellido,Nombre,Estado,Fecha\n"
      resumenFecha.forEach((r) => {
        csvContent += `"${r.alumnos.apellido}","${r.alumnos.nombre}","${r.estado}","${fecha}"\n`
      })
    } else {
      csvContent += "Apellido,Nombre,Participaciones,Fecha\n"
      alumnos.forEach((a) => {
        const val = conteos[a.id] || 0
        csvContent += `"${a.apellido}","${a.nombre}",${val},"${fecha}"\n`
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `reporte_${tipo}_${fecha}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const cargarInformeAlumno = async (alumno) => {
    setAlumnoInforme(alumno)
    const { data: asis } = await supabase.from('asistencias').select('*').eq('alumno_id', alumno.id)
    const { data: conts } = await supabase.from('conteo_participaciones').select('*').eq('alumno_id', alumno.id)

    const totalPuntos = (conts || []).reduce((acc, curr) => acc + curr.cantidad, 0)
    setTotalParticipacionesAlumno(totalPuntos)

    setHistorialAlumno([
      ...(asis || []).map((a) => ({ fecha: a.fecha, tipo_reg: 'Asistencia', detalle: a.estado })),
      ...(conts || []).map((c) => ({ fecha: c.fecha, tipo_reg: 'Participaciones (Día)', detalle: c.cantidad })),
    ])
  }

  if (!autenticado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px', fontFamily: 'sans-serif' }}>
        <img 
          src={logoSrc} 
          alt="Logo Profe Fiori" 
          style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', marginBottom: '20px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' }} 
        />
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center' }}>PROFESOR FIORI NICOLAS</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '25px' }}>Panel Exclusivo de Administración</p>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            if (passwordInput === 'profe2026') {
              setAutenticado(true)
            } else {
              alert('Contraseña incorrecta')
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '300px', gap: '12px' }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              placeholder="Ingrese su contraseña"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ width: '100%', padding: '14px', paddingRight: '45px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6', fontSize: '16px', textAlign: 'center' }}
            />
            <button
              type="button"
              onClick={() => setMostrarPassword(!mostrarPassword)}
              style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '18px' }}
            >
              {mostrarPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <button
            type="submit"
            style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)' }}
          >
            Ingresar al Panel
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '12px' }}>
        <img 
          src={logoSrc} 
          alt="Logo" 
          style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }} 
        />
        <h1 style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '20px', margin: 0 }}>
          PROFESOR FIORI NICOLAS
        </h1>
      </div>

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

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setPestaña('asistencia')}
          style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'asistencia' ? '#2563eb' : '#1e293b', color: '#ffffff', border: pestaña === 'asistencia' ? '2px solid #60a5fa' : '1px solid #334155', fontWeight: 'bold', flex: 1, minWidth: '95px' }}
        >
          Tomar
        </button>
        <button
          onClick={() => setPestaña('resumen')}
          style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'resumen' ? '#2563eb' : '#1e293b', color: '#ffffff', border: pestaña === 'resumen' ? '2px solid #60a5fa' : '1px solid #334155', fontWeight: 'bold', flex: 1, minWidth: '95px' }}
        >
          Ver Asistencia
        </button>
        <button
          onClick={() => setPestaña('participacion')}
          style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'participacion' ? '#2563eb' : '#1e293b', color: '#ffffff', border: pestaña === 'participacion' ? '2px solid #60a5fa' : '1px solid #334155', fontWeight: 'bold', flex: 1, minWidth: '95px' }}
        >
          Participaciones
        </button>
        <button
          onClick={() => setPestaña('informe')}
          style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', backgroundColor: pestaña === 'informe' ? '#2563eb' : '#1e293b', color: '#ffffff', border: pestaña === 'informe' ? '2px solid #60a5fa' : '1px solid #334155', fontWeight: 'bold', flex: 1, minWidth: '95px' }}
        >
          Informes
        </button>
      </div>

      {pestaña === 'asistencia' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Tomar Asistencia ({alumnos.length} Alumnos) - {fecha}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li key={a.id} style={{ padding: '14px', marginBottom: '8px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                <span style={{ fontWeight: '500' }}>{a.apellido}, {a.nombre}</span>
                <button
                  onClick={() => toggleEstado(a.id)}
                  style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: asistencias[a.id] === 'PRESENTE' ? '#2563eb' : '#64748b', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {asistencias[a.id] || 'PENDIENTE'}
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={guardarAsistencias}
            style={{ width: '100%', padding: '16px', marginTop: '20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
          >
            Guardar Lista del Día
          </button>
        </div>
      )}

      {pestaña === 'resumen' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>Asistencia del día: {fecha}</h3>
            {resumenFecha.length > 0 && (
              <button
                onClick={() => exportarACSV('asistencia')}
                style={{ padding: '8px 12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
              >
                📥 Descargar Excel
              </button>
            )}
          </div>
          {resumenFecha.length === 0 ? (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', textAlign: 'center', border: '1px solid #334155' }}>
              <p style={{ color: '#94a3b8' }}>No hay registros guardados para este curso en la fecha seleccionada.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {resumenFecha.map((r, index) => (
                <li key={index} style={{ padding: '12px 14px', marginBottom: '8px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                  <span style={{ fontWeight: '500' }}>{r.alumnos.apellido}, {r.alumnos.nombre}</span>
                  <span style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: r.estado === 'PRESENTE' ? '#16a34a' : '#dc2626', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>
                    {r.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pestaña === 'participacion' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>Contador de Participaciones - {fecha}</h3>
            <button
              onClick={() => exportarACSV('participacion')}
              style={{ padding: '8px 12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              📥 Descargar Excel
            </button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => {
              const valor = conteos[a.id] || 0
              return (
                <li key={a.id} style={{ padding: '12px 14px', marginBottom: '8px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                  <span style={{ fontWeight: '500' }}>{a.apellido}, {a.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => cambiarConteo(a.id, -1)} style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '30px', textAlign: 'center', color: valor < 0 ? '#fca5a5' : valor > 0 ? '#86efac' : '#ffffff' }}>{valor}</span>
                    <button onClick={() => cambiarConteo(a.id, 1)} style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {pestaña === 'informe' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Informe y Estadísticas por Alumno</h3>
          <select
            onChange={(e) => {
              const alum = alumnos.find((a) => a.id.toString() === e.target.value)
              if (alum) cargarInformeAlumno(alum)
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', marginBottom: '20px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6' }}
          >
            <option value="">Seleccionar alumno...</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>
            ))}
          </select>

          {alumnoInforme && (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '15px' }}>Perfil de {alumnoInforme.nombre} {alumnoInforme.apellido}</h4>
              
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1, backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '13px' }}>Puntos Acumulados</span>
                  <span style={{ fontSize: '22px', fontWeight: 'bold', color: totalParticipacionesAlumno < 0 ? '#fca5a5' : '#86efac' }}>
                    {totalParticipacionesAlumno}
                  </span>
                </div>
              </div>

              <h5 style={{ color: '#cbd5e1', marginBottom: '10px' }}>Historial de Registros:</h5>
              {historialAlumno.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No hay registros guardados aún para este alumno.</p>
              ) : (
                <ul style={{ paddingLeft: '20px' }}>
                  {historialAlumno.map((h, index) => (
                    <li key={index} style={{ marginBottom: '6px', color: '#e2e8f0', fontSize: '14px' }}>
                      <strong>{h.fecha}</strong> - {h.tipo_reg}: <strong>{h.detalle}</strong>
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
