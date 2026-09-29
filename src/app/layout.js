import './globals.css'

export const metadata = {
  title: 'Profe Fiori App',
  description: 'Panel de Asistencia y Participaciones',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
