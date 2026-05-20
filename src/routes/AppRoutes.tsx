import { BrowserRouter, Routes, Route } from "react-router-dom"

import Dashboard from "../pages/Dashboard"
import Patients from "../pages/Patients"

import MainLayout from "../layouts/MainLayout"
import PatientDetail from "../pages/PatientDetail"
import Appointments from "../pages/Appointments"

function AppRoutes() {

  return (
    <BrowserRouter>

      <Routes>

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

        </Route>

      </Routes>

    </BrowserRouter>
  )
}

export default AppRoutes