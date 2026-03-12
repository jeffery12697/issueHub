import { BrowserRouter } from 'react-router-dom'
import AppRouter from './router'
import Toaster from '@/components/Toaster'

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
      <Toaster />
    </BrowserRouter>
  )
}
