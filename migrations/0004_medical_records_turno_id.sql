-- ============================================================================
-- MIGRACIÓN - Vincular medical_records a un turno específico
-- ============================================================================
-- Fecha: 2026-07-02
-- Descripción: Agrega turno_id a medical_records para saber con certeza si un
--              turno ya tiene ficha clínica cargada (antes se inferría por
--              patient_id + fecha, lo cual era ambiguo).
-- ============================================================================

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_turno_id
  ON medical_records(turno_id);

-- ============================================================================
-- FIN
-- ============================================================================
