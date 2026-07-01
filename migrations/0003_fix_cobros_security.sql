-- ============================================================================
-- MIGRACIONES SQL - Fixes Críticos de Cobros y Seguridad
-- ============================================================================
-- Fecha: 2026-07-01
-- Descripción: Agrega triggers, constraints y RLS para cobros/turnos
-- ============================================================================

-- 1. TRIGGER: Auto-calcular saldo_pendiente en cobros
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_saldo_pendiente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saldo_pendiente := NEW.monto_total - NEW.monto_entregado;
  NEW.saldo_pendiente := GREATEST(0, NEW.saldo_pendiente);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cobros_saldo_pendiente ON cobros;

CREATE TRIGGER trg_cobros_saldo_pendiente
BEFORE INSERT OR UPDATE ON cobros
FOR EACH ROW
EXECUTE FUNCTION calculate_saldo_pendiente();

-- 2. CONSTRAINT: Prevenir dos turnos a la misma hora (excepto Cancelado)
-- ============================================================================

ALTER TABLE appointments
  ADD CONSTRAINT chk_no_duplicate_slots 
  UNIQUE (appointment_date, appointment_time) 
  WHERE status != 'Cancelado';

-- 3. INDEXES: Mejorar performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_appointments_date_time_status 
  ON appointments(appointment_date, appointment_time, status);

CREATE INDEX IF NOT EXISTS idx_cobros_turno_id 
  ON cobros(turno_id);

CREATE INDEX IF NOT EXISTS idx_cobros_paciente_id 
  ON cobros(paciente_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- NOTA: Requiere que patients tenga user_id (creada en setup inicial)

-- Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patients" ON patients
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their patients" ON patients
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their patients" ON patients
  FOR DELETE USING (auth.uid() = user_id);

-- Medical Records (via patients)
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view medical records" ON medical_records
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Appointments (via patients)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointments" ON appointments
  FOR SELECT USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create appointments" ON appointments
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update appointments" ON appointments
  FOR UPDATE USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Cobros (via patients)
ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cobros" ON cobros
  FOR SELECT USING (
    paciente_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create cobros" ON cobros
  FOR INSERT WITH CHECK (
    paciente_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update cobros" ON cobros
  FOR UPDATE USING (
    paciente_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- ============================================================================
-- FIN
-- ============================================================================