/**
 * Utilidades para cálculos de cobros/pagos
 * Maneja comparaciones con punto flotante de forma segura
 */

const EPSILON = 0.01 // Tolerancia para comparaciones de montos

/**
 * Calcula el estado de un cobro basado en montos
 * @param montoTotal - Monto total a cobrar
 * @param montoEntregado - Monto recibido del paciente
 * @returns Estado: 'cobrado', 'parcial', o 'pendiente'
 */
export function calcularEstadoCobro(
  montoTotal: number,
  montoEntregado: number
): "cobrado" | "parcial" | "pendiente" {
  if (montoTotal <= 0) return "pendiente"
  
  // Usar epsilon para comparación segura
  if (montoEntregado >= montoTotal - EPSILON) {
    return "cobrado"
  }
  if (montoEntregado > EPSILON) {
    return "parcial"
  }
  return "pendiente"
}

/**
 * Calcula el saldo pendiente de un cobro
 * @param montoTotal - Monto total
 * @param montoEntregado - Monto entregado
 * @returns Saldo pendiente (0 si está cobrado)
 */
export function calcularSaldoPendiente(
  montoTotal: number,
  montoEntregado: number
): number {
  const saldo = montoTotal - montoEntregado
  // Redondear al epsilon si está muy cerca de 0
  return Math.abs(saldo) < EPSILON ? 0 : Math.max(0, saldo)
}

/**
 * Valida que un monto a pagar no supere el saldo pendiente
 * @param montoPago - Monto a pagar
 * @param saldoPendiente - Saldo pendiente
 * @returns true si es válido, false si supera
 */
export function esMontoValidoParaSaldo(
  montoPago: number,
  saldoPendiente: number
): boolean {
  return montoPago <= saldoPendiente + EPSILON
}

/**
 * Compara dos montos con tolerancia para punto flotante
 * @param monto1 - Primer monto
 * @param monto2 - Segundo monto
 * @returns true si son iguales (dentro de EPSILON)
 */
export function montosIguales(monto1: number, monto2: number): boolean {
  return Math.abs(monto1 - monto2) < EPSILON
}
