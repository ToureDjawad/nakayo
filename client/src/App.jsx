import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes.jsx'

const routeur = createBrowserRouter(routes)

export default function App() {
  return <RouterProvider router={routeur} />
}
