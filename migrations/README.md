# SQL Migrations para Podología App

## 0004_medical_records_turno_id.sql

Agrega `medical_records.turno_id` (FK a `appointments.id`, `ON DELETE SET NULL`) + índice `idx_medical_records_turno_id`.

Antes, para saber si un turno ya tenía ficha cargada había que inferirlo por `patient_id` + fecha, lo cual fallaba si el paciente tenía dos turnos el mismo día o si la fecha de la ficha se editaba a mano. Ahora el vínculo es explícito, igual que `cobros.turno_id`.

**Cómo ejecutar:** SQL Editor de Supabase, pegar el contenido de `0004_medical_records_turno_id.sql` y correr. Es aditiva y segura (`ADD COLUMN IF NOT EXISTS`), no requiere backfill porque las fichas existentes seguirán funcionando sin turno vinculado (`turno_id NULL`).

## 0003_fix_cobros_security.sql

Este archivo contiene las migraciones críticas para arreglar bugs en el manejo de cobros y mejorar seguridad.

### ¿Qué hace?

#### 1. TRIGGER: Auto-calcular `saldo_pendiente`
- Auto-calcula el saldo pendiente basado en `monto_total - monto_entregado`
- Se ejecuta antes de INSERT y UPDATE en tabla `cobros`
- Asegura que nunca sea negativo con GREATEST(0, ...)

#### 2. CONSTRAINT: Prevenir conflictos de horarios
- Agrega constraint UNIQUE en `(appointment_date, appointment_time)` 
- Excepto para turnos con status 'Cancelado'
- Previene doble-booking a nivel de BD

#### 3. INDEXES: Mejorar performance
- Índice en appointments(date, time, status) para búsquedas rápidas
- Índices en cobros(turno_id, paciente_id) para relaciones

#### 4. ROW LEVEL SECURITY (RLS)
- Usuarios solo ven sus propios pacientes/turnos/cobros
- Basado en `patients.user_id = auth.uid()`
- Policies en: patients, medical_records, appointments, cobros, pagos

### Cómo ejecutar

**Opción 1: Supabase Dashboard (Recomendado)**
1. Ir a https://app.supabase.com
2. Seleccionar el proyecto
3. Ir a SQL Editor
4. Crear una nueva query
5. Copiar contenido de `0003_fix_cobros_security.sql`
6. Click "Run" (Ejecutar)

**Opción 2: CLI de Supabase**
```bash
supabase db push
```

### ⚠️ PREREQUISITOS

Antes de ejecutar esta migración, verificar que:

1. **patients tenga user_id**
```sql
-- Si no existe, crear:
ALTER TABLE patients ADD COLUMN user_id uuid REFERENCES auth.users(id);
-- Actualizar usuarios existentes:
UPDATE patients SET user_id = auth.uid() WHERE user_id IS NULL;
```

2. **Supabase está configurado correctamente**
- Auth está habilitado
- Users están creados en auth.users

### ✅ Validar después de ejecutar

Ejecutar estas queries para verificar:

```sql
-- 1. Verificar trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'cobros';
-- Debe mostrar: trg_cobros_saldo_pendiente

-- 2. Verificar constraint
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'appointments' AND constraint_type = 'UNIQUE';
-- Debe incluir: chk_no_duplicate_slots

-- 3. Verificar RLS activa
SELECT * FROM information_schema.table_constraints
WHERE table_name = 'patients' AND constraint_type = 'POLICY';
-- Debe mostrar múltiples policies

-- 4. Probar trigger
INSERT INTO cobros (paciente_id, monto_total, monto_entregado, fecha, estado)
VALUES (NULL, 1000, 600, '2026-07-01', 'parcial');
-- saldo_pendiente debería ser 400 automáticamente
```

### 🔄 Rollback (si algo sale mal)

```sql
-- Desactivar trigger
DROP TRIGGER IF EXISTS trg_cobros_saldo_pendiente ON cobros;
DROP FUNCTION IF EXISTS calculate_saldo_pendiente();

-- Eliminar constraint
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS chk_no_duplicate_slots;

-- Desactivar RLS (CUIDADO: abre a todos)
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records DISABLE ROW LEVEL SECURITY;
-- etc...
```

### 📝 Notas

- Los cambios en la aplicación (cobroUtils.ts, etc.) ya están implementados
- El trigger automáticamente calcula `saldo_pendiente` en cada insert/update
- La BD y la aplicación ahora están sincronizadas
- Los usuarios solo pueden acceder a sus propios datos (RLS)

### 🆘 Si algo no funciona

1. Verificar que PostgreSQL está usando la versión correcta (10+)
2. Confirmar que los usuarios tienen user_id en tabla patients
3. Si hay error "column does not exist", verificar que todas las columnas existen:
   - cobros: monto_total, monto_entregado, saldo_pendiente
   - appointments: appointment_date, appointment_time, status
   - patients: user_id
