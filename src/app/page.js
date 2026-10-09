'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)

  const [modoAuth, setModoAuth] = useState('login')
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [nombreInput, setNombreInput] = useState('')

  const [cursos, setCursos] = useState([])
  const [cursoSeleccionado, setCursoSeleccionado] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})
  const [conteos, setConteos] = useState({}) 
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [pestaña, setPestaña] = useState('asistencia')

  const [contenidoClase, setContenidoClase] = useState('')
  const [actividadesClase, setActividadesClase] = useState('')
  const [obsClase, setObsClase] = useState('')

  const [calificacionesCurso, setCalificacionesCurso] = useState({})
  const [resumenFecha, setResumenFecha] = useState([])
  const [alumnoInformeId, setAlumnoInformeId] = useState('')
  const [historialAlumno, setHistorialAlumno] = useState([])

  const [nuevoCursoNombre, setNuevoCursoNombre] = useState('')
  const [nuevoAlumnoApellido, setNuevoAlumnoApellido] = useState('')
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('')
  const [textoCargaMasiva, setTextoCargaMasiva] = useState('')

  const [anuncioActivo, setAnuncioActivo] = useState('')
  const [nuevoAnuncioAdmin, setNuevoAnuncioAdmin] = useState('')
  const [listaProfesAdmin, setListaProfesAdmin] = useState([])

  const logoSrc = "/icon.png"
  const MI_WHATSAPP = "5493510000000"

  useEffect(() => {
    async function verificarSesion() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUsuario(session.user)
        await cargarPerfil(session.user.id)
      }
      setCargandoSesion(false)
    }
    verificarSesion()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUsuario(session.user)
        await cargarPerfil(session.user.id)
      } else {
        setUsuario(null)
        setPerfil(null)
      }
      setCargandoSesion(false)
    })

    cargarAnuncioGlobal()
    return () => authListener.subscription.unsubscribe()
  }, [])

  const cargarPerfil = async (uid) => {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    if (data) setPerfil(data)
  }

  const cargarAnuncioGlobal = async () => {
    const { data } = await supabase.from('anuncios_admin').select('*').eq('activo', true).order('created_at', { ascending: false }).limit(1)
    if (data && data.length > 0) setAnuncioActivo(data[0].mensaje)
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    if (modoAuth === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passInput })
      if (error) alert('Error: ' + error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email: emailInput, password: passInput })
      if (error) {
        alert('Error: ' + error.message)
      } else if (data.user) {
        await supabase.from('perfiles').insert([
          { id: data.user.id, nombre_completo: nombreInput, rol: 'profe', estado_suscripcion: 'activo', vence_el: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
        ])
        alert('¡Cuenta creada con éxito!')
      }
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    setPerfil(null)
  }

  useEffect(() => {
    if (!usuario) return
    async function cargarCursos() {
      const { data } = await supabase.from('cursos').select('*').order('nombre')
      if (data && data.length > 0) {
        setCursos(data)
        setCursoSeleccionado(data[0].id)
      } else {
        setCursos([])
        setCursoSeleccionado('')
      }
    }
    cargarCursos()
  }, [usuario])

  useEffect(() => {
    if (!cursoSeleccionado || !usuario) return
    async function cargarDatosCurso() {
      const { data: alms } = await supabase.from('alumnos').select('*').eq('curso_id', cursoSeleccionado).order('apellido')
      if (alms) {
        setAlumnos(alms)
        if (alms.length > 0) setAlumnoInformeId(alms[0].id)
        const inicialesAsis = {}
        alms.forEach((a) => (inicialesAsis[a.id] = 'PRESENTE'))
        setAsistencias(inicialesAsis)

        const { data: conts } = await supabase.from('conteo_participaciones').select('*').eq('fecha', fecha)
        const mapaConteos = {}
        alms.forEach((a) => {
          const encontrado = conts?.find((c) => c.alumno_id === a.id)
          mapaConteos[a.id] = encontrado ? encontrado.cantidad : 0
        })
        setConteos(mapaConteos)

        const alumnoIds = alms.map(a => a.id)
        if (alumnoIds.length > 0) {
          const { data: cals } = await supabase.from('calificaciones').select('*').in('alumno_id', alumnoIds)
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
  }, [cursoSeleccionado, fecha, usuario])

  useEffect(() => {
    if (pestaña === 'resumen' && cursoSeleccionado && usuario) {
      async function cargarResumenPorFecha() {
        const { data } = await supabase.from('asistencias').select('*, alumnos!inner(curso_id, apellido, nombre)').eq('fecha', fecha).eq('alumnos.curso_id', cursoSeleccionado)
        if (data) setResumenFecha(data)
      }
      cargarResumenPorFecha()
    }
  }, [pestaña, fecha, cursoSeleccionado, usuario])

  useEffect(() => {
    if (pestaña === 'informeAlumno' && alumnoInformeId) {
      async function cargarHistorialAlumno() {
        const { data: asis } = await supabase.from('asistencias').select('*').eq('alumno_id', alumnoInformeId)
        const { data: pts } = await supabase.from('conteo_participaciones').select('*').eq('alumno_id', alumnoInformeId)
        setHistorialAlumno({ asistencias: asis || [], puntos: pts || [] })
      }
      cargarHistorialAlumno()
    }
  }, [pestaña, alumnoInformeId])

  useEffect(() => {
    if (perfil?.rol === 'admin' && pestaña === 'adminPanel') {
      cargarProfesAdmin()
    }
  }, [pestaña, perfil])

  const cargarProfesAdmin = async () => {
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false })
    if (data) setListaProfesAdmin(data)
  }

  const extenderSuscripcionAdmin = async (id, dias) => {
    const { data: p } = await supabase.from('perfiles').select('vence_el').eq('id', id).single()
    const fechaBase = p?.vence_el && new Date(p.vence_el) > new Date() ? new Date(p.vence_el) : new Date()
    fechaBase.setDate(fechaBase.getDate() + dias)
    const nuevaFecha = fechaBase.toISOString().split('T')[0]

    await supabase.from('perfiles').update({ vence_el: nuevaFecha, estado_suscripcion: 'activo' }).eq('id', id)
    alert(`Suscripción extendida ${dias} días`)
    cargarProfesAdmin()
  }

  const publicarAnuncioAdmin = async () => {
    if (!nuevoAnuncioAdmin.trim()) return
    await supabase.from('anuncios_admin').update({ activo: false }).neq('id', 0)
    await supabase.from('anuncios_admin').insert([{ mensaje: nuevoAnuncioAdmin, activo: true }])
    setAnuncioActivo(nuevoAnuncioAdmin)
    setNuevoAnuncioAdmin('')
    alert('Anuncio publicado')
  }

  const crearCurso = async () => {
    if (cursos.length >= 20 && perfil?.rol !== 'admin') {
      alert('Límite de 20 cursos alcanzado.')
      return
    }
    if (!nuevoCursoNombre.trim()) return
    const { data, error } = await supabase.from('cursos').insert([{ nombre: nuevoCursoNombre, user_id: usuario.id }]).select()
    if (!error && data) {
      setCursos([...cursos, data[0]])
      setCursoSeleccionado(data[0].id)
      setNuevoCursoNombre('')
    }
  }

  const eliminarCurso = async (id) => {
    if (confirm('¿Eliminar este curso?')) {
      await supabase.from('cursos').delete().eq('id', id)
      const restantes = cursos.filter(c => c.id !== id)
      setCursos(restantes)
      if (restantes.length > 0) setCursoSeleccionado(restantes[0].id)
      else setCursoSeleccionado('')
    }
  }

  const agregarAlumnoIndividual = async () => {
    if (alumnos.length >= 60 && perfil?.rol !== 'admin') {
      alert('Límite de 60 alumnos alcanzado.')
      return
    }
    if (!nuevoAlumnoApellido.trim() || !nuevoAlumnoNombre.trim()) return
    const { data, error } = await supabase.from('alumnos').insert([
      { apellido: nuevoAlumnoApellido, nombre: nuevoAlumnoNombre, curso_id: cursoSeleccionado, user_id: usuario.id }
    ]).select()

    if (!error && data) {
      setAlumnos([...alumnos, data[0]])
      setNuevoAlumnoApellido('')
      setNuevoAlumnoNombre('')
    }
  }

  const procesarCargaMasiva = async () => {
    const lineas = textoCargaMasiva.split('\n').filter(l => l.trim() !== '')
    if (alumnos.length + lineas.length > 60 && perfil?.rol !== 'admin') {
      alert('Supera el límite de 60 alumnos por curso.')
      return
    }

    const nuevosAlumnos = lineas.map(linea => {
      let ap = linea.trim()
      let nom = 'Alumno'
      if (linea.includes(',')) {
        const partes = linea.split(',')
        ap = partes[0].trim()
        nom = partes[1].trim()
      } else if (linea.includes(' ')) {
        const partes = linea.split(' ')
        ap = partes[0].trim()
        nom = partes.slice(1).join(' ').trim()
      }
      return { apellido: ap, nombre: nom, curso_id: cursoSeleccionado, user_id: usuario.id }
    })

    const { data, error } = await supabase.from('alumnos').insert(nuevosAlumnos).select()
    if (!error && data) {
      setAlumnos([...alumnos, ...data])
      setTextoCargaMasiva('')
      alert(`¡Se agregaron ${data.length} alumnos!`)
    }
  }

  const eliminarAlumno = async (id) => {
    if (confirm('¿Dar de baja a este alumno?')) {
      await supabase.from('alumnos').delete().eq('id', id)
      setAlumnos(alumnos.filter(a => a.id !== id))
    }
  }

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

    await supabase.from('conteo_participaciones').upsert({ alumno_id, fecha, cantidad: nuevoValor }, { onConflict: ['alumno_id', 'fecha'] })
  }

  const guardarAsistencias = async () => {
    const registros = Object.entries(asistencias).map(([alumno_id, estado]) => ({ alumno_id, fecha, estado }))
    const { error } = await supabase.from('asistencias').upsert(registros, { onConflict: ['alumno_id', 'fecha'] })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('¡Asistencias guardadas!')
      setPestaña('resumen')
    }
  }

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

    const registrosAsis = Object.entries(asistencias).map(([alumno_id, estado]) => ({ alumno_id, fecha, estado }))
    await supabase.from('asistencias').upsert(registrosAsis, { onConflict: ['alumno_id', 'fecha'] })

    const { error } = await supabase.from('clases').insert([
      { curso_id: cursoSeleccionado, fecha, contenido: contenidoClase || 'Clase regular', actividades: actividadesClase, observaciones: obsClase, presentes: cantPresentes, ausentes: cantAusentes, puntos_pos: pos, puntos_neg: neg, user_id: usuario.id }
    ])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert(`¡Cierre Exitoso!\n👥 ${cantPresentes} Presentes | ❌ ${cantAusentes} Ausentes`)
      setContenidoClase('')
      setActividadesClase('')
      setObsClase('')
      setPestaña('resumen')
    }
  }

  const actualizarCalificacion = async (alumno_id, nucleo, campo, valor) => {
    const actual = calificacionesCurso[alumno_id]?.[nucleo] || { alumno_id, nucleo, nota_regular: null, recu_1: null, recu_2: null, nota_trabajos: null, nota_final: null }
    const actualizado = { ...actual, [campo]: valor === '' ? null : Number(valor) }

    setCalificacionesCurso(prev => ({ ...prev, [alumno_id]: { ...(prev[alumno_id] || {}), [nucleo]: actualizado } }))
    await supabase.from('calificaciones').upsert({ alumno_id, nucleo, ...actualizado }, { onConflict: ['alumno_id', 'nucleo'] })
  }

  if (cargandoSesion) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#ffffff', fontFamily: 'sans-serif' }}><h2>Cargando...</h2></div>
  }

  if (!usuario) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px', fontFamily: 'sans-serif' }}>
        <img src={logoSrc} alt="Logo" style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', marginBottom: '15px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>PROFE FIORI APP</h1>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '25px' }}>Gestión para Profesores</p>

        <form onSubmit={handleAuth} style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155' }}>
          {modoAuth === 'registro' && (
            <div>
              <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Nombre y Apellido</label>
              <input type="text" required value={nombreInput} onChange={(e) => setNombreInput(e.target.value)} placeholder="Ej: Nicolás Fiori" style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '4px' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Correo Electrónico</label>
            <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="profe@ejemplo.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>Contraseña</label>
            <input type="password" required value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', marginTop: '4px' }} />
          </div>

          <button type="submit" style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '10px' }}>
            {modoAuth === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>

          <p onClick={() => setModoAuth(modoAuth === 'login' ? 'registro' : 'login')} style={{ fontSize: '13px', color: '#60a5fa', textAlign: 'center', cursor: 'pointer', marginTop: '10px', textDecoration: 'underline' }}>
            {modoAuth === 'login' ? '¿No tenés cuenta? Registrate acá' : '¿Ya tenés cuenta? Iniciá sesión'}
          </p>
        </form>
      </div>
    )
  }

  const diasRestantes = perfil?.vence_el ? Math.ceil((new Date(perfil.vence_el) - new Date()) / (1000 * 60 * 60 * 24)) : 30
  const suscripcionVencida = diasRestantes <= 0 && perfil?.rol !== 'admin'

  if (suscripcionVencida) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#fca5a5', fontSize: '24px', marginBottom: '10px' }}>⚠️ Suscripción Vencida</h2>
        <p style={{ color: '#cbd5e1', maxWidth: '400px', marginBottom: '20px' }}>
          Hola <strong>{perfil?.nombre_completo}</strong>. Tu suscripción ha caducado. Envía tu comprobante de pago para renovar el servicio.
        </p>
        <a href={`https://wa.me/${MI_WHATSAPP}?text=Hola%20Profe%20Fiori,%20te%20env%C3%ADo%20el%20comprobante.`} target="_blank" rel="noreferrer" style={{ padding: '14px 24px', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', borderRadius: '8px', textDecoration: 'none', fontSize: '16px' }}>
          📱 Enviar Comprobante por WhatsApp
        </a>
        <button onClick={cerrarSesion} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Cerrar Sesión</button>
      </div>
    )
                      }
                                                    return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '850px', margin: 'auto', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh' }}>
      
      {anuncioActivo && (
        <div style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', border: '1px solid #3b82f6' }}>
          📢 <strong>Aviso:</strong> {anuncioActivo}
        </div>
      )}

      {diasRestantes <= 5 && perfil?.rol !== 'admin' && (
        <div style={{ backgroundColor: '#854d0e', color: '#fef08a', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' }}>
          ⏰ <strong>¡Atención!</strong> Tu suscripción vence en {diasRestantes} días.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '12px' }}>
        <div>
          <h1 style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px', margin: 0 }}>PROFE: {(perfil?.nombre_completo || usuario.email).toUpperCase()}</h1>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{usuario.email} {perfil?.rol === 'admin' && '👑 (ADMIN)'}</span>
        </div>
        <button onClick={cerrarSesion} style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#fca5a5', border: '1px solid #dc2626', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Salir</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <select value={cursoSeleccionado} onChange={(e) => setCursoSeleccionado(e.target.value)} style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6', flex: '1', minWidth: '180px' }}>
          {cursos.length === 0 ? <option value="">Sin cursos</option> : cursos.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
        </select>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ padding: '12px', borderRadius: '8px', fontSize: '15px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #3b82f6' }} />
      </div>

      {/* Botones de navegación con Informe Alumno e Informe Curso */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setPestaña('asistencia')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'asistencia' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>Tomar</button>
        <button onClick={() => setPestaña('resumen')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'resumen' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>Ver Asis</button>
        <button onClick={() => setPestaña('participacion')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'participacion' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>Puntos</button>
        <button onClick={() => setPestaña('cierreClase')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'cierreClase' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>⚡ Cierre</button>
        <button onClick={() => setPestaña('calificaciones')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'calificaciones' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>Notas</button>
        <button onClick={() => setPestaña('informeAlumno')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'informeAlumno' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>👤 Inf. Alumno</button>
        <button onClick={() => setPestaña('informeCurso')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'informeCurso' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>📊 Inf. Curso</button>
        <button onClick={() => setPestaña('gestion')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'gestion' ? '#2563eb' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>⚙️ Cursos</button>
        {perfil?.rol === 'admin' && (
          <button onClick={() => setPestaña('adminPanel')} style={{ padding: '8px 6px', borderRadius: '6px', backgroundColor: pestaña === 'adminPanel' ? '#16a34a' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '11px', flex: 1 }}>👑 Admin</button>
        )}
      </div>

      {pestaña === 'asistencia' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Tomar Asistencia ({alumnos.length} Alumnos) - {fecha}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alumnos.map((a) => (
              <li key={a.id} style={{ padding: '14px', marginBottom: '8px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                <span style={{ fontWeight: '500' }}>{a.apellido}, {a.nombre}</span>
                <button onClick={() => toggleEstado(a.id)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: asistencias[a.id] === 'PRESENTE' ? '#2563eb' : '#64748b', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
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
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Asistencia Registrada - {fecha}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {resumenFecha.map((r, index) => (
              <li key={index} style={{ padding: '12px 14px', marginBottom: '8px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                <span style={{ fontWeight: '500' }}>{r.alumnos.apellido}, {r.alumnos.nombre}</span>
                <span style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: r.estado === 'PRESENTE' ? '#16a34a' : '#dc2626', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>{r.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pestaña === 'participacion' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '10px' }}>Contador de Puntos - {fecha}</h3>
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
            <input type="text" value={contenidoClase} onChange={(e) => setContenidoClase(e.target.value)} placeholder="Contenido trabajado..." style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }} />
            <textarea value={actividadesClase} onChange={(e) => setActividadesClase(e.target.value)} placeholder="Actividades..." style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', height: '60px' }} />
            <input type="text" value={obsClase} onChange={(e) => setObsClase(e.target.value)} placeholder="Observaciones..." style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }} />
            <button onClick={ejecutarCierreDeClase} style={{ padding: '16px', backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>🔒 Confirmar y Guardar Cierre</button>
          </div>
        </div>
      )}

      {/* Calificaciones con la casilla Rec2 agregada */}
      {pestaña === 'calificaciones' && (
        <div>
          <h3 style={{ color: '#93c5fd', marginBottom: '15px' }}>Calificaciones por Núcleos</h3>
          {alumnos.map((a) => (
            <div key={a.id} style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #334155' }}>
              <h4 style={{ color: '#60a5fa', marginBottom: '10px' }}>{a.apellido}, {a.nombre}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3, 4, 5, 6].map((nuc) => {
                  const reg = calificacionesCurso[a.id]?.[nuc] || {}
                  return (
                    <div key={nuc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 'bold', color: '#cbd5e1' }}>Núcleo {nuc}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Reg:</span>
                        <input type="number" step="0.1" value={reg.nota_regular ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'nota_regular', e.target.value)} style={{ width: '40px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Rec1:</span>
                        <input type="number" step="0.1" value={reg.recu_1 ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'recu_1', e.target.value)} style={{ width: '40px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Rec2:</span>
                        <input type="number" step="0.1" value={reg.recu_2 ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'recu_2', e.target.value)} style={{ width: '40px', padding: '4px', textAlign: 'center', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }} />
                        <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 'bold' }}>Final:</span>
                        <input type="number" step="0.1" value={reg.nota_final ?? ''} onChange={(e) => actualizarCalificacion(a.id, nuc, 'nota_final', e.target.value)} style={{ width: '45px', padding: '4px', textAlign: 'center', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pestaña Informe Alumno */}
      {pestaña === 'informeAlumno' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '15px' }}>👤 Informe Individual por Alumno</h3>
          <select value={alumnoInformeId} onChange={(e) => setAlumnoInformeId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #3b82f6', marginBottom: '15px' }}>
            {alumnos.map(a => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>)}
          </select>

          {alumnoInformeId && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Asistencia Total</span>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#86efac', margin: '5px 0 0 0' }}>
                    {historialAlumno.asistencias?.filter(a => a.estado === 'PRESENTE').length || 0} Pres. / {historialAlumno.asistencias?.filter(a => a.estado === 'AUSENTE').length || 0} Aus.
                  </p>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Puntos Acumulados</span>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#60a5fa', margin: '5px 0 0 0' }}>
                    {historialAlumno.puntos?.reduce((a, b) => a + (b.cantidad || 0), 0) || 0} pts
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pestaña Informe Curso */}
      {pestaña === 'informeCurso' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '15px' }}>📊 Informe General del Curso</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Total Alumnos</span>
              <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#3b82f6', margin: '5px 0 0 0' }}>{alumnos.length}</p>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Estado Curso</span>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80', margin: '5px 0 0 0' }}>Activo</p>
            </div>
          </div>
        </div>
      )}

      {pestaña === 'gestion' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#60a5fa', marginBottom: '15px' }}>⚙️ Gestión de Cursos y Alumnos</h3>
          <div style={{ marginBottom: '20px', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#cbd5e1', marginBottom: '8px' }}>Crear Nuevo Curso (Max 20)</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={nuevoCursoNombre} onChange={(e) => setNuevoCursoNombre(e.target.value)} placeholder="Ej: 4° B" style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155' }} />
              <button onClick={crearCurso} style={{ padding: '10px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
            </div>
            {cursoSeleccionado && (
              <button onClick={() => eliminarCurso(cursoSeleccionado)} style={{ marginTop: '10px', padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                🗑️ Eliminar Curso Seleccionado
              </button>
            )}
          </div>

          {cursoSeleccionado && (
            <>
              <div style={{ marginBottom: '20px', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px' }}>
                <h4 style={{ color: '#cbd5e1', marginBottom: '8px' }}>Agregar Alumno Individual (Max 60)</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input type="text" value={nuevoAlumnoApellido} onChange={(e) => setNuevoAlumnoApellido(e.target.value)} placeholder="Apellido" style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155' }} />
                  <input type="text" value={nuevoAlumnoNombre} onChange={(e) => setNuevoAlumnoNombre(e.target.value)} placeholder="Nombre" style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155' }} />
                  
