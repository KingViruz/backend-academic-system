/**
 * Datos de ejemplo para probar el sistema de punta a punta.
 * Uso: npm run seed   (solo inserta si la base está vacía; con --force borra y vuelve a crear)
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { DataSource, EntityManager } from 'typeorm';
import { EstadoAsistencia, EstadoAsistente, EstadoMicrocurriculo, OrigenRegistro, Rol, TipoAlerta } from '../common/enums';
import {
  Alerta, Asistencia, Aula, Calificacion, CargaAcademica, Coordinador, DetalleAsistencia, DetallePlanMicrocurriculo, Docente, Estudiante,
  Facultad, HorarioClase, Inscripcion, Materia, Microcurriculo, Periodo, PlanMicrocurriculo, Programa, Sede, SensorAsistencia,
  UnidadTematica, Usuario,
} from './entities';
import { opcionesBD } from './typeorm.config';

config();

const SENSOR_TOKEN = 'demo-token-sensor-301';

function fecha(d: Date) { return d.toISOString().slice(0, 10); }
function sumarDias(base: string, dias: number) { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return fecha(d); }

async function usuario(em: EntityManager, rol: Rol, identificacion: string, nombres: string, apellidos: string, email: string, password: string, celular?: string) {
  return em.save(Usuario, em.create(Usuario, { tipoIdentificacion: 'CC', identificacion, nombres, apellidos, email, rol, celular: celular ?? null, passwordHash: await bcrypt.hash(password, 10) }));
}

async function main() {
  const forzar = process.argv.includes('--force');
  const ds = new DataSource(opcionesBD(process.env));
  await ds.initialize();
  const hay = await ds.getRepository(Usuario).count().catch(() => -1);
  if (hay === -1) { console.error('No existen las tablas. Ejecuta primero el script SQL (o DB_SYNC=true).'); process.exit(1); }
  if (hay > 0 && !forzar) { console.log('La base ya tiene datos. Usa "npm run seed -- --force" para reiniciarla.'); await ds.destroy(); return; }

  if (forzar) {
    await ds.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const m of ds.entityMetadatas) await ds.query(`TRUNCATE TABLE \`${m.tableName}\``);
    for (const t of ['materia_docente', 'microcurriculo_prerrequisito']) await ds.query(`TRUNCATE TABLE \`${t}\``).catch(() => undefined);
    await ds.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  await ds.transaction(async (em) => {
    // ----- Estructura -----
    const ing = await em.save(Facultad, { codigo: 'FING', nombre: 'Facultad de Ingeniería' });
    const cie = await em.save(Facultad, { codigo: 'FCAE', nombre: 'Facultad de Ciencias Administrativas' });
    const sis = await em.save(Programa, { codigo: 'ING-SIS', nombre: 'Ingeniería de Sistemas', creditos: 160, facultadId: ing.id });
    await em.save(Programa, { codigo: 'ING-IND', nombre: 'Ingeniería Industrial', creditos: 158, facultadId: ing.id });
    await em.save(Programa, { codigo: 'ADM-EMP', nombre: 'Administración de Empresas', creditos: 150, facultadId: cie.id });

    const mats = await em.save(Materia, [
      { codigo: 'SIS101', nombre: 'Programación I', creditos: 3 },
      { codigo: 'SIS201', nombre: 'Estructuras de Datos', creditos: 3 },
      { codigo: 'SIS301', nombre: 'Bases de Datos', creditos: 4 },
      { codigo: 'SIS402', nombre: 'Ingeniería de Software II', creditos: 4 },
      { codigo: 'MAT101', nombre: 'Cálculo Diferencial', creditos: 3 },
      { codigo: 'HUM110', nombre: 'Ética Profesional', creditos: 2 },
    ]);
    const [prog1, estr, bd, is2, calc, etica] = mats;

    const sede = await em.save(Sede, { nombre: 'Sede Centro', direccion: 'Barranquilla' });
    const [a301, a205, lab1] = await em.save(Aula, [
      { sedeId: sede.id, codigo: '301', capacidad: 35 },
      { sedeId: sede.id, codigo: '205', capacidad: 30 },
      { sedeId: sede.id, codigo: 'LAB-1', capacidad: 25 },
    ]);

    const hoy = fecha(new Date());
    const periodo = await em.save(Periodo, { codigo: '2026-2', fechaInicio: '2026-07-27', fechaFin: '2026-12-12', limiteCreditos: 20, actual: true });
    await em.save(Periodo, { codigo: '2026-1', fechaInicio: '2026-02-02', fechaFin: '2026-06-13', limiteCreditos: 20, actual: false });

    // ----- Personas (contraseña de demo indicada en el README) -----
    await usuario(em, Rol.ADMIN, '1000000001', 'Alberto', 'Muñoz', 'admin@cul.edu.co', 'Admin2026*', '3001000001');
    const uc = await usuario(em, Rol.COORDINADOR, '1000000002', 'Rafael', 'Manotas', 'coordinador@cul.edu.co', 'Coord2026*', '3001000002');
    await em.save(Coordinador, { usuarioId: uc.id, programaId: sis.id });

    const docentesData: [string, string, string, string, Materia[]][] = [
      ['1000000003', 'Dimas', 'Bautte', 'docente@cul.edu.co', [is2, bd, prog1]],
      ['1000000004', 'Alejandro', 'Payares', 'apayares@cul.edu.co', [estr, prog1, calc]],
      ['1000000005', 'Sebastián', 'Mercado', 'smercado@cul.edu.co', [etica, calc]],
    ];
    const docentes: Docente[] = [];
    for (const [id, n, a, e, m] of docentesData) {
      const u = await usuario(em, Rol.DOCENTE, id, n, a, e, 'Docente2026*');
      const d = em.create(Docente, { usuarioId: u.id, profesion: 'Ingeniero de Sistemas', materias: m });
      docentes.push(await em.save(Docente, d));
    }
    const [dDimas, dAlejandro, dSebastian] = docentes;

    const nombres: [string, string][] = [
      ['Sebastian', 'Burgos'], ['Laura', 'Pérez'], ['Andrés', 'Gómez'], ['Valentina', 'Rojas'], ['Camilo', 'Torres'],
      ['Daniela', 'Herrera'], ['Mateo', 'Castro'], ['Sofía', 'Ruiz'], ['Juan', 'Díaz'], ['Mariana', 'López'],
    ];
    const estudiantes: Estudiante[] = [];
    for (let i = 0; i < nombres.length; i++) {
      const [n, a] = nombres[i];
      const email = i === 0 ? 'estudiante@cul.edu.co' : `${n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@cul.edu.co`;
      const u = await usuario(em, Rol.ESTUDIANTE, `20000000${String(i + 1).padStart(2, '0')}`, n, a, email, 'Estudiante2026*');
      estudiantes.push(await em.save(Estudiante, {
        usuarioId: u.id, codigoCarne: `EST-${String(i + 1).padStart(4, '0')}`, programaId: sis.id, semestre: 7,
        fechaNacimiento: `200${i % 4}-0${(i % 9) + 1}-15`, fechaExpedicion: `20${18 + (i % 4)}-0${(i % 9) + 1}-20`,
        puntajeIcfes: 280 + i * 7, sisben: ['A3', 'B2', 'C1', 'B5'][i % 4],
      }));
    }

    // ----- Carga académica del periodo -----
    const g = async (materia: Materia, docente: Docente, grupo: string, cupo: number, horarios: Omit<HorarioClase, 'id' | 'cargaId' | 'carga' | 'aula'>[]) =>
      em.save(CargaAcademica, em.create(CargaAcademica, { periodoId: periodo.id, programaId: sis.id, materiaId: materia.id, docenteId: docente.id, grupo, cupo, horarios: horarios.map((h) => em.create(HorarioClase, h)) }));
    const cIs2 = await g(is2, dDimas, 'A', 30, [{ aulaId: a301.id, dia: 1, horaInicio: '08:00', horaFin: '10:00' }, { aulaId: a301.id, dia: 3, horaInicio: '08:00', horaFin: '10:00' }]);
    const cBd = await g(bd, dDimas, 'A', 30, [{ aulaId: lab1.id, dia: 2, horaInicio: '10:00', horaFin: '12:00' }, { aulaId: lab1.id, dia: 4, horaInicio: '10:00', horaFin: '12:00' }]);
    await g(estr, dAlejandro, 'A', 30, [{ aulaId: a205.id, dia: 1, horaInicio: '10:00', horaFin: '12:00' }, { aulaId: a205.id, dia: 5, horaInicio: '08:00', horaFin: '10:00' }]);
    await g(calc, dAlejandro, 'B', 25, [{ aulaId: a205.id, dia: 2, horaInicio: '14:00', horaFin: '16:00' }]);
    await g(etica, dSebastian, 'A', 30, [{ aulaId: a301.id, dia: 4, horaInicio: '14:00', horaFin: '16:00' }]);
    await g(prog1, dDimas, 'C', 25, [{ aulaId: lab1.id, dia: 5, horaInicio: '14:00', horaFin: '17:00' }]);

    const insIs2: Inscripcion[] = [];
    for (const e of estudiantes) {
      insIs2.push(await em.save(Inscripcion, { estudianteId: e.id, cargaId: cIs2.id }));
      await em.save(Inscripcion, { estudianteId: e.id, cargaId: cBd.id });
    }

    // ----- Microcurrículo publicado de Ingeniería de Software II -----
    const micro = await em.save(Microcurriculo, em.create(Microcurriculo, {
      materiaId: is2.id, programaId: sis.id, estado: EstadoMicrocurriculo.PUBLICADO, publicadoEn: new Date(),
      descripcion: 'Gestión de proyectos de software con métodos ágiles, análisis de riesgos, pruebas y trazabilidad.',
      objetivoGeneral: 'Planear, construir y validar un producto de software aplicando una metodología ágil y gestión de riesgos.',
      objetivosEspecificos: 'Construir un Product Backlog; diseñar casos de prueba; elaborar una matriz de riesgos.',
      competenciasGenericas: 'Trabajo en equipo, comunicación técnica, pensamiento crítico.',
      estrategias: 'Aprendizaje basado en proyectos, sprints quincenales, revisiones con el cliente.',
      bibliografia: 'Sommerville, I. Ingeniería de Software. Schwaber & Sutherland. La Guía de Scrum.',
      porcentajeP1: 30, porcentajeP2: 30, porcentajeP3: 40,
      prerrequisitos: [bd],
    }));
    await em.save(Microcurriculo, em.create(Microcurriculo, { materiaId: bd.id, programaId: sis.id, estado: EstadoMicrocurriculo.PUBLICADO, publicadoEn: new Date(),
      descripcion: 'Modelado y gestión de bases de datos relacionales.', objetivoGeneral: 'Diseñar y consultar bases de datos normalizadas.',
      competenciasGenericas: 'Pensamiento lógico, abstracción.', porcentajeP1: 30, porcentajeP2: 30, porcentajeP3: 40 }));

    const unidades = await em.save(UnidadTematica, [
      { microcurriculoId: micro.id, numero: 1, nombre: 'Metodologías ágiles', competenciaEspecifica: 'Selecciona y justifica un enfoque ágil para un proyecto.', resultadoAprendizaje: 'Construye un plan de desarrollo con Scrum.', nivelSuperior: 'Justifica con evidencia del proyecto y adapta el marco.', nivelNormal: 'Justifica la elección con criterios generales.', nivelBajo: 'Describe la metodología sin relacionarla con el proyecto.', nivelDeficiente: 'No justifica la elección.' },
      { microcurriculoId: micro.id, numero: 2, nombre: 'Gestión de riesgos', competenciaEspecifica: 'Identifica, valora y mitiga riesgos del software.', resultadoAprendizaje: 'Elabora matriz de riesgos e Ishikawa.', nivelSuperior: 'Prioriza con datos y conecta mitigaciones al backlog.', nivelNormal: 'Matriz completa con mitigaciones.', nivelBajo: 'Matriz incompleta.', nivelDeficiente: 'No identifica riesgos concretos.' },
      { microcurriculoId: micro.id, numero: 3, nombre: 'Pruebas y trazabilidad', competenciaEspecifica: 'Diseña casos de prueba trazables a requisitos.', resultadoAprendizaje: 'Construye plan de pruebas con matriz de trazabilidad.', nivelSuperior: 'Usa técnicas de diseño y cubre funciones críticas.', nivelNormal: 'Casos completos y trazables.', nivelBajo: 'Casos sin datos o resultados esperados.', nivelDeficiente: 'No diseña casos verificables.' },
    ]);

    // Plan del periodo: sesiones semanales desde el inicio; las ya pasadas quedan mayormente ejecutadas.
    const plan = await em.save(PlanMicrocurriculo, { microcurriculoId: micro.id, cargaId: cIs2.id, fechaInicio: periodo.fechaInicio, fechaFin: periodo.fechaFin, totalHoras: 64 });
    const temas = ['Encuadre y proyecto', 'Scrum: roles y eventos', 'Product Backlog', 'Historias de usuario', 'Planeación de sprints', 'Estimación', 'Riesgos: identificación', 'Matriz de riesgos',
      'Ishikawa y 5 porqués', 'Criticidad', 'Diseño de pruebas', 'Valores límite', 'Trazabilidad', 'Pruebas de carga', 'Revisión del proyecto', 'Sustentación'];
    const dets: Partial<DetallePlanMicrocurriculo>[] = temas.map((t, i) => {
      const f = sumarDias(periodo.fechaInicio, i * 7);
      const pasada = f < hoy;
      return { planId: plan.id, semana: i + 1, unidadId: unidades[Math.min(2, Math.floor(i / 6))].id, tema: t, actividad: 'Clase y taller', horas: 4, corte: i < 6 ? 1 : i < 11 ? 2 : 3,
        fechaPlaneada: f, ejecutado: pasada && i % 5 !== 4, fechaEjecucion: pasada && i % 5 !== 4 ? f : null };
    });
    await em.save(DetallePlanMicrocurriculo, dets);

    // Asistencias cerradas de semanas anteriores (para ver porcentajes y alertas).
    for (let s = 0; s < 6; s++) {
      const f = sumarDias(periodo.fechaInicio, s * 7);
      if (f >= hoy) break;
      const a = await em.save(Asistencia, { cargaId: cIs2.id, horarioId: null, aulaId: a301.id, fecha: f, tema: temas[s], horaApertura: new Date(f + 'T13:00:00Z'), toleranciaMin: 15, estado: EstadoAsistencia.CERRADA, cerradaEn: new Date(f + 'T15:00:00Z') });
      for (let i = 0; i < estudiantes.length; i++) {
        const estado = i === 3 && s % 2 === 0 ? EstadoAsistente.AUSENTE : i === 5 && s === 2 ? EstadoAsistente.TARDE : EstadoAsistente.PRESENTE;
        await em.save(DetalleAsistencia, { asistenciaId: a.id, estudianteId: estudiantes[i].id, estado, origen: estado === EstadoAsistente.AUSENTE ? OrigenRegistro.SISTEMA : OrigenRegistro.SENSOR, horaRegistro: estado === EstadoAsistente.AUSENTE ? null : new Date(f + 'T13:05:00Z') });
      }
    }

    // Notas del primer corte (cerrado) de Ingeniería de Software II.
    const uDimas = await em.findOneByOrFail(Docente, { id: dDimas.id });
    const notas1 = [4.2, 3.8, 4.5, 2.6, 3.9, 4.0, 3.1, 4.7, 3.5, 2.9];
    for (let i = 0; i < insIs2.length; i++) await em.save(Calificacion, { inscripcionId: insIs2[i].id, corte: 1, nota: notas1[i], registradaPorId: uDimas.usuarioId });
    await em.update(CargaAcademica, cIs2.id, { ultimoCorteCerrado: 1 });

    // Alertas tempranas que el sistema habría generado con estos datos.
    const n = (i: number) => `${nombres[i][0]} ${nombres[i][1]}`;
    const alertas: Partial<Alerta>[] = [
      { tipo: TipoAlerta.INASISTENCIA, programaId: sis.id, estudianteId: estudiantes[3].id, cargaId: cIs2.id, clave: `INASIST-${cIs2.id}-${estudiantes[3].id}`, mensaje: `${n(3)} lleva 50 % de fallas en Ingeniería de Software II grupo A (umbral 20 %).` },
      ...notas1.map((x, i) => ({ x, i })).filter(({ x }) => x < 3).map(({ x, i }) => ({
        tipo: TipoAlerta.NOTA_BAJA, programaId: sis.id, estudianteId: estudiantes[i].id, cargaId: cIs2.id, clave: `NOTA-${cIs2.id}-${estudiantes[i].id}-1`,
        mensaje: `${n(i)} obtuvo ${x.toFixed(1)} en el corte 1 de Ingeniería de Software II grupo A.`,
      })),
    ];
    await em.save(Alerta, alertas);

    // Sensor del aula 301 (token de demo para el simulador).
    await em.save(SensorAsistencia, { codigo: 'SENSOR-301', aulaId: a301.id, tokenHash: await bcrypt.hash(SENSOR_TOKEN, 10), ultimaSenal: new Date() });
  });

  console.log(`
Datos de ejemplo creados.

  Administrador  admin@cul.edu.co        Admin2026*
  Coordinador    coordinador@cul.edu.co  Coord2026*
  Docente        docente@cul.edu.co      Docente2026*
  Estudiante     estudiante@cul.edu.co   Estudiante2026*

  Sensor del aula 301: código SENSOR-301, token ${SENSOR_TOKEN}
`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
