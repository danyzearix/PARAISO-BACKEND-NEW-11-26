// services/epayco.mjs
// Verifica que una confirmación de pago realmente venga de ePayco.
import crypto from 'node:crypto';
import config from '../config/env.mjs';

const URL_VALIDACION = 'https://secure.epayco.co/validation/v1/reference/';

// Firma oficial de ePayco: sha256(p_cust_id_cliente^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code)
const firmaValida = (datos) => {
  const { custId, pKey } = config.epayco;
  if (!datos.x_signature) return false;

  const cadena = [custId, pKey, datos.x_ref_payco, datos.x_transaction_id, datos.x_amount, datos.x_currency_code].join('^');
  const esperada = Buffer.from(crypto.createHash('sha256').update(cadena).digest('hex'));
  const recibida = Buffer.from(String(datos.x_signature).toLowerCase());

  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
};

// Consulta la transacción directamente a ePayco (no requiere llaves)
const consultarReferencia = async (refPayco) => {
  const respuesta = await fetch(URL_VALIDACION + encodeURIComponent(refPayco), {
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) throw new Error(`ePayco respondió HTTP ${respuesta.status}`);

  const json = await respuesta.json();
  if (!json?.success || !json.data) throw new Error('ePayco no devolvió datos de la transacción');
  return json.data;
};

/**
 * Devuelve { ok: true, datos, metodo } con datos confiables de la transacción,
 * o { ok: false, motivo } si no se pudo verificar.
 *  1) Con EPAYCO_P_CUST_ID y EPAYCO_P_KEY: valida la firma del webhook.
 *  2) Sin llaves: consulta la transacción en la API de validación de ePayco.
 */
export async function verificarTransaccion(payload) {
  if (config.epayco.custId && config.epayco.pKey) {
    return firmaValida(payload)
      ? { ok: true, datos: payload, metodo: 'firma' }
      : { ok: false, motivo: 'Firma inválida' };
  }

  if (payload.x_ref_payco) {
    try {
      const datos = await consultarReferencia(payload.x_ref_payco);
      if (String(datos.x_ref_payco ?? payload.x_ref_payco) !== String(payload.x_ref_payco)) {
        return { ok: false, motivo: 'La referencia consultada no coincide' };
      }
      return { ok: true, datos, metodo: 'api' };
    } catch (error) {
      if (!config.epayco.omitirVerificacion) {
        return { ok: false, motivo: `No se pudo consultar ePayco: ${error.message}` };
      }
    }
  }

  if (config.epayco.omitirVerificacion) {
    console.warn('⚠️  Pago aceptado SIN verificar (EPAYCO_SKIP_VERIFICATION=true).');
    return { ok: true, datos: payload, metodo: 'sin verificar' };
  }

  return { ok: false, motivo: 'El webhook no trae x_ref_payco y no hay llaves para validar la firma' };
}

/**
 * Traduce el código de ePayco a un estado interno.
 * 1 Aceptada · 2 Rechazada · 3 Pendiente · 4 Fallida · 6 Reversada · 7 Retenida · 8 Iniciada
 * 9 Expirada · 10 Abandonada · 11 Cancelada · 12 Antifraude
 */
export function estadoDesdeEpayco(datos) {
  const codigo = String(datos.x_cod_response ?? datos.x_cod_transaction_state ?? '').trim();
  const textoRespuesta = String(datos.x_response ?? datos.x_transaction_state ?? '').toLowerCase();

  if (codigo === '1' || textoRespuesta === 'aceptada') return 'confirmado';
  if (['3', '7', '8'].includes(codigo) || ['pendiente', 'retenido', 'iniciada'].includes(textoRespuesta)) return 'pendiente';
  if (codigo === '6' || textoRespuesta === 'reversada') return 'reversado';
  return 'rechazado';
}
