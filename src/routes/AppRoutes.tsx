import { lazy } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import Login from "../pages/Login"
import ResetPassword from "../pages/ResetPassword"
import NotFound from "../pages/NotFound"
import MainLayout from "../layouts/MainLayout"
import ProtectedRoute from "../components/ProtectedRoute"

const Dashboard    = lazy(() => import("../pages/Dashboard"))
const Patients     = lazy(() => import("../pages/Patients"))
const PatientDetail = lazy(() => import("../pages/PatientDetail"))
const Appointments = lazy(() => import("../pages/Appointments"))
const Statistics   = lazy(() => import("../pages/Statistics"))
const Export       = lazy(() => import("../pages/Export"))
const Settings     = lazy(() => import("../pages/Settings"))
const Financieras  = lazy(() => import("../pages/Financieras"))

function AppRoutes() {

  return (
    <BrowserRouter>

      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>

          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/export" element={<Export />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/financieras" element={<Financieras />} />
            <Route path="*" element={<NotFound />} />
          </Route>

        </Route>

      </Routes>

    </BrowserRouter>
  )
}

export default AppRoutes