import { BrowserRouter, Routes, Route } from "react-router-dom"

import Dashboard from "../pages/Dashboard"
import Patients from "../pages/Patients"
import PatientDetail from "../pages/PatientDetail"
import Appointments from "../pages/Appointments"
import Login from "../pages/Login"
import NotFound from "../pages/NotFound"

import MainLayout from "../layouts/MainLayout"
import ProtectedRoute from "../components/ProtectedRoute"

function AppRoutes() {

  return (
    <BrowserRouter>

      <Routes>

        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>

          <Route element={<MainLayout />}>

            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/patients"
              element={<Patients />}
            />

            <Route
              path="/patients/:id"
              element={<PatientDetail />}
            />

            <Route
              path="/appointments"
              element={<Appointments />}
            />

            <Route path="*" element={<NotFound />} />

          </Route>

        </Route>

      </Routes>

    </BrowserRouter>
  )
}

export default AppRoutes