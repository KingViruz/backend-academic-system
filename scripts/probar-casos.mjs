#!/usr/bin/env node
/**
 * Ejecuta contra la API los casos de prueba del Plan de pruebas (CP-01 … CP-12).
 * Úsalo con la base recién sembrada:  npm run seed -- --force  &&  npm run start  &&  node scripts/probar-casos.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3001/api';
let ok = 0, fallos = 0;
const tokens = {};

async function req(method, path, { token, body, headers = {}, form } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers: h, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}
function check(nombre, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✔ ${nombre}`); } else { fallos++; console.log(`  ✘ ${nombre} ${extra}`); }
}
async function login(email, password) {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  return r;
}

console.log('\nCP-01 Inicio de sesión según el rol');
for (const [rol, email, pass] of [['ADMIN', 'admin@cul.edu.co', 'Admin2026*'], ['COORDINADOR', 'coordinador@cul.edu.co', 'Coord2026*'], ['DOCENTE', 'docente@cul.edu.co', 'Docente2026*'], ['ESTUDIANTE', 'estudiante@cul.edu.co', 'Estudiante2026*']]) {
  const r = await login(email, pass);
  tokens[rol] = r.data.token;
  check(`${rol} entra con su rol`, r.status === 200 && r.data.usuario.rol === rol, JSON.stringify(r.data));
}
const c1 = await login('docente@cul.edu.co', 'mala');
const c2 = await login('noexiste@cul.edu.co', 'x');
check('contraseña incorrecta y correo inexistente dan el mismo mensaje', c1.status === 401 && c2.status === 401 && c1.data.message === c2.data.message);
check('docente no entra a pantallas de administrador', (await req('GET', '/usuarios', { token: tokens.DOCENTE })).status === 403);
check('estudiante no entra a pantallas de administrador', (await req('GET', '/usuarios', { token: tokens.ESTUDIANTE })).status === 403);

console.log('\nCP-02 Bloqueo por intentos fallidos');
const email2 = 'apayares@cul.edu.co';
for (let i = 0; i < 4; i++) await login(email2, 'mala');
check('el cuarto fallo no bloquea', (await login(email2, 'Docente2026*')).status === 200);
let ult;
for (let i = 0; i < 5; i++) ult = await login(email2, 'mala');
check('el quinto fallo bloquea', ult.status === 403 && /bloquead/i.test(ult.data.message), JSON.stringify(ult.data));
check('durante el bloqueo se rechaza la contraseña correcta', (await login(email2, 'Docente2026*')).status === 403);
const usuarios = (await req('GET', '/usuarios?q=Payares', { token: tokens.ADMIN })).data;
await req('POST', `/usuarios/${usuarios[0].id}/desbloquear`, { token: tokens.ADMIN });
check('el administrador puede desbloquear', (await login(email2, 'Docente2026*')).status === 200);
tokens.DOCENTE_B = (await login(email2, 'Docente2026*')).data.token;

console.log('\nCP-03 Un docente no modifica notas de un grupo ajeno');
const gruposDimas = (await req('GET', '/carga/mios', { token: tokens.DOCENTE })).data;
const is2 = gruposDimas.find((g) => g.materia.codigo === 'SIS402');
const bd = gruposDimas.find((g) => g.materia.codigo === 'SIS301');
const notasIs2 = (await req('GET', `/calificaciones/grupo/${is2.id}`, { token: tokens.DOCENTE })).data;
const ajena = await req('PUT', `/calificaciones/grupo/${is2.id}`, { token: tokens.DOCENTE_B, body: { corte: 2, notas: [{ inscripcionId: notasIs2.filas[0].inscripcionId, nota: 5 }] } });
check('la API responde 403', ajena.status === 403, JSON.stringify(ajena.data));
check('el grupo no aparece en la lista del docente B', !(await req('GET', '/carga/mios', { token: tokens.DOCENTE_B })).data.some((g) => g.id === is2.id));
const aud = (await req('GET', '/auditoria', { token: tokens.ADMIN })).data;
check('la auditoría registra los accesos', aud.total > 0);

console.log('\nCP-04 Cruces en la carga académica');
const periodo = (await req('GET', '/periodos/actual', { token: tokens.COORDINADOR })).data;
const aulas = (await req('GET', '/aulas', { token: tokens.COORDINADOR })).data;
const a301 = aulas.find((a) => a.codigo === '301'), a205 = aulas.find((a) => a.codigo === '205');
const docentes = (await req('GET', '/docentes', { token: tokens.COORDINADOR })).data;
const d1 = docentes.find((d) => d.usuario.apellidos === 'Bautte'), d2 = docentes.find((d) => d.usuario.apellidos === 'Payares');
const materias = (await req('GET', '/materias', { token: tokens.COORDINADOR })).data;
const prog1 = materias.find((m) => m.codigo === 'SIS101');
const intento = (doc, aula, dia, ini, fin, grupo) => req('POST', '/carga', { token: tokens.COORDINADOR, body: { periodoId: periodo.id, materiaId: prog1.id, docenteId: doc.id, grupo, cupo: 20, horarios: [{ aulaId: aula.id, dia, horaInicio: ini, horaFin: fin }] } });
const v1 = await intento(d1, a205, 1, '08:00', '10:00', 'X1');
check('1: docente ocupado se bloquea', v1.status === 409 && /docente/i.test(v1.data.message), v1.data.message);
const v2 = await intento(d2, a301, 1, '08:00', '10:00', 'X2');
check('2: aula ocupada se bloquea', v2.status === 409 && /aula/i.test(v2.data.message), v2.data.message);
const v3 = await intento(d2, a301, 1, '09:00', '11:00', 'X3');
check('3: cruce parcial se bloquea', v3.status === 409);
// El docente 1 y el aula 301 terminan clase a las 10:00: la franja 10:00–12:00 es contigua para ambos.
const v4 = await intento(d1, a301, 1, '10:00', '12:00', 'X4');
check('4: franjas contiguas se permiten', v4.status === 201, JSON.stringify(v4.data).slice(0, 200));
const v5 = await intento(d1, a301, 2, '08:00', '10:00', 'X5');
check('5: otro día se permite', v5.status === 201, JSON.stringify(v5.data).slice(0, 200));

console.log('\nCP-05 Cálculo de la nota definitiva');
const ins0 = notasIs2.filas[0].inscripcionId;
const put = (corte, nota) => req('PUT', `/calificaciones/grupo/${is2.id}`, { token: tokens.DOCENTE, body: { corte, notas: [{ inscripcionId: ins0, nota }] } });
check('D: 5,1 se rechaza', (await put(2, 5.1)).status === 400);
check('E: -0,1 se rechaza', (await put(2, -0.1)).status === 400);
check('F: texto se rechaza', (await put(2, 'tres')).status === 400);
check('el corte 1 cerrado no se edita', (await put(1, 4.0)).status === 400);
// Variante A: 4.0 / 3.0 / 2.5 -> 3.1. El corte 1 de la semilla tiene 4.2, así que usamos otro grupo sin notas.
const filasBd = (await req('GET', `/calificaciones/grupo/${bd.id}`, { token: tokens.DOCENTE })).data.filas;
const todos = (corte, n) => req('PUT', `/calificaciones/grupo/${bd.id}`, { token: tokens.DOCENTE, body: { corte, notas: filasBd.map((f, i) => ({ inscripcionId: f.inscripcionId, nota: i === 0 ? n : 3.5 })) } });
await todos(1, 4.0); await req('POST', `/calificaciones/grupo/${bd.id}/cerrar-corte`, { token: tokens.DOCENTE, body: { corte: 1 } });
await todos(2, 3.0); await req('POST', `/calificaciones/grupo/${bd.id}/cerrar-corte`, { token: tokens.DOCENTE, body: { corte: 2 } });
await todos(3, 2.5);
const bdNotas = (await req('GET', `/calificaciones/grupo/${bd.id}`, { token: tokens.DOCENTE })).data;
check('A: 4,0 / 3,0 / 2,5 con 30/30/40 = 3,1', bdNotas.filas[0].definitiva === 3.1, JSON.stringify(bdNotas.filas[0]));

console.log('\nCP-06 Cambio de nota después del cierre');
const fila = notasIs2.filas.find((f) => f.notas[0].nota === 2.6) ?? notasIs2.filas[0];
const cal = fila.notas[0];
const sol = await req('POST', '/solicitudes-nota', { token: tokens.DOCENTE, body: { calificacionId: cal.calificacionId, notaNueva: 3.2, motivo: 'error de digitación' } });
check('se crea la solicitud', sol.status === 201, JSON.stringify(sol.data));
check('el docente no puede aprobar (no es coordinador)', (await req('POST', `/solicitudes-nota/${sol.data.id}/aprobar`, { token: tokens.DOCENTE, body: {} })).status === 403);
const rech = await req('POST', `/solicitudes-nota/${sol.data.id}/rechazar`, { token: tokens.COORDINADOR, body: { comentario: 'Falta soporte' } });
check('el coordinador rechaza', rech.status === 200 && rech.data.estado === 'RECHAZADA');
const sol2 = await req('POST', '/solicitudes-nota', { token: tokens.DOCENTE, body: { calificacionId: cal.calificacionId, notaNueva: 3.2, motivo: 'error de digitación, adjunto acta' } });
const apr = await req('POST', `/solicitudes-nota/${sol2.data.id}/aprobar`, { token: tokens.COORDINADOR, body: {} });
check('el coordinador aprueba', apr.status === 200 && apr.data.estado === 'APROBADA', JSON.stringify(apr.data));
const tras = (await req('GET', `/calificaciones/grupo/${is2.id}`, { token: tokens.DOCENTE })).data.filas.find((f) => f.inscripcionId === fila.inscripcionId);
check('la nota cambió a 3,2', tras.notas[0].nota === 3.2);
const alertasSeg = (await req('GET', '/alertas?tipo=SEGURIDAD', { token: tokens.COORDINADOR })).data;
check('se dispara la alerta A07', alertasSeg.length > 0);

console.log('\nCP-07 y CP-08 Asistencia por sensor y sin conexión');
const abrir = await req('POST', '/asistencias', { token: tokens.DOCENTE, body: { cargaId: is2.id, tema: 'Prueba de sensor' } });
check('el docente abre la asistencia', abrir.status === 201, JSON.stringify(abrir.data).slice(0, 200));
const asisId = abrir.data.id;
const sensorH = { 'x-sensor-codigo': 'SENSOR-301', 'x-sensor-token': 'demo-token-sensor-301' };
const ahora = Date.now();
const lect = await req('POST', '/sensor/lecturas', { headers: sensorH, body: { lecturas: [
  { carne: 'EST-0001', leidoEn: new Date(ahora + 60000).toISOString() },
  { carne: 'EST-0002', leidoEn: new Date(ahora + 20 * 60000).toISOString() },
  { carne: 'EST-0001', leidoEn: new Date(ahora + 25 * 60000).toISOString() },
  { carne: 'NO-EXISTE', leidoEn: new Date(ahora + 5 * 60000).toISOString() },
] } });
check('el sensor envía el lote', lect.status === 200, JSON.stringify(lect.data).slice(0, 300));
const r = lect.data.resultados ?? [];
check('primera lectura procesada', r[0]?.estado === 'PROCESADA');
check('duplicado ignorado', r[2]?.estado === 'DUPLICADA');
check('carné inexistente rechazado', r[3]?.estado === 'RECHAZADA');
check('sensor con token incorrecto se rechaza', (await req('POST', '/sensor/lecturas', { headers: { ...sensorH, 'x-sensor-token': 'x' }, body: { lecturas: [{ carne: 'EST-0003', leidoEn: new Date().toISOString() }] } })).status === 401);
// Manual + sensor del mismo estudiante = un solo registro
const est5 = (await req('GET', `/asistencias/${asisId}`, { token: tokens.DOCENTE })).data.lista.find((l) => l.codigoCarne === 'EST-0005');
await req('POST', `/asistencias/${asisId}/manual`, { token: tokens.DOCENTE, body: { estudianteId: est5.estudianteId, estado: 'PRESENTE' } });
const lect2 = await req('POST', '/sensor/lecturas', { headers: sensorH, body: { lecturas: [{ carne: 'EST-0005', leidoEn: new Date(ahora + 2 * 60000).toISOString() }] } });
check('manual + sensor queda una sola vez', lect2.data.resultados?.[0]?.estado === 'DUPLICADA');
const det = (await req('GET', `/asistencias/${asisId}`, { token: tokens.DOCENTE })).data;
const e1 = det.lista.find((l) => l.codigoCarne === 'EST-0001'), e2 = det.lista.find((l) => l.codigoCarne === 'EST-0002');
check('EST-0001 presente', e1.estado === 'PRESENTE');
check('EST-0002 tarde (llegó a los 20 min)', e2.estado === 'TARDE', e2.estado);
check('la hora guardada es la de la lectura', new Date(e2.horaRegistro).getTime() === new Date(ahora + 20 * 60000).getTime() - (new Date(ahora + 20 * 60000).getMilliseconds()) || Math.abs(new Date(e2.horaRegistro).getTime() - (ahora + 20 * 60000)) < 1000);
const qr = await req('GET', `/asistencias/${asisId}/qr`, { token: tokens.DOCENTE });
check('se genera código QR', /^[0-9A-Z]{6}$/.test(qr.data.codigo));
const cerrar = await req('POST', `/asistencias/${asisId}/cerrar`, { token: tokens.DOCENTE });
check('al cerrar, los demás quedan ausentes', cerrar.data.conteo.AUSENTE > 0 && cerrar.data.conteo.SIN_REGISTRO === 0, JSON.stringify(cerrar.data.conteo));

console.log('\nCP-09 Datos personales según el rol');
const comoDocente = (await req('GET', '/estudiantes', { token: tokens.DOCENTE })).data;
check('el docente no ve SISBEN ni ICFES', comoDocente.length > 0 && comoDocente[0].sisben === undefined && comoDocente[0].puntajeIcfes === undefined);
const comoCoord = (await req('GET', '/estudiantes', { token: tokens.COORDINADOR })).data;
check('el coordinador ve la ficha completa de su programa', comoCoord[0].sisben !== undefined);
check('el estudiante no puede listar estudiantes', (await req('GET', '/estudiantes', { token: tokens.ESTUDIANTE })).status === 403);

console.log('\nCP-10 Inscripción: límite de créditos, cupo y cruces');
const oferta = (await req('GET', '/inscripciones/oferta', { token: tokens.ESTUDIANTE })).data;
const mias = (await req('GET', '/inscripciones/mias', { token: tokens.ESTUDIANTE })).data;
check('el estudiante ve su oferta', oferta.grupos.length > 0);
check('créditos actuales calculados', mias.creditos === 8, String(mias.creditos));
const estr = oferta.grupos.find((g) => g.materia.codigo === 'SIS201');
const insE = await req('POST', '/inscripciones', { token: tokens.ESTUDIANTE, body: { cargaId: estr.id } });
check('inscribe un grupo sin cruce', insE.status === 201, JSON.stringify(insE.data));
const otraIs2 = await req('POST', '/inscripciones', { token: tokens.ESTUDIANTE, body: { cargaId: is2.id } });
check('no se inscribe dos veces', otraIs2.status === 409);
const x4 = oferta.grupos.find((g) => g.grupo === 'X4');
const cr = await req('POST', '/inscripciones', { token: tokens.ESTUDIANTE, body: { cargaId: x4.id } });
check('se detecta cruce con su horario (lunes 10–12)', cr.status === 400 && /cruza/i.test(cr.data.message), cr.data.message);
await req('PATCH', `/periodos/${periodo.id}`, { token: tokens.ADMIN, body: { limiteCreditos: 12 } });
const x5 = oferta.grupos.find((g) => g.grupo === 'X5');
const lim = await req('POST', '/inscripciones', { token: tokens.ESTUDIANTE, body: { cargaId: x5.id } });
check('A: supera el límite de créditos (11 + 3 > 12)', lim.status === 400 && /límite/i.test(lim.data.message), lim.data.message);
await req('PATCH', `/periodos/${periodo.id}`, { token: tokens.ADMIN, body: { limiteCreditos: 20 } });
check('B: dentro del límite se inscribe', (await req('POST', '/inscripciones', { token: tokens.ESTUDIANTE, body: { cargaId: x5.id } })).status === 201);

console.log('\nCP-11 Publicación de microcurrículo: suma de parciales');
const mc = await req('POST', '/microcurriculos', { token: tokens.COORDINADOR, body: { materiaId: prog1.id, descripcion: 'x', objetivoGeneral: 'x', competenciasGenericas: 'x', porcentajeP1: 30, porcentajeP2: 30, porcentajeP3: 30 } });
await req('POST', `/microcurriculos/${mc.data.id}/unidades`, { token: tokens.COORDINADOR, body: { numero: 1, nombre: 'Intro', competenciaEspecifica: 'cc', resultadoAprendizaje: 'rr', nivelSuperior: 'ss', nivelNormal: 'nn', nivelBajo: 'bb', nivelDeficiente: 'dd' } });
const pub90 = await req('POST', `/microcurriculos/${mc.data.id}/publicar`, { token: tokens.COORDINADOR });
check('90 % se rechaza', pub90.status === 400 && /90/.test(pub90.data.message), pub90.data.message);
await req('PATCH', `/microcurriculos/${mc.data.id}`, { token: tokens.COORDINADOR, body: { porcentajeP3: 40 } });
check('100 % se publica', (await req('POST', `/microcurriculos/${mc.data.id}/publicar`, { token: tokens.COORDINADOR })).status === 201);

console.log('\nCP-12 Carga masiva con filas inválidas');
const plantilla = (await req('GET', '/estudiantes/plantilla', { token: tokens.ADMIN })).data.replace(/^﻿/, '').split('\n')[0];
const filas = [
  'CC,3000000001,Uno,Prueba,uno@test.co,,C-0001,ING-SIS,1,2004-01-01,2022-01-10,,,,300,A1',
  'CC,3000000002,Dos,Prueba,estudiante@cul.edu.co,,C-0002,ING-SIS,1,2004-01-01,2022-01-10,,,,300,A1',
  'CC,3000000003,Tres,Prueba,tres@test.co,,C-0003,NO-EXISTE,1,2004-01-01,2022-01-10,,,,300,A1',
  'CC,3000000004,Cuatro,Prueba,cuatro@test.co,,C-0004,ING-SIS,1,2004-01-01,2003-01-10,,,,300,A1',
  'CC,3000000005,Cinco,Prueba,cinco@test.co,,C-0005,ING-SIS,1,2004-05-05,2022-05-10,,,,310,B1',
];
const fd = () => { const f = new FormData(); f.append('archivo', new Blob([plantilla + '\n' + filas.join('\n')], { type: 'text/csv' }), 'e.csv'); return f; };
const cm = await req('POST', '/estudiantes/carga-masiva', { token: tokens.ADMIN, form: fd() });
check('crea solo las filas válidas (2)', cm.data.creados?.length === 2, JSON.stringify(cm.data));
check('reporta 3 filas con error y su motivo', cm.data.errores?.length === 3);
const cm2 = await req('POST', '/estudiantes/carga-masiva', { token: tokens.ADMIN, form: fd() });
check('la segunda carga no duplica', cm2.data.creados?.length === 0 && cm2.data.existentes?.length === 2);

console.log('\nTablero');
for (const rol of ['ADMIN', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE']) {
  const d = await req('GET', '/dashboard', { token: tokens[rol] });
  check(`dashboard de ${rol}`, d.status === 200 && d.data.rol === rol, JSON.stringify(d.data).slice(0, 200));
}

console.log(`\n${ok} verificaciones correctas, ${fallos} fallidas\n`);
process.exit(fallos ? 1 : 0);
