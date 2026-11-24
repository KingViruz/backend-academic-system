-- =====================================================================
--  SISTEMA ACADÉMICO · Datos de ejemplo (OPCIONAL)
--
--  Ejecútalo DESPUÉS de 01_academic_system_esquema.sql, solo si quieres una
--  base de demostración. No lo uses en una base con datos reales.
--  Usa INSERT IGNORE: si lo corres dos veces no duplica nada.
--
--  Contiene: periodo 2026-2, Facultad de Ingeniería y 2 más, 3 programas,
--  6 materias, 3 aulas, 1 coordinador, 3 docentes, 10 estudiantes, 6 grupos,
--  20 inscripciones, 2 microcurrículos publicados, 1 plan con 16 sesiones,
--  6 asistencias cerradas, notas del corte 1, 3 alertas y 1 sensor.
--
--  Usuarios (contraseña de cada rol):
--    admin@cul.edu.co        Admin2026*
--    coordinador@cul.edu.co  Coord2026*        (Ingeniería de Sistemas)
--    docente@cul.edu.co      Docente2026*      (y apayares@, smercado@)
--    estudiante@cul.edu.co   Estudiante2026*   (y los otros 9 estudiantes)
--  Sensor del aula 301: código SENSOR-301, token demo-token-sensor-301
-- =====================================================================

USE `academic_system`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- usuario (15 filas)
INSERT  IGNORE INTO `usuario` (`id`, `tipo_identificacion`, `identificacion`, `nombres`, `apellidos`, `email`, `celular`, `password_hash`, `rol`, `activo`, `intentos_fallidos`, `bloqueado_hasta`, `ultimo_acceso`, `created_at`, `updated_at`) VALUES
  (1,'CC','1000000001','Alberto','Muñoz','admin@cul.edu.co','3001000001','$2b$10$AWiJnbclP3y1AkPMZR0uk.TGpMnIsN.wNclp1M1f6FpdFVQ61EttK','ADMIN',1,0,NULL,NULL,'2026-11-24 17:43:29.971425','2026-11-24 17:43:29.971425'),
  (2,'CC','1000000002','Rafael','Manotas','coordinador@cul.edu.co','3001000002','$2b$10$IdTFANYTZ7SicVc3Bw8KeeItBsdTnuUqxV7P2iguFGa9a2eHQSzyW','COORDINADOR',1,0,NULL,NULL,'2026-11-24 17:43:30.063709','2026-11-24 17:43:30.063709'),
  (3,'CC','1000000003','Dimas','Bautte','docente@cul.edu.co',NULL,'$2b$10$inzQaVXY0iDDMsTMqSsdEesfpGqpIodn7G4ydSANlho29/FTa6Q6u','DOCENTE',1,0,NULL,NULL,'2026-11-24 17:43:30.154757','2026-11-24 17:43:30.154757'),
  (4,'CC','1000000004','Alejandro','Payares','apayares@cul.edu.co',NULL,'$2b$10$fVaX2xLkqZtUrPj9nU17/uQgbPaVwWwUXNq/j1xYKlzvLgFWfMs/m','DOCENTE',1,0,NULL,NULL,'2026-11-24 17:43:30.273579','2026-11-24 17:43:30.273579'),
  (5,'CC','1000000005','Sebastián','Mercado','smercado@cul.edu.co',NULL,'$2b$10$JmVQ9nLHqG5/EmGrQbAX5uQ6wig/QwVBErli9ZLwvObPbGkRMxwx6','DOCENTE',1,0,NULL,NULL,'2026-11-24 17:43:30.373427','2026-11-24 17:43:30.373427'),
  (6,'CC','2000000001','Sebastian','Burgos','estudiante@cul.edu.co',NULL,'$2b$10$8b3CmXTOBgEN3OggyGySBOdt1K8nnO7XZt1y1YpbZpHcA6wxh3TYO','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.465629','2026-11-24 17:43:30.465629'),
  (7,'CC','2000000002','Laura','Pérez','laura.perez@cul.edu.co',NULL,'$2b$10$WcU6UMammEyYFghhGo5cue3lPyrDhSwTWDh5b2vdRFDoAHfV.RXHS','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.564163','2026-11-24 17:43:30.564163'),
  (8,'CC','2000000003','Andrés','Gómez','andres.gomez@cul.edu.co',NULL,'$2b$10$X4mpsWmrkuE6KZLVUYHlie4QPvSR8QV2LfHT6PoJx7LH.av0okSeC','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.655722','2026-11-24 17:43:30.655722'),
  (9,'CC','2000000004','Valentina','Rojas','valentina.rojas@cul.edu.co',NULL,'$2b$10$8uRhI4Vbm9O0hSaGc.mhPegAaliraNt2kADgJg6IjR5z0WQ7msqR.','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.746187','2026-11-24 17:43:30.746187'),
  (10,'CC','2000000005','Camilo','Torres','camilo.torres@cul.edu.co',NULL,'$2b$10$BqsAA7tIfQk6HCgLyTVQx.3x5o8xlxSHpYq24qCSkZ3oiOl4FT5fe','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.842130','2026-11-24 17:43:30.842130'),
  (11,'CC','2000000006','Daniela','Herrera','daniela.herrera@cul.edu.co',NULL,'$2b$10$Zh1nu0OXLAkrTqDupHSGUe71YBMNQ97WT6KqTeISKp2Jc0iGdQtra','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:30.934300','2026-11-24 17:43:30.934300'),
  (12,'CC','2000000007','Mateo','Castro','mateo.castro@cul.edu.co',NULL,'$2b$10$oDQUhuKE6846nSajLctsoO55Xtovtufc8F9Y70G8DhrgRC02loI7a','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:31.025237','2026-11-24 17:43:31.025237'),
  (13,'CC','2000000008','Sofía','Ruiz','sofia.ruiz@cul.edu.co',NULL,'$2b$10$B9wDC8oNaKsuA8d2Oy6cCuu5u0u.WoIMYZJehhV3FLqBJTqObJJR6','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:31.122526','2026-11-24 17:43:31.122526'),
  (14,'CC','2000000009','Juan','Díaz','juan.diaz@cul.edu.co',NULL,'$2b$10$/XExoqJHw3s5HTmy4TA/5eygxouJfhorQPdED6voQuQexmNJiAwl2','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:31.213331','2026-11-24 17:43:31.213331'),
  (15,'CC','2000000010','Mariana','López','mariana.lopez@cul.edu.co',NULL,'$2b$10$.sXNWsJA5mU5BeiwHQ8E3eWeERNvuribAjl7sd5XT21SV/k/guNSK','ESTUDIANTE',1,0,NULL,NULL,'2026-11-24 17:43:31.305784','2026-11-24 17:43:31.305784');

-- facultad (2 filas)
INSERT  IGNORE INTO `facultad` (`id`, `codigo`, `nombre`, `activo`, `created_at`) VALUES
  (1,'FING','Facultad de Ingeniería',1,'2026-11-24 17:43:29.834051'),
  (2,'FCAE','Facultad de Ciencias Administrativas',1,'2026-11-24 17:43:29.841114');

-- programa (3 filas)
INSERT  IGNORE INTO `programa` (`id`, `codigo`, `nombre`, `creditos`, `facultad_id`, `activo`, `created_at`) VALUES
  (1,'ING-SIS','Ingeniería de Sistemas',160,1,1,'2026-11-24 17:43:29.843786'),
  (2,'ING-IND','Ingeniería Industrial',158,1,1,'2026-11-24 17:43:29.846964'),
  (3,'ADM-EMP','Administración de Empresas',150,2,1,'2026-11-24 17:43:29.849202');

-- materia (6 filas)
INSERT  IGNORE INTO `materia` (`id`, `codigo`, `nombre`, `creditos`, `activo`, `created_at`) VALUES
  (1,'SIS101','Programación I',3,1,'2026-11-24 17:43:29.851585'),
  (2,'SIS201','Estructuras de Datos',3,1,'2026-11-24 17:43:29.854326'),
  (3,'SIS301','Bases de Datos',4,1,'2026-11-24 17:43:29.856154'),
  (4,'SIS402','Ingeniería de Software II',4,1,'2026-11-24 17:43:29.857608'),
  (5,'MAT101','Cálculo Diferencial',3,1,'2026-11-24 17:43:29.859607'),
  (6,'HUM110','Ética Profesional',2,1,'2026-11-24 17:43:29.860731');

-- sede (1 filas)
INSERT  IGNORE INTO `sede` (`id`, `nombre`, `direccion`, `activo`) VALUES
  (1,'Sede Centro','Barranquilla',1);

-- aula (3 filas)
INSERT  IGNORE INTO `aula` (`id`, `sede_id`, `codigo`, `capacidad`, `activo`) VALUES
  (1,1,'301',35,1),
  (2,1,'205',30,1),
  (3,1,'LAB-1',25,1);

-- periodo (2 filas)
INSERT  IGNORE INTO `periodo` (`id`, `codigo`, `fecha_inicio`, `fecha_fin`, `limite_creditos`, `actual`) VALUES
  (1,'2026-2','2026-07-27','2026-12-12',20,1),
  (2,'2026-1','2026-02-02','2026-06-13',20,0);

-- coordinador (1 filas)
INSERT  IGNORE INTO `coordinador` (`id`, `usuario_id`, `programa_id`) VALUES
  (1,2,1);

-- docente (3 filas)
INSERT  IGNORE INTO `docente` (`id`, `usuario_id`, `profesion`, `fecha_nacimiento`, `direccion`) VALUES
  (1,3,'Ingeniero de Sistemas',NULL,NULL),
  (2,4,'Ingeniero de Sistemas',NULL,NULL),
  (3,5,'Ingeniero de Sistemas',NULL,NULL);

-- materia_docente (8 filas)
INSERT  IGNORE INTO `materia_docente` (`docente_id`, `materia_id`) VALUES
  (1,1),
  (1,3),
  (1,4),
  (2,1),
  (2,2),
  (2,5),
  (3,5),
  (3,6);

-- estudiante (10 filas)
INSERT  IGNORE INTO `estudiante` (`id`, `usuario_id`, `codigo_carne`, `programa_id`, `semestre`, `fecha_nacimiento`, `fecha_expedicion`, `direccion`, `acudiente_nombre`, `acudiente_telefono`, `puntaje_icfes`, `sisben`) VALUES
  (1,6,'EST-0001',1,7,'2000-01-15','2018-01-20',NULL,NULL,NULL,280,'A3'),
  (2,7,'EST-0002',1,7,'2001-02-15','2019-02-20',NULL,NULL,NULL,287,'B2'),
  (3,8,'EST-0003',1,7,'2002-03-15','2020-03-20',NULL,NULL,NULL,294,'C1'),
  (4,9,'EST-0004',1,7,'2003-04-15','2021-04-20',NULL,NULL,NULL,301,'B5'),
  (5,10,'EST-0005',1,7,'2000-05-15','2018-05-20',NULL,NULL,NULL,308,'A3'),
  (6,11,'EST-0006',1,7,'2001-06-15','2019-06-20',NULL,NULL,NULL,315,'B2'),
  (7,12,'EST-0007',1,7,'2002-07-15','2020-07-20',NULL,NULL,NULL,322,'C1'),
  (8,13,'EST-0008',1,7,'2003-08-15','2021-08-20',NULL,NULL,NULL,329,'B5'),
  (9,14,'EST-0009',1,7,'2000-09-15','2018-09-20',NULL,NULL,NULL,336,'A3'),
  (10,15,'EST-0010',1,7,'2001-01-15','2019-01-20',NULL,NULL,NULL,343,'B2');

-- carga_academica (6 filas)
INSERT  IGNORE INTO `carga_academica` (`id`, `periodo_id`, `programa_id`, `materia_id`, `docente_id`, `grupo`, `cupo`, `ultimo_corte_cerrado`, `created_at`) VALUES
  (1,1,1,4,1,'A',30,1,'2026-11-24 17:43:31.309821'),
  (2,1,1,3,1,'A',30,0,'2026-11-24 17:43:31.315922'),
  (3,1,1,2,2,'A',30,0,'2026-11-24 17:43:31.319322'),
  (4,1,1,5,2,'B',25,0,'2026-11-24 17:43:31.321438'),
  (5,1,1,6,3,'A',30,0,'2026-11-24 17:43:31.323403'),
  (6,1,1,1,1,'C',25,0,'2026-11-24 17:43:31.325056');

-- horario_clase (9 filas)
INSERT  IGNORE INTO `horario_clase` (`id`, `carga_id`, `aula_id`, `dia`, `hora_inicio`, `hora_fin`) VALUES
  (1,1,1,1,'08:00:00','10:00:00'),
  (2,1,1,3,'08:00:00','10:00:00'),
  (3,2,3,2,'10:00:00','12:00:00'),
  (4,2,3,4,'10:00:00','12:00:00'),
  (5,3,2,1,'10:00:00','12:00:00'),
  (6,3,2,5,'08:00:00','10:00:00'),
  (7,4,2,2,'14:00:00','16:00:00'),
  (8,5,1,4,'14:00:00','16:00:00'),
  (9,6,3,5,'14:00:00','17:00:00');

-- inscripcion (20 filas)
INSERT  IGNORE INTO `inscripcion` (`id`, `estudiante_id`, `carga_id`, `created_at`) VALUES
  (1,1,1,'2026-11-24 17:43:31.326778'),
  (2,1,2,'2026-11-24 17:43:31.328995'),
  (3,2,1,'2026-11-24 17:43:31.329980'),
  (4,2,2,'2026-11-24 17:43:31.330962'),
  (5,3,1,'2026-11-24 17:43:31.332247'),
  (6,3,2,'2026-11-24 17:43:31.333252'),
  (7,4,1,'2026-11-24 17:43:31.334337'),
  (8,4,2,'2026-11-24 17:43:31.335450'),
  (9,5,1,'2026-11-24 17:43:31.336337'),
  (10,5,2,'2026-11-24 17:43:31.337366'),
  (11,6,1,'2026-11-24 17:43:31.338325'),
  (12,6,2,'2026-11-24 17:43:31.339263'),
  (13,7,1,'2026-11-24 17:43:31.340003'),
  (14,7,2,'2026-11-24 17:43:31.340701'),
  (15,8,1,'2026-11-24 17:43:31.341342'),
  (16,8,2,'2026-11-24 17:43:31.342015'),
  (17,9,1,'2026-11-24 17:43:31.343058'),
  (18,9,2,'2026-11-24 17:43:31.343941'),
  (19,10,1,'2026-11-24 17:43:31.344656'),
  (20,10,2,'2026-11-24 17:43:31.345769');

-- microcurriculo (2 filas)
INSERT  IGNORE INTO `microcurriculo` (`id`, `materia_id`, `programa_id`, `descripcion`, `objetivo_general`, `objetivos_especificos`, `competencias_genericas`, `estrategias`, `bibliografia`, `porcentaje_p1`, `porcentaje_p2`, `porcentaje_p3`, `estado`, `publicado_en`, `updated_at`) VALUES
  (1,4,1,'Gestión de proyectos de software con métodos ágiles, análisis de riesgos, pruebas y trazabilidad.','Planear, construir y validar un producto de software aplicando una metodología ágil y gestión de riesgos.','Construir un Product Backlog; diseñar casos de prueba; elaborar una matriz de riesgos.','Trabajo en equipo, comunicación técnica, pensamiento crítico.','Aprendizaje basado en proyectos, sprints quincenales, revisiones con el cliente.','Sommerville, I. Ingeniería de Software. Schwaber & Sutherland. La Guía de Scrum.',30,30,40,'PUBLICADO','2026-11-24 17:43:31','2026-11-24 17:43:31.347205'),
  (2,3,1,'Modelado y gestión de bases de datos relacionales.','Diseñar y consultar bases de datos normalizadas.',NULL,'Pensamiento lógico, abstracción.',NULL,NULL,30,30,40,'PUBLICADO','2026-11-24 17:43:31','2026-11-24 17:43:31.350918');

-- microcurriculo_prerrequisito (1 filas)
INSERT  IGNORE INTO `microcurriculo_prerrequisito` (`microcurriculo_id`, `materia_id`) VALUES
  (1,3);

-- unidad_tematica (3 filas)
INSERT  IGNORE INTO `unidad_tematica` (`id`, `microcurriculo_id`, `numero`, `nombre`, `competencia_especifica`, `resultado_aprendizaje`, `nivel_superior`, `nivel_normal`, `nivel_bajo`, `nivel_deficiente`) VALUES
  (1,1,1,'Metodologías ágiles','Selecciona y justifica un enfoque ágil para un proyecto.','Construye un plan de desarrollo con Scrum.','Justifica con evidencia del proyecto y adapta el marco.','Justifica la elección con criterios generales.','Describe la metodología sin relacionarla con el proyecto.','No justifica la elección.'),
  (2,1,2,'Gestión de riesgos','Identifica, valora y mitiga riesgos del software.','Elabora matriz de riesgos e Ishikawa.','Prioriza con datos y conecta mitigaciones al backlog.','Matriz completa con mitigaciones.','Matriz incompleta.','No identifica riesgos concretos.'),
  (3,1,3,'Pruebas y trazabilidad','Diseña casos de prueba trazables a requisitos.','Construye plan de pruebas con matriz de trazabilidad.','Usa técnicas de diseño y cubre funciones críticas.','Casos completos y trazables.','Casos sin datos o resultados esperados.','No diseña casos verificables.');

-- plan_microcurriculo (1 filas)
INSERT  IGNORE INTO `plan_microcurriculo` (`id`, `microcurriculo_id`, `carga_id`, `fecha_inicio`, `fecha_fin`, `total_horas`) VALUES
  (1,1,1,'2026-07-27','2026-12-12',64);

-- detalle_plan_microcurriculo (16 filas)
INSERT  IGNORE INTO `detalle_plan_microcurriculo` (`id`, `plan_id`, `semana`, `unidad_id`, `tema`, `actividad`, `horas`, `corte`, `fecha_planeada`, `ejecutado`, `fecha_ejecucion`, `observaciones`) VALUES
  (1,1,1,1,'Encuadre y proyecto','Clase y taller',4,1,'2026-07-27',1,'2026-07-27',NULL),
  (2,1,2,1,'Scrum: roles y eventos','Clase y taller',4,1,'2026-08-03',1,'2026-08-03',NULL),
  (3,1,3,1,'Product Backlog','Clase y taller',4,1,'2026-08-10',1,'2026-08-10',NULL),
  (4,1,4,1,'Historias de usuario','Clase y taller',4,1,'2026-08-17',1,'2026-08-17',NULL),
  (5,1,5,1,'Planeación de sprints','Clase y taller',4,1,'2026-08-24',0,NULL,NULL),
  (6,1,6,1,'Estimación','Clase y taller',4,1,'2026-08-31',1,'2026-08-31',NULL),
  (7,1,7,2,'Riesgos: identificación','Clase y taller',4,2,'2026-09-07',1,'2026-09-07',NULL),
  (8,1,8,2,'Matriz de riesgos','Clase y taller',4,2,'2026-09-14',1,'2026-09-14',NULL),
  (9,1,9,2,'Ishikawa y 5 porqués','Clase y taller',4,2,'2026-09-21',1,'2026-09-21',NULL),
  (10,1,10,2,'Criticidad','Clase y taller',4,2,'2026-09-28',0,NULL,NULL),
  (11,1,11,2,'Diseño de pruebas','Clase y taller',4,2,'2026-10-05',1,'2026-10-05',NULL),
  (12,1,12,2,'Valores límite','Clase y taller',4,3,'2026-10-12',1,'2026-10-12',NULL),
  (13,1,13,3,'Trazabilidad','Clase y taller',4,3,'2026-10-19',1,'2026-10-19',NULL),
  (14,1,14,3,'Pruebas de carga','Clase y taller',4,3,'2026-10-26',1,'2026-10-26',NULL),
  (15,1,15,3,'Revisión del proyecto','Clase y taller',4,3,'2026-11-02',0,NULL,NULL),
  (16,1,16,3,'Sustentación','Clase y taller',4,3,'2026-11-09',1,'2026-11-09',NULL);

-- sensor_asistencia (1 filas)
INSERT  IGNORE INTO `sensor_asistencia` (`id`, `codigo`, `aula_id`, `token_hash`, `ultima_senal`, `activo`) VALUES
  (1,'SENSOR-301',1,'$2b$10$71oSX0BC.Lwwr9icOPjLrOVP6lclErD9G4L2fWY1iqh91449vCAFC','2026-11-24 17:43:32',1);

-- asistencia (6 filas)
INSERT  IGNORE INTO `asistencia` (`id`, `carga_id`, `horario_id`, `aula_id`, `fecha`, `tema`, `hora_apertura`, `tolerancia_min`, `estado`, `cerrada_en`) VALUES
  (1,1,NULL,1,'2026-07-27','Encuadre y proyecto','2026-07-27 13:00:00',15,'CERRADA','2026-07-27 15:00:00'),
  (2,1,NULL,1,'2026-08-03','Scrum: roles y eventos','2026-08-03 13:00:00',15,'CERRADA','2026-08-03 15:00:00'),
  (3,1,NULL,1,'2026-08-10','Product Backlog','2026-08-10 13:00:00',15,'CERRADA','2026-08-10 15:00:00'),
  (4,1,NULL,1,'2026-08-17','Historias de usuario','2026-08-17 13:00:00',15,'CERRADA','2026-08-17 15:00:00'),
  (5,1,NULL,1,'2026-08-24','Planeación de sprints','2026-08-24 13:00:00',15,'CERRADA','2026-08-24 15:00:00'),
  (6,1,NULL,1,'2026-08-31','Estimación','2026-08-31 13:00:00',15,'CERRADA','2026-08-31 15:00:00');

-- detalle_asistencia (60 filas)
INSERT  IGNORE INTO `detalle_asistencia` (`id`, `asistencia_id`, `estudiante_id`, `estado`, `hora_registro`, `origen`, `motivo`, `updated_at`) VALUES
  (1,1,1,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.381431'),
  (2,1,2,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.383805'),
  (3,1,3,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.386108'),
  (4,1,4,'AUSENTE',NULL,'SISTEMA',NULL,'2026-11-24 17:43:31.387379'),
  (5,1,5,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.389014'),
  (6,1,6,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.390335'),
  (7,1,7,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.391785'),
  (8,1,8,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.393329'),
  (9,1,9,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.394481'),
  (10,1,10,'PRESENTE','2026-07-27 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.395518'),
  (11,2,1,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.398180'),
  (12,2,2,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.399219'),
  (13,2,3,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.400285'),
  (14,2,4,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.401271'),
  (15,2,5,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.402263'),
  (16,2,6,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.403203'),
  (17,2,7,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.404303'),
  (18,2,8,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.406838'),
  (19,2,9,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.408575'),
  (20,2,10,'PRESENTE','2026-08-03 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.409685'),
  (21,3,1,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.411900'),
  (22,3,2,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.412986'),
  (23,3,3,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.414027'),
  (24,3,4,'AUSENTE',NULL,'SISTEMA',NULL,'2026-11-24 17:43:31.414944'),
  (25,3,5,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.415995'),
  (26,3,6,'TARDE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.417002'),
  (27,3,7,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.417835'),
  (28,3,8,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.418841'),
  (29,3,9,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.419766'),
  (30,3,10,'PRESENTE','2026-08-10 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.420626'),
  (31,4,1,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.422444'),
  (32,4,2,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.423319'),
  (33,4,3,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.424302'),
  (34,4,4,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.425339'),
  (35,4,5,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.426943'),
  (36,4,6,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.428142'),
  (37,4,7,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.429538'),
  (38,4,8,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.430875'),
  (39,4,9,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.432049'),
  (40,4,10,'PRESENTE','2026-08-17 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.433149'),
  (41,5,1,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.435764'),
  (42,5,2,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.436905'),
  (43,5,3,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.437865'),
  (44,5,4,'AUSENTE',NULL,'SISTEMA',NULL,'2026-11-24 17:43:31.439252'),
  (45,5,5,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.440589'),
  (46,5,6,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.441761'),
  (47,5,7,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.442876'),
  (48,5,8,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.443724'),
  (49,5,9,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.444483'),
  (50,5,10,'PRESENTE','2026-08-24 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.445237'),
  (51,6,1,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.447137'),
  (52,6,2,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.448550'),
  (53,6,3,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.449854'),
  (54,6,4,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.451227'),
  (55,6,5,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.452332'),
  (56,6,6,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.455308'),
  (57,6,7,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.456344'),
  (58,6,8,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.457409'),
  (59,6,9,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.458474'),
  (60,6,10,'PRESENTE','2026-08-31 13:05:00','SENSOR',NULL,'2026-11-24 17:43:31.459450');

-- calificacion (10 filas)
INSERT  IGNORE INTO `calificacion` (`id`, `inscripcion_id`, `corte`, `nota`, `registrada_por_id`, `updated_at`) VALUES
  (1,1,1,4.2,3,'2026-11-24 17:43:31.462797'),
  (2,3,1,3.8,3,'2026-11-24 17:43:31.465786'),
  (3,5,1,4.5,3,'2026-11-24 17:43:31.466958'),
  (4,7,1,2.6,3,'2026-11-24 17:43:31.468010'),
  (5,9,1,3.9,3,'2026-11-24 17:43:31.469097'),
  (6,11,1,4.0,3,'2026-11-24 17:43:31.470137'),
  (7,13,1,3.1,3,'2026-11-24 17:43:31.471071'),
  (8,15,1,4.7,3,'2026-11-24 17:43:31.471977'),
  (9,17,1,3.5,3,'2026-11-24 17:43:31.472907'),
  (10,19,1,2.9,3,'2026-11-24 17:43:31.473810');

-- alerta (3 filas)
INSERT  IGNORE INTO `alerta` (`id`, `tipo`, `programa_id`, `estudiante_id`, `carga_id`, `mensaje`, `clave`, `atendida`, `atendida_por_id`, `created_at`) VALUES
  (1,'INASISTENCIA',1,4,1,'Valentina Rojas lleva 50 % de fallas en Ingeniería de Software II grupo A (umbral 20 %).','INASIST-1-4',0,NULL,'2026-11-24 17:43:31.476947'),
  (2,'NOTA_BAJA',1,4,1,'Valentina Rojas obtuvo 2.6 en el corte 1 de Ingeniería de Software II grupo A.','NOTA-1-4-1',0,NULL,'2026-11-24 17:43:31.478961'),
  (3,'NOTA_BAJA',1,10,1,'Mariana López obtuvo 2.9 en el corte 1 de Ingeniería de Software II grupo A.','NOTA-1-10-1',0,NULL,'2026-11-24 17:43:31.479947');

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
