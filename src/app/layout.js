export const metadata = {
  title: 'Profe Fiori App',
  description: 'Panel de Asistencia y Gestión',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#0f172a' }}>
        {children}
      </body>
    </html>
  )
}
