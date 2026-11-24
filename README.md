# back-academic-system

API del **Sistema Académico** (Ingeniería de Software II · CUL), hecha con NestJS 11, TypeORM y MySQL.

## Requisitos

- Node.js 20 o superior
- MySQL 8 (o MariaDB 10.6+). Se administra con DBeaver.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # ajusta DB_USER, DB_PASSWORD y JWT_SECRET
```

1. Crea la base `academic_system` y sus tablas en DBeaver con el script SQL del proyecto.
   Mientras tanto, para desarrollo, puedes poner `DB_SYNC=true` en `.env` y TypeORM crea las tablas solo al arrancar.
2. Carga los datos de ejemplo: `npm run seed` (con `-- --force` borra todo y vuelve a sembrar).
3. Arranca la API: `npm run start:dev` → `http://localhost:3001/api`

### Usuarios de prueba (después del seed)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@cul.edu.co | Admin2026* |
| Coordinador (Ing. de Sistemas) | coordinador@cul.edu.co | Coord2026* |
| Docente | docente@cul.edu.co | Docente2026* |
| Estudiante | estudiante@cul.edu.co | Estudiante2026* |

Los demás estudiantes y docentes del seed usan `Estudiante2026*` y `Docente2026*`.

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | API con recarga automática |
| `npm run seed` | Datos de ejemplo (periodo 2026-2, 6 grupos, 10 estudiantes, notas, asistencias, plan) |
| `npm run sensor -- EST-0001 EST-0002` | Simula el sensor del aula 301 enviando lecturas de carné (HT-04) |
| `npm run sensor -- --offline 5 EST-0003` | Simula 5 minutos sin red: guarda y reenvía con la hora real |
| `node scripts/probar-casos.mjs` | Ejecuta los casos CP-01 a CP-12 del plan de pruebas contra la API (61 verificaciones) |
| `npm test` | Pruebas unitarias de las reglas de cruces y cálculo de notas |

## Estructura

```
src/
  common/          guardas JWT y de rol, auditoría, utilidades
  database/
    entities/      modelo normalizado (25 tablas)
    seed.ts        datos de ejemplo
  modules/
    auth/          inicio de sesión, bloqueo tras 5 intentos, cambio de contraseña
    estructura/    facultades, programas, materias, sedes, aulas, periodos
    personas/      usuarios y roles, coordinadores, docentes (+ materias habilitadas), estudiantes (+ carga masiva CSV)
    academico/     carga académica con validación de cruces, horarios, inscripción
    microcurriculo/ microcurrículo, unidades, prerrequisitos, plan del periodo y seguimiento (semáforo)
    asistencia/    sesiones, sensor (lecturas, cola, señal de vida), registro manual y por QR, correcciones
    notas/         notas por corte, cierre de corte, solicitudes de cambio con aprobación
    alertas/       alertas tempranas (inasistencia, nota baja, sensor sin señal, cambio de nota)
    dashboard/     indicadores por rol y consulta de auditoría
```

## Cómo se aplican los documentos del proyecto

- **Ajustes al modelo (plan ágil, sección 4.5):** las tablas guardan llaves y no nombres repetidos; los horarios salen de la carga académica; se agregaron `calificacion`, `detalle_plan_microcurriculo`, `usuario` con rol, `sede` y `periodo`.
- **Riesgos R01–R08:** el sensor se autentica con token, sus lecturas atrasadas conservan la hora real y, si no hay clase abierta, quedan en cola. Las notas no se editan después del cierre de corte: se pide el cambio y el coordinador lo aprueba. Todo cambio queda en la tabla `auditoria`. Cada rol ve solo sus datos y el docente no ve SISBEN ni ICFES. La inscripción bloquea el grupo para que no se pase del cupo.
- **Funciones críticas:** autenticación por rol, calificaciones, datos personales y bitácora de auditoría.

## Endpoints principales

Todos van bajo `/api` y requieren `Authorization: Bearer <token>`, salvo `POST /auth/login` y los del sensor.

| Método y ruta | Rol |
|---|---|
| `POST /auth/login`, `GET /auth/me`, `POST /auth/cambiar-password` | todos |
| `GET/POST/PATCH /facultades, /programas, /materias, /sedes, /aulas, /periodos` | lectura: todos · escritura: admin |
| `GET/POST/PATCH /usuarios, /coordinadores, /docentes, /estudiantes` · `POST /estudiantes/carga-masiva` | admin |
| `GET/POST/PATCH/DELETE /carga` · `POST /carga/validar` | coordinador |
| `GET /horarios/mio` · `GET /inscripciones/oferta` · `POST /inscripciones` | docente / estudiante |
| `/microcurriculos/*`, `/unidades/*`, `/planes/*` | coordinador (docente reporta avance) |
| `POST /asistencias` · `/asistencias/:id/cerrar` · `/manual` · `/qr` · `PATCH /asistencias/detalle/:id` | docente |
| `POST /sensor/lecturas`, `POST /sensor/heartbeat` (cabeceras `x-sensor-codigo`, `x-sensor-token`) | dispositivo |
| `PUT /calificaciones/grupo/:id` · `POST .../cerrar-corte` · `/solicitudes-nota/*` | docente / coordinador |
| `GET /alertas` · `GET /dashboard` · `GET /auditoria` | según rol |
