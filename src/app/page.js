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
  
  // Estados para Registro de Clases y Cierre
  const [contenidoClase, setContenidoClase] = useState('')
  const [actividadesClase, setActividadesClase] = useState('')
  const [obsClase, setObsClase] = useState('')

  // Estados para Calificaciones e Informes
  const [calificacionesCurso, setCalificacionesCurso] = useState({})
  const [alumnoInforme, setAlumnoInforme] = useState(null)
  const [datosInformeDetallado, setDatosInformeDetallado] = useState({ asistencias: [], inasistencias: 0, porcentaje: 100, totalPos: 0, totalNeg: 0, balance: 0, notas: [], historialClases: [] })
  const [resumenFecha, setResumenFecha] = useState([])

  // Estado para Informe Colectivo del Curso
  const [estadisticasCurso, setEstadisticasCurso] = useState({ promedioAsistencia: 100, pibesEnAlerta: [], pibesDestacados: [], pibesEnNegativo: [] })

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
        alms.forEach((a) => (inicialesAsis[a.id] = 'PRESENTE'))
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

        const alumnoIds = alms.map(a => a.id)
        if (alumnoIds.length > 0) {
          const { data: cals } = await supabase
            .from('calificaciones')
            .select('*')
            .in('alumno_id', alumnoIds)
          
          const mapaCals = {}
          ;(cals || []).forEach(c => {
            if (!mapaCals[c.alumno_id]) mapaCals[c.alumno_id] = {}
            mapaCals[c.alumno_id][c.nucleo] = c
          })
          setCalificacionesCurso(mapaCals)
        }
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

        if (data) setResumenFecha(data)
      }
      cargarResumenPorFecha()
    }

    if (pestaña === 'informeCurso' && cursoSeleccionado && autenticado) {
      calcularEstadisticasCurso()
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

  // CIERRE DE CLASE AUTOMÁTICO (Guarda Asistencia + Puntos + Bitácora en un solo click)
  const ejecutarCierreDeClase = async () => {
    let cantPresentes = 0
    let cantAusentes = 0
    Object.values(asistencias).forEach(est => {
      if (est === 'PRESENTE') cantPresentes++
      else if (est === 'AUSENTE') cantAusentes++
    })

    let pos = 0
    let neg = 0
    Object.values(conteos).forEach(v => {
      if (v > 0) pos += v
      if (v < 0) neg += Math.abs(v)
    })

    // 1. Guardar Asistencias
    const registrosAsis = Object.entries(asistencias).map(([alumno_id, estado]) => ({
      alumno_id,
      fecha,
      estado,
    }))
    await supabase.from('asistencias').upsert(registrosAsis, { onConflict: ['alumno_id', 'fecha'] })

    // 2. Guardar Bitácora de Clase
    const { error } = await supabase.from('clases').insert([
      { 
        curso_id: cursoSeleccionado, 
        fecha, 
        contenido: contenidoClase || 'Clase regular', 
        actividades: actividadesClase, 
        observaciones: obsClase,
        presentes: cantPresentes,
        ausentes: cantAusentes,
        puntos_pos: pos,
        puntos_neg: neg
      }
    ])

    if (error) {
      alert('Error al realizar el cierre: ' + error.message)
    } else {
      alert(`¡Cierre de Clase Exitoso!\n\n👥 ${cantPresentes} Presentes | ❌ ${cantAusentes} Ausentes\n➕ ${pos} Puntos Positivos | ➖ ${neg} Puntos Negativos`)
      setContenidoClase('')
      setActividadesClase('')
      setObsClase('')
      setPestaña('informeCurso')
    }
  }

  const calcularEstadisticasCurso = async () => {
    const alumnoIds = alumnos.map(a => a.id)
    if (alumnoIds.length === 0) return

    const { data: todasAsis } = await supabase.from('asistencias').select('*').in('alumno_id', alumnoIds)
    const { data: todosConts } = await supabase.from('conteo_participaciones').select('*').in('alumno_id', alumnoIds)

    let sumaPorcentajes = 0
    const alertas = []
    const destacados = []
    const negativos = []

    alumnos.forEach(alm => {
      const asisAlm = (todasAsis || []).filter(a => a.alumno_id === alm.id)
      const inasistencias = asisAlm.filter(a => a.estado === 'AUSENTE').length
      const totalClases = asisAlm.length
      const pct = totalClases > 0 ? ((totalClases - inasistencias) / totalClases) * 100 : 100
      sumaPorcentajes += pct

      if (inasistencias >= 5 || pct < 75) {
        alertas.push({ nombre: `${alm.apellido}, ${alm.nombre}`, inasistencias, pct: Math.round(pct) })
      }

      const contsAlm = (todosConts || []).filter(c => c.alumno_id === alm.id)
      const balance = contsAlm.reduce((acc, curr) => acc + curr.cantidad, 0)

      if (balance >= 5) destacados.push({ nombre: `${alm.apellido}, ${alm.nombre}`, balance })
      if (balance < 0) negativos.push({ nombre: `${alm.apellido}, ${alm.nombre}`, balance })
    })

    const prom = alumnos.length > 0 ? Math.round(sumaPorcentajes / alumnos.length) : 100
    setEstadisticasCurso({ promedioAsistencia: prom, pibesEnAlerta: alertas, pibesDestacados: destacados, pibesEnNegativo: negativos })
  }

  const actualizarCalificacion = async (alumno_id, nucleo, campo, valor) => {
    const actual = calificacionesCurso[alumno_id]?.[nucleo] || { alumno_id, nucleo, nota_regular: null, recu_1: null, recu_2: null, nota_trabajos: null, nota_final: null }
    const actualizado = { ...actual, [campo]: valor === '' ? null : Number(valor) }

    setCalificacionesCurso(prev => ({
      ...prev,
      [alumno_id]: {
        ...(prev[alumno_id] || {}),
        [nucleo]: actualizado
      }
    }))

    await supabase.from('calificaciones').upsert(
      { alumno_id, nucleo, ...actualizado },
      { onConflict: ['alumno_id', 'nucleo'] }
    )
  }

  const exportarACSV = (tipo) => {
    let csvContent = "data:text/csv;charset=utf-8,"
    if (tipo === 'asistencia') {
      csvContent += "Apellido,Nombre,Estado,Fecha\n"
      if (resumenFecha.length > 0) {
        resumenFecha.forEach((r) => {
          csvContent += `"${r.alumnos.apellido}","${r.alumnos.nombre}","${r.estado}","${fecha}"\n`
        })
      } else {
        alumnos.forEach((a) => {
          csvContent += `"${a.apellido}","${a.nombre}","${asistencias[a.id] || 'PRESENTE'}","${fecha}"\n`
        })
      }
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

  const cargarInformeAlumnoCompleto = async (alumno) => {
    setAlumnoInforme(alumno)
    const { data: asis } = await supabase.from('asistencias').select('*').eq('alumno_id', alumno.id)
    const { data: conts } = await supabase.from('conteo_participaciones').select('*').eq('alumno_id', alumno.id)
    const { data: cals } = await supabase.from('calificaciones').select('*').eq('alumno_id', alumno.id)
    const { data: clss } = await supabase.from('clases').select('*').eq('curso_id', cursoSeleccionado)

    const totalAsis = (asis || []).filter(a => a.estado === 'PRESENTE').length
    const totalInas = (asis || []).filter(a => a.estado === 'AUSENTE').length
    const totalClasesReg = (asis || []).length
    const porcentaje = totalClasesReg > 0 ? Math.round((totalAsis / totalClasesReg) * 100) : 100

    const totalPos = (conts || []).reduce((acc, curr) => acc + (curr.cantidad > 0 ? curr.cantidad : 0), 0)
    const totalNeg = (conts || []).reduce((acc, curr) => acc + (curr.cantidad < 0 ? Math.abs(curr.cantidad) : 0), 0)
    const balance = totalPos - totalNeg

    setDatosInformeDetallado({
      asistencias: asis || [],
      inasistencias: totalInas,
      porcentaje,
      totalPos,
      totalNeg,
      balance,
      notas: cals || [],
      historialClases: clss || []
    })
  }

  if (!autenticado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px', fontFamily: 'sans-serif' }}>
        <img src={logoSrc} alt="Logo" style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', marginBottom: '20px' }} />
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center' }}>PROFESOR FIORI NICOLAS</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '25px' }}>Panel Exclusivo de Administración</p>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            if (passwordInput === 'profe2026') setAutenticado(true)
            else alert('Contraseña incorrecta')
          }}
          style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '300px', gap: '12px' }}
        >
          <input
            type={mostrarPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6', fontSize: '16px', textAlign: 'center' }}
          />
          <button type="submit" style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            Ingresar al Panel
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '850px', margin: 'auto', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '12px' }}>
        <img src={logoSrc} alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }} />
        <h1 style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '20px', margin: 0 }}>PROFESOR FIORI NICOLAS</h1>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <select
          value={cursoSeleccionado}
          onChange={(e) => setCursoSeleccionado(e.target.value)}
          style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6', flex: '1', minWidth: '180px' }}
        >
          {cursos.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
        </select>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6' }}
        />
      </div>

      {/* Menú de Pestañas con Cierre y Reporte Colectivo */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setPestaña('asistencia')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'asistencia' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '75px' }}>Tomar</button>
        <button onClick={() => setPestaña('resumen')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'resumen' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '75px' }}>Ver Asis</button>
        <button onClick={() => setPestaña('participacion')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'participacion' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '75px' }}>Puntos</button>
        <button onClick={() => setPestaña('cierreClase')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'cierreClase' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '85px' }}>⚡ Cierre</button>
        <button onClick={() => setPestaña('calificaciones')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'calificaciones' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '75px' }}>Notas</button>
        <button onClick={() => setPestaña('informe')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'informe' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '75px' }}>Alumno</button>
        <button onClick={() => setPestaña('informeCurso')} style={{ padding: '10px', borderRadius: '8px', backgroundColor: pestaña === 'informeCurso' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '12px', flex: 1, minWidth: '85px' }}>📊 Curso</button>
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
                  {asistencias[a.id] || 'PRESENTE'}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={guardarAsistencias} style={{ width: '100%', padding: '16px', marginTop: '20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            Guardar Lista del Día
          </button>
        </div>
      )}

      {pestaña === 'resumen' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>Asistencia - {fecha}</h3>
            <button onClick={() => exportarACSV('asistencia')} style={{ padding: '8px 12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              📥 Descargar Excel
            </button>
          </div>
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
        </div>
      )}

      {pestaña === 'participacion' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>Contador de Puntos - {fecha}</h3>
            <button onClick={() => exportarACSV('participacion')} style={{ padding: '8px 12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
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

      {/* CIERRE DE CLASE AUTOMÁTICO */}
      {pestaña === 'cierreClase' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '15px' }}>⚡ Cierre y Resumen de Clase - {fecha}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Presentes / Ausentes</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#86efac' }}>
                {Object.values(asistencias).filter(e => e === 'PRESENTE').length} ✅ / {Object.values(asistencias).filter(e => e === 'AUSENTE').length} ❌
              </span>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Puntos Otorgados</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>
                +{Object.values(conteos).filter(v => v > 0).reduce((a,b)=>a+b,0)} / -{Object.values(conteos).filter(v => v < 0).reduce((a,b)=>a+Math.abs(b),0)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '14px', color: '#cbd5e1' }}>Contenido Trabajado:</label>
              <input type="text" value={contenidoClase} onChange={(e) => setContenidoClase(e.target.value)} placeholder="Ej: Capacidades condicionales / Vóley" style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '5px' }} />
            </div>
            <div>
              <label style={{ fontSize: '14px', color: '#cbd5e1' }}>Actividades Realizadas:</label>
              <textarea value={actividadesClase} onChange={(e) => setActividadesClase(e.target.value)} placeholder="Ej: Estaciones de resistencia y saques..." style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '5px', height: '70px' }} />
            </div>
            <div>
              <label style={{ fontSize: '14px', color: '#cbd5e1' }}>Observaciones del Día:</label>
              <input type="text" value={obsClase} onChange={(e) => setObsClase(e.target.value)} placeholder="Ej: Excelente predisposición del grupo" style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '5px' }} />
            </div>

            <button onClick={ejecutarCierreDeClase} style={{ padding: '16px', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px', fontSize: '16px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)' }}>
              🔒 Confirmar y Guardar Todo el Cierre
            </button>
          </div>
        </div>
      )}

      {/* TABLERO DE INFORMES DEL CURSO */}
      {pestaña === 'informeCurso' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '15px' }}>📊 Estadísticas Colectivas del Curso</h3>
          
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', border: '1px solid #334155' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px', display: 'block' }}>Presentismo Promedio del Curso</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#86efac' }}>{estadisticasCurso.promedioAsistencia}%</span>
          </div>

          <h4 style={{ color: '#fca5a5', marginBottom: '10px' }}>⚠️ Alumnos en Alerta (Inasistencias &lt; 75% o &gt;= 5 faltas):</h4>
          {estadisticasCurso.pibesEnAlerta.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px' }}>Sin alumnos en situación crítica de inasistencias.</p>
          ) : (
            <ul style={{ paddingLeft: '18px', marginBottom: '15px' }}>
              {estadisticasCurso.pibesEnAlerta.map((p, idx) => (
                <li key={idx} style={{ color: '#fca5a5', fontSize: '14px', marginBottom: '4px' }}>
                  <strong>{p.nombre}</strong> — {p.inasistencias} Inasistencias ({p.pct}% Asist)
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ color: '#86efac', marginBottom: '10px' }}>🌟 Alumnos Destacados (Balance Puntos &gt;= +5):</h4>
          {estadisticasCurso.pibesDestacados.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px' }}>Sin alumnos destacados aún en puntos.</p>
          ) : (
            <ul style={{ paddingLeft: '18px', marginBottom: '15px' }}>
              {estadisticasCurso.pibesDestacados.map((p, idx) => (
                <li key={idx} style={{ color: '#86efac', fontSize: '14px', marginBottom: '4px' }}>
                  <strong>{p.nombre}</strong> — Balance: +{p.balance}
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ color: '#fca5a5', marginBottom: '10px' }}>🔻 Alumnos con Balance Negativo:</h4>
          {estadisticasCurso.pibesEnNegativo.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>Ningún alumno con balance negativo.</p>
          ) : (
            <ul style={{ paddingLeft: '18px' }}>
              {estadisticasCurso.pibesEnNegativo.map((p, idx) => (
                <li key={idx} style={{ color: '#fca5a5', fontSize: '14px', marginBottom: '4px' }}>
                  <strong>{p.nombre}</strong> — Balance: {p.balance}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pestaña === 'calificaciones' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '15px' }}>Calificaciones por Núcleos (1 al 6)</h3>
          {alumnos.map((a) => (
            <div key={a.id} style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #334155' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '10px' }}>{a.apellido}, {a.nombre}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3, 4, 5, 6].map((nuc) => {
                  const reg = calificacionesCurso[a.id]?.[nuc] || {}
                  return (
                    <div key={nuc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#cbd5e1', minWidth: '70px' }}>Núcleo {nuc}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Reg:</span>
                        <input type="number" step="0.1" value={reg.nota_regular ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'nota_regular', e.target.value)} style={{ width: '50px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Rec1:</span>
                        <input type="number" step="0.1" value={reg.recu_1 ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'recu_1', e.target.value)} style={{ width: '50px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Rec2:</span>
                        <input type="number" step="0.1" value={reg.recu_2 ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'recu_2', e.target.value)} style={{ width: '50px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Trab:</span>
                        <input type="number" step="0.1" value={reg.nota_trabajos ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'nota_trabajos', e.target.value)} style={{ width: '50px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold' }}>Final:</span>
                        <input type="number" step="0.1" value={reg.nota_final ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'nota_final', e.target.value)} style={{ width: '55px', padding: '4px', textAlign: 'center', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pestaña === 'informe' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Informe Completo por Alumno</h3>
          <select
            onChange={(e) => {
              const alum = alumnos.find((a) => a.id.toString() === e.target.value)
              if (alum) cargarInformeAlumnoCompleto(alum)
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', fontSize: '16px', marginBottom: '20px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6' }}
          >
            <option value="">Seleccionar alumno...</option>
            {alumnos.map((a) => (<option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>))}
          </select>

          {alumnoInforme && (
            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '15px' }}>Legajo de {alumnoInforme.nombre} {alumnoInforme.apellido}</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '12px' }}>Presentismo</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#86efac' }}>{datosInformeDetallado.porcentaje}%</span>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '12px' }}>Inasistencias</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fca5a5' }}>{datosInformeDetallado.inasistencias}</span>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '12px' }}>Ptos (+) / (-)</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>+{datosInformeDetallado.totalPos} / -{datosInformeDetallado.totalNeg}</span>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: '12px' }}>Balance Puntos</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: datosInformeDetallado.balance < 0 ? '#fca5a5' : '#86efac' }}>{datosInformeDetallado.balance}</span>
                </div>
              </div>

              <h5 style={{ color: '#cbd5e1', marginBottom: '8px' }}>Calificaciones por Núcleos:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                {datosInformeDetallado.notas.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>Sin calificaciones cargadas aún.</p>
                ) : (
                  datosInformeDetallado.notas.map((n) => (
                    <div key={n.id} style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>Núcleo {n.nucleo}</strong> (Trabajos: {n.nota_trabajos ?? '-'})</span>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>Nota Final: {n.nota_final ?? 'Sin cerrar'}</span>
                    </div>
                  ))
                )}
              </div>

              <h5 style={{ color: '#cbd5e1', marginBottom: '8px' }}>Historial de Clases del Curso:</h5>
              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: '#cbd5e1' }}>
                {datosInformeDetallado.historialClases.map((cls) => (
                  <li key={cls.id} style={{ marginBottom: '5px' }}>
                    <strong>{cls.fecha}</strong>: {cls.contenido || 'Sin contenido'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
