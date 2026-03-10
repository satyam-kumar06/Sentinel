import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import MonitorPage from './pages/MonitorPage'
import AssessPage from './pages/AssessPage'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 }
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <motion.div {...pageVariants} transition={{ duration: 0.25 }}>
            <DashboardPage />
          </motion.div>
        }/>
        <Route path="/monitor" element={
          <motion.div {...pageVariants} transition={{ duration: 0.25 }}>
            <MonitorPage />
          </motion.div>
        }/>
        <Route path="/assess" element={
          <motion.div {...pageVariants} transition={{ duration: 0.25 }}>
            <AssessPage />
          </motion.div>
        }/>
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </BrowserRouter>
  )
}