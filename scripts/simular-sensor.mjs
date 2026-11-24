#!/usr/bin/env node
/**
 * Simulador del sensor de asistencia (HT-04). Envía lecturas de carné a la API como lo haría el dispositivo.
 *
 *   node scripts/simular-sensor.mjs EST-0001 EST-0002            # lecturas con la hora actual
 *   node scripts/simular-sensor.mjs --offline 5 EST-0003         # simula 5 min sin red: guarda y reenvía en lote
 *   node scripts/simular-sensor.mjs --heartbeat                  # solo la señal de vida
 *
 * Variables: API_URL (http://localhost:3001/api), SENSOR_CODIGO (SENSOR-301), SENSOR_TOKEN (demo-token-sensor-301)
 */
const API = process.env.API_URL ?? 'http://localhost:3001/api';
const CODIGO = process.env.SENSOR_CODIGO ?? 'SENSOR-301';
const TOKEN = process.env.SENSOR_TOKEN ?? 'demo-token-sensor-301';
const headers = { 'Content-Type': 'application/json', 'x-sensor-codigo': CODIGO, 'x-sensor-token': TOKEN };

const args = process.argv.slice(2);
async function post(path, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${json.message ?? ''}`);
  return json;
}

if (args[0] === '--heartbeat') {
  console.log(await post('/sensor/heartbeat'));
} else {
  let offline = 0;
  if (args[0] === '--offline') { offline = Number(args[1]); args.splice(0, 2); }
  const carnes = args.length ? args : ['EST-0001'];
  const ahora = Date.now();
  // En modo offline las lecturas conservan la hora en que se pasó el carné, no la del envío.
  const lecturas = carnes.map((carne, i) => ({ carne, leidoEn: new Date(ahora - offline * 60000 + i * 1000).toISOString() }));
  if (offline) console.log(`Sin red durante ${offline} min: ${lecturas.length} lectura(s) guardadas en memoria. Reenviando…`);
  const r = await post('/sensor/lecturas', { lecturas });
  console.table(r.resultados);
}
