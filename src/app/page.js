'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)

  // Auth States
  const [modoAuth, setModoAuth] = useState('login')
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [nombreInput, setNombreInput] = useState('')

  // App Data
  const [cursos, setCursos] = useState([])
  const [cursoSeleccionado, setCursoSeleccionado] = useState('')
  const [alumnos, setAlumnos] = useState([])
  const [asistencias, setAsistencias] = useState({})
  const [conteos, setConteos] = useState({}) 
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [pestaña, setPestaña] = useState('asistencia')

  // Bitácora y Cierre
  const [contenidoClase, setContenidoClase] = useState('')
  const [actividadesClase, setActividadesClase] = useState('')
  const [obsClase, setObsClase] = useState('')

  // Calificaciones e Informes
  const [calificacionesCurso, setCalificacionesCurso] = useState({})
  const [alumnoInforme, setAlumnoInforme] = useState(null)
  const [datosInformeDetallado, setDatosInformeDetallado] = useState({ asistencias: [], inasistencias: 0, porcentaje: 100, totalPos: 0, totalNeg: 0, balance: 0, notas: [], historialClases: [] })
  const [resumenFecha, setResumenFecha] = useState([])
  const [estadisticasCurso, setEstadisticasCurso] = useState({ promedioAsistencia: 100, pibesEnAlerta: [], pibesDestacados: [], pibesEnNegativo: [] })

  // Gestión de Cursos y Alumnos
  const [nuevoCursoNombre, setNuevoCursoNombre] = useState('')
  const [nuevoAlumnoApellido, setNuevoAlumnoApellido] = useState('')
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = useState('')
  const [textoCargaMasiva, setTextoCargaMasiva] = useState('')

  // Admin
  const [anuncioActivo, setAnuncioActivo] = useState('')
  const [nuevoAnuncioAdmin, setNuevoAnuncioAdmin] = useState('')
  const [listaProfesAdmin, setListaProfesAdmin] = useState([])

  const logoSrc = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=150&auto=format&fit=crop&q=80"
  const MI_WHATSAPP = "5493510000000"

  // 1. Control de Sesión
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
      if (error) alert('Error al iniciar sesión: ' + error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email: emailInput, password: passInput })
      if (error) {
        alert('Error al registrarse: ' + error.message)
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

  // Cargar Cursos
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

  // Cargar Alumnos y Datos del Curso
  useEffect(() => {
    if (!cursoSeleccionado || !usuario) return
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
  }, [cursoSeleccionado, fecha, usuario])

  // Cargar Resumen e Informes
  useEffect(() => {
    if (pestaña === 'resumen' && cursoSeleccionado && usuario) {
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

    if (pestaña === 'informeCurso' && cursoSeleccionado && usuario) {
      calcularEstadisticasCurso()
    }
  }, [pestaña, fecha, cursoSeleccionado, usuario])

  // Admin Data
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
    alert(`Suscripción extendida ${dias} días hasta el ${nuevaFecha}`)
    cargarProfesAdmin()
  }

  const publicarAnuncioAdmin = async () => {
    if (!nuevoAnuncioAdmin.trim()) return
    await supabase.from('anuncios_admin').update({ activo: false }).neq('id', 0)
    await supabase.from('anuncios_admin').insert([{ mensaje: nuevoAnuncioAdmin, activo: true }])
    setAnuncioActivo(nuevoAnuncioAdmin)
    setNuevoAnuncioAdmin('')
    alert('Anuncio publicado a todos los profes')
  }

  // Cursos y Alumnos
  const crearCurso = async () => {
    if (cursos.length >= 20 && perfil?.rol !== 'admin') {
      alert('Has alcanzado el límite de 20 cursos.')
      return
    }
    if (!nuevoCursoNombre.trim()) return
    const { data, error } = await supabase.from('cursos').insert([{ nombre: nuevoCursoNombre, user_id: usuario.id }]).select()
    if (!error && data) {
      setCursos([...cursos, data[0]])
      setCursoSeleccionado(data[0].id)
      setNuevoCursoNombre('')
      alert('Curso creado con éxito')
    }
  }

  const eliminarCurso = async (id) => {
    if (confirm('¿Eliminar este curso y todos sus alumnos?')) {
      await supabase.from('cursos').delete().eq('id', id)
      const restantes = cursos.filter(c => c.id !== id)
      setCursos(restantes)
      if (restantes.length > 0) setCursoSeleccionado(restantes[0].id)
      else setCursoSeleccionado('')
    }
  }

  const agregarAlumnoIndividual = async () => {
    if (alumnos.length >= 60 && perfil?.rol !== 'admin') {
      alert('Has alcanzado el límite de 60 alumnos.')
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
      alert(`No podés superar los 60 alumnos por curso.`)
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
      alert(`¡Se agregaron ${data.length} alumnos correctamente!`)
    }
  }

  const eliminarAlumno = async (id) => {
    if (confirm('¿Dar de baja a este alumno?')) {
      await supabase.from('alumnos').delete().eq('id', id)
      setAlumnos(alumnos.filter(a => a.id !== id))
    }
  }

  // Operaciones Lista
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

    const registrosAsis = Object.entries(asistencias).map(([alumno_id, estado]) => ({
      alumno_id,
      fecha,
      estado,
    }))
    await supabase.from('asistencias').upsert(registrosAsis, { onConflict: ['alumno_id', 'fecha'] })

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
        puntos_neg: neg,
        user_id: usuario.id
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

  if (cargandoSesion) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#ffffff', fontFamily: 'sans-serif' }}>
        <h2>Cargando aplicación...</h2>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: '20px', fontFamily: 'sans-serif' }}>
        <img src={logoSrc} alt="Logo" style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', marginBottom: '15px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>PROFE FIORI APP</h1>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '25px' }}>Gestión para Profesores de Educación Física</p>

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
            {modoAuth === 'login' ? '¿No tenés cuenta? Registrate acá' : '¿Ya tenés cuenta? Iniciá sesión'
