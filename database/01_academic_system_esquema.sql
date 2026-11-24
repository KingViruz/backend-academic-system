-- =====================================================================
--  SISTEMA ACADÉMICO · Corporación Universitaria Latinoamericana (CUL)
--  Ingeniería de Software II · Script de base de datos
--
--  Motor:    MySQL 8.0+ (también funciona en MariaDB 10.6+)
--  Base:     academic_system  ·  utf8mb4 / utf8mb4_unicode_ci
--  Tablas:   27  (25 entidades + 2 tablas de relación)
--
--  Generado desde las entidades TypeORM de back-academic-system, así que
--  calza exactamente con la API. En el .env del backend deja DB_SYNC=false.
--
--  Cómo ejecutarlo en el VPS:
--    mysql -u root -p < 01_academic_system_esquema.sql
--  o ábrelo en DBeaver y ejecútalo como script (Alt+X).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `academic_system`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `academic_system`;

-- Usuario de la aplicación (recomendado: no conectar la API con root).
-- Quita los guiones de las 3 líneas, cambia la contraseña y ponla en el .env (DB_USER / DB_PASSWORD).
-- CREATE USER IF NOT EXISTS 'academic_app'@'localhost' IDENTIFIED BY 'CambiaEstaClave2026!';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON `academic_system`.* TO 'academic_app'@'localhost';
-- FLUSH PRIVILEGES;

SET NAMES utf8mb4;
SET time_zone = '+00:00';  -- la API guarda las fechas en UTC


-- =====================================================================
--  ACCESO Y SEGURIDAD
-- =====================================================================

-- usuario: Toda persona que entra al sistema. Rol, bloqueo tras intentos fallidos y contraseña cifrada (bcrypt).
CREATE TABLE IF NOT EXISTS `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_identificacion` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CC',
  `identificacion` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombres` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidos` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `celular` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('ADMIN','COORDINADOR','DOCENTE','ESTUDIANTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  `intentos_fallidos` int NOT NULL DEFAULT '0',
  `bloqueado_hasta` datetime DEFAULT NULL,
  `ultimo_acceso` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_20c34d3d4d493ccf42ce7d3313` (`identificacion`),
  UNIQUE KEY `IDX_2863682842e688ca198eb25c12` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  ESTRUCTURA INSTITUCIONAL
-- =====================================================================

-- facultad: Unidades académicas. El número de programas se calcula; no se guarda.
CREATE TABLE IF NOT EXISTS `facultad` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_8739cae819558972f5c7a9e620` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- programa: Programas de cada facultad.
CREATE TABLE IF NOT EXISTS `programa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creditos` int NOT NULL,
  `facultad_id` int NOT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_809fa56b256066a01e4fc41780` (`codigo`),
  KEY `FK_bc3b8040683e4b150d4e47814a0` (`facultad_id`),
  CONSTRAINT `FK_bc3b8040683e4b150d4e47814a0` FOREIGN KEY (`facultad_id`) REFERENCES `facultad` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- materia: Catálogo de materias. Con carga académica no se borran: se inactivan.
CREATE TABLE IF NOT EXISTS `materia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creditos` int NOT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_6d62d7f6267ed4a3175b9aabd2` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sede: Sedes físicas.
CREATE TABLE IF NOT EXISTS `sede` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_1a815cc4022416aec58ea34595` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- aula: Aulas por sede; el código es único dentro de la sede.
CREATE TABLE IF NOT EXISTS `aula` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sede_id` int NOT NULL,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacidad` int NOT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_e638499ce4c3357ea5eb326430` (`sede_id`,`codigo`),
  CONSTRAINT `FK_9a9efb705876adbbe4854b47c8b` FOREIGN KEY (`sede_id`) REFERENCES `sede` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- periodo: Periodos académicos. Solo uno está marcado como actual.
CREATE TABLE IF NOT EXISTS `periodo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `limite_creditos` int NOT NULL DEFAULT '20',
  `actual` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_42e7cda928763d91936650cb5f` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  PERSONAS
-- =====================================================================

-- coordinador: Un coordinador por programa (programa_id único).
CREATE TABLE IF NOT EXISTS `coordinador` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `programa_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_95466e05c0f936923f556e0840` (`usuario_id`),
  UNIQUE KEY `IDX_e04f49b375fa1f12dac61a7bc7` (`programa_id`),
  UNIQUE KEY `REL_95466e05c0f936923f556e0840` (`usuario_id`),
  CONSTRAINT `FK_95466e05c0f936923f556e0840c` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_e04f49b375fa1f12dac61a7bc73` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- docente: Datos adicionales del docente.
CREATE TABLE IF NOT EXISTS `docente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `profesion` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_08c9b5035edf75a6e788f25ce9` (`usuario_id`),
  UNIQUE KEY `REL_08c9b5035edf75a6e788f25ce9` (`usuario_id`),
  CONSTRAINT `FK_08c9b5035edf75a6e788f25ce9a` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- materia_docente: Materias que cada docente está habilitado para dictar.
CREATE TABLE IF NOT EXISTS `materia_docente` (
  `docente_id` int NOT NULL,
  `materia_id` int NOT NULL,
  PRIMARY KEY (`docente_id`,`materia_id`),
  KEY `IDX_7d42ae4bdcc94de5d7a577c16b` (`docente_id`),
  KEY `IDX_3c4d8fb0cff61c2f4803a81af6` (`materia_id`),
  CONSTRAINT `FK_3c4d8fb0cff61c2f4803a81af63` FOREIGN KEY (`materia_id`) REFERENCES `materia` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_7d42ae4bdcc94de5d7a577c16bb` FOREIGN KEY (`docente_id`) REFERENCES `docente` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- estudiante: Datos del estudiante. codigo_carne es lo que lee el sensor.
CREATE TABLE IF NOT EXISTS `estudiante` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `codigo_carne` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `programa_id` int NOT NULL,
  `semestre` int NOT NULL DEFAULT '1',
  `fecha_nacimiento` date NOT NULL,
  `fecha_expedicion` date NOT NULL,
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acudiente_nombre` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acudiente_telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `puntaje_icfes` int DEFAULT NULL,
  `sisben` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_8e18a9cefbd560324d29285640` (`usuario_id`),
  UNIQUE KEY `IDX_de737cd5bf914ea8b2ed281200` (`codigo_carne`),
  UNIQUE KEY `REL_8e18a9cefbd560324d29285640` (`usuario_id`),
  KEY `FK_2f33ca1f779237985ffb492ca41` (`programa_id`),
  CONSTRAINT `FK_2f33ca1f779237985ffb492ca41` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_8e18a9cefbd560324d292856406` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  CARGA ACADÉMICA, HORARIOS E INSCRIPCIÓN
-- =====================================================================

-- carga_academica: Grupo de una materia en un periodo con su docente y cupo. ultimo_corte_cerrado: 0 a 3.
CREATE TABLE IF NOT EXISTS `carga_academica` (
  `id` int NOT NULL AUTO_INCREMENT,
  `periodo_id` int NOT NULL,
  `programa_id` int NOT NULL,
  `materia_id` int NOT NULL,
  `docente_id` int NOT NULL,
  `grupo` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cupo` int NOT NULL,
  `ultimo_corte_cerrado` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_0ce23e6f5357b18ffc5bb028ad` (`periodo_id`,`programa_id`,`materia_id`,`grupo`),
  KEY `FK_1a0f2ab585064e5bcd40acc8179` (`programa_id`),
  KEY `FK_f163084919692b54f888eb7b12d` (`materia_id`),
  KEY `FK_9f6e2138154dc45e518e1d8f08d` (`docente_id`),
  CONSTRAINT `FK_19e08db2ea7ac32d25683bd83cd` FOREIGN KEY (`periodo_id`) REFERENCES `periodo` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_1a0f2ab585064e5bcd40acc8179` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_9f6e2138154dc45e518e1d8f08d` FOREIGN KEY (`docente_id`) REFERENCES `docente` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_f163084919692b54f888eb7b12d` FOREIGN KEY (`materia_id`) REFERENCES `materia` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- horario_clase: Franjas semanales de cada grupo (dia 1 = lunes … 6 = sábado). Los horarios de docente y estudiante se derivan de aquí.
CREATE TABLE IF NOT EXISTS `horario_clase` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carga_id` int NOT NULL,
  `aula_id` int NOT NULL,
  `dia` tinyint NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_5718cc659041b42f0c88940cfa3` (`carga_id`),
  KEY `FK_f54d2ae79d1e99d86b1e36ea6cb` (`aula_id`),
  CONSTRAINT `FK_5718cc659041b42f0c88940cfa3` FOREIGN KEY (`carga_id`) REFERENCES `carga_academica` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_f54d2ae79d1e99d86b1e36ea6cb` FOREIGN KEY (`aula_id`) REFERENCES `aula` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- inscripcion: Grupos que inscribe cada estudiante (antes HorarioEstudiante).
CREATE TABLE IF NOT EXISTS `inscripcion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estudiante_id` int NOT NULL,
  `carga_id` int NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_de81212f056d4057418f3e99c2` (`estudiante_id`,`carga_id`),
  KEY `FK_24149aca9283caaf4eda76c4a8a` (`carga_id`),
  CONSTRAINT `FK_24149aca9283caaf4eda76c4a8a` FOREIGN KEY (`carga_id`) REFERENCES `carga_academica` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_b0500333a29ab129a02805ad0f3` FOREIGN KEY (`estudiante_id`) REFERENCES `estudiante` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  MICROCURRÍCULO Y PLAN DEL PERIODO
-- =====================================================================

-- microcurriculo: Contenido programático de una materia en un programa; los tres porcentajes deben sumar 100 para publicar.
CREATE TABLE IF NOT EXISTS `microcurriculo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `materia_id` int NOT NULL,
  `programa_id` int NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `objetivo_general` text COLLATE utf8mb4_unicode_ci,
  `objetivos_especificos` text COLLATE utf8mb4_unicode_ci,
  `competencias_genericas` text COLLATE utf8mb4_unicode_ci,
  `estrategias` text COLLATE utf8mb4_unicode_ci,
  `bibliografia` text COLLATE utf8mb4_unicode_ci,
  `porcentaje_p1` int NOT NULL DEFAULT '30',
  `porcentaje_p2` int NOT NULL DEFAULT '30',
  `porcentaje_p3` int NOT NULL DEFAULT '40',
  `estado` enum('BORRADOR','PUBLICADO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BORRADOR',
  `publicado_en` datetime DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_98a2a8f839067e750596c98861` (`materia_id`,`programa_id`),
  KEY `FK_02b0ee65d8f0801a44e5f4b153d` (`programa_id`),
  CONSTRAINT `FK_02b0ee65d8f0801a44e5f4b153d` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_823bcdc18a024e2548ebc05ebc1` FOREIGN KEY (`materia_id`) REFERENCES `materia` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- microcurriculo_prerrequisito: Materias prerrequisito de cada microcurrículo.
CREATE TABLE IF NOT EXISTS `microcurriculo_prerrequisito` (
  `microcurriculo_id` int NOT NULL,
  `materia_id` int NOT NULL,
  PRIMARY KEY (`microcurriculo_id`,`materia_id`),
  KEY `IDX_eedde7b8f88e8da23b8a05afd1` (`microcurriculo_id`),
  KEY `IDX_2e4e17640a2364e33bb2aa547d` (`materia_id`),
  CONSTRAINT `FK_2e4e17640a2364e33bb2aa547d5` FOREIGN KEY (`materia_id`) REFERENCES `materia` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_eedde7b8f88e8da23b8a05afd11` FOREIGN KEY (`microcurriculo_id`) REFERENCES `microcurriculo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- unidad_tematica: Unidades con competencia, resultado de aprendizaje y niveles de desempeño.
CREATE TABLE IF NOT EXISTS `unidad_tematica` (
  `id` int NOT NULL AUTO_INCREMENT,
  `microcurriculo_id` int NOT NULL,
  `numero` int NOT NULL,
  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `competencia_especifica` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `resultado_aprendizaje` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel_superior` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel_normal` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel_bajo` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel_deficiente` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_62b05d5f29471170524f88762a7` (`microcurriculo_id`),
  CONSTRAINT `FK_62b05d5f29471170524f88762a7` FOREIGN KEY (`microcurriculo_id`) REFERENCES `microcurriculo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- plan_microcurriculo: Ejecución del microcurrículo en un grupo (un plan por grupo).
CREATE TABLE IF NOT EXISTS `plan_microcurriculo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `microcurriculo_id` int NOT NULL,
  `carga_id` int NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `total_horas` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_d79ba3b61c60984aca4bad7d57` (`carga_id`),
  KEY `FK_dd98bbaf88f8551cdaddb46b190` (`microcurriculo_id`),
  CONSTRAINT `FK_d79ba3b61c60984aca4bad7d571` FOREIGN KEY (`carga_id`) REFERENCES `carga_academica` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_dd98bbaf88f8551cdaddb46b190` FOREIGN KEY (`microcurriculo_id`) REFERENCES `microcurriculo` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- detalle_plan_microcurriculo: Sesiones semanales del plan y su ejecución real.
CREATE TABLE IF NOT EXISTS `detalle_plan_microcurriculo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `semana` int NOT NULL,
  `unidad_id` int NOT NULL,
  `tema` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actividad` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `horas` int NOT NULL,
  `corte` tinyint NOT NULL,
  `fecha_planeada` date NOT NULL,
  `ejecutado` tinyint NOT NULL DEFAULT '0',
  `fecha_ejecucion` date DEFAULT NULL,
  `observaciones` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_dcbdfbb0223485f76fefd615775` (`plan_id`),
  KEY `FK_bfd5543b171179ce0a190ac9966` (`unidad_id`),
  CONSTRAINT `FK_bfd5543b171179ce0a190ac9966` FOREIGN KEY (`unidad_id`) REFERENCES `unidad_tematica` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_dcbdfbb0223485f76fefd615775` FOREIGN KEY (`plan_id`) REFERENCES `plan_microcurriculo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  ASISTENCIA CON SENSOR
-- =====================================================================

-- sensor_asistencia: Sensores por aula. Solo se guarda el hash del token.
CREATE TABLE IF NOT EXISTS `sensor_asistencia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aula_id` int NOT NULL,
  `token_hash` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ultima_senal` datetime DEFAULT NULL,
  `activo` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_4541978eef61753bdb1343c6a3` (`codigo`),
  KEY `FK_a024c8296aa566362ab20693d20` (`aula_id`),
  CONSTRAINT `FK_a024c8296aa566362ab20693d20` FOREIGN KEY (`aula_id`) REFERENCES `aula` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- asistencia: Sesión de clase en la que se toma asistencia.
CREATE TABLE IF NOT EXISTS `asistencia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carga_id` int NOT NULL,
  `horario_id` int DEFAULT NULL,
  `aula_id` int NOT NULL,
  `fecha` date NOT NULL,
  `tema` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hora_apertura` datetime NOT NULL,
  `tolerancia_min` int NOT NULL DEFAULT '15',
  `estado` enum('ABIERTA','CERRADA') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ABIERTA',
  `cerrada_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_270fc4b09f60f5e2f24dcdc87e4` (`carga_id`),
  KEY `FK_450cbdffe16d30e5692cb7c3594` (`horario_id`),
  KEY `FK_d69e480893a609e2f2356e62438` (`aula_id`),
  CONSTRAINT `FK_270fc4b09f60f5e2f24dcdc87e4` FOREIGN KEY (`carga_id`) REFERENCES `carga_academica` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_450cbdffe16d30e5692cb7c3594` FOREIGN KEY (`horario_id`) REFERENCES `horario_clase` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_d69e480893a609e2f2356e62438` FOREIGN KEY (`aula_id`) REFERENCES `aula` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- detalle_asistencia: Estado de cada estudiante en la sesión (un registro por estudiante).
CREATE TABLE IF NOT EXISTS `detalle_asistencia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asistencia_id` int NOT NULL,
  `estudiante_id` int NOT NULL,
  `estado` enum('PRESENTE','TARDE','AUSENTE','EXCUSADO') COLLATE utf8mb4_unicode_ci NOT NULL,
  `hora_registro` datetime DEFAULT NULL,
  `origen` enum('SENSOR','MANUAL','QR','SISTEMA') COLLATE utf8mb4_unicode_ci NOT NULL,
  `motivo` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_0b9634560d456260b08e4c503c` (`asistencia_id`,`estudiante_id`),
  KEY `FK_d9bfbfaee9572d30136e9ca5be1` (`estudiante_id`),
  CONSTRAINT `FK_064007f9b16c2ad019cff7f4908` FOREIGN KEY (`asistencia_id`) REFERENCES `asistencia` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_d9bfbfaee9572d30136e9ca5be1` FOREIGN KEY (`estudiante_id`) REFERENCES `estudiante` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- lectura_sensor: Cada lectura enviada por un sensor; PENDIENTE = en cola hasta que se abra la clase.
CREATE TABLE IF NOT EXISTS `lectura_sensor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sensor_id` int NOT NULL,
  `codigo_carne` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `leido_en` datetime NOT NULL,
  `recibido_en` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `estado` enum('PROCESADA','DUPLICADA','RECHAZADA','PENDIENTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `detalle` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asistencia_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_a1394161bd6a26a440d02d80bf3` (`sensor_id`),
  CONSTRAINT `FK_a1394161bd6a26a440d02d80bf3` FOREIGN KEY (`sensor_id`) REFERENCES `sensor_asistencia` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  CALIFICACIONES
-- =====================================================================

-- calificacion: Nota por corte (1, 2 o 3) de cada inscripción, de 0.0 a 5.0.
CREATE TABLE IF NOT EXISTS `calificacion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inscripcion_id` int NOT NULL,
  `corte` tinyint NOT NULL,
  `nota` decimal(2,1) NOT NULL,
  `registrada_por_id` int NOT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_a000dbb3339db877a59e7f3aa0` (`inscripcion_id`,`corte`),
  KEY `FK_93e75722e1ddeae41a520b4f659` (`registrada_por_id`),
  CONSTRAINT `FK_93e75722e1ddeae41a520b4f659` FOREIGN KEY (`registrada_por_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_de93f67e3f95fe4793bd6c697e5` FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripcion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- solicitud_cambio_nota: Cambios de nota después del cierre de un corte; los aprueba el coordinador.
CREATE TABLE IF NOT EXISTS `solicitud_cambio_nota` (
  `id` int NOT NULL AUTO_INCREMENT,
  `calificacion_id` int NOT NULL,
  `nota_anterior` decimal(2,1) NOT NULL,
  `nota_nueva` decimal(2,1) NOT NULL,
  `motivo` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` enum('PENDIENTE','APROBADA','RECHAZADA') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',
  `solicitante_id` int NOT NULL,
  `aprobador_id` int DEFAULT NULL,
  `comentario` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `resuelta_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_31b471d4d3b57b14c0d546be87e` (`calificacion_id`),
  KEY `FK_1473a706d81492c7fa8a4b72c95` (`solicitante_id`),
  KEY `FK_c09dd275e982dfb4b4fc0782215` (`aprobador_id`),
  CONSTRAINT `FK_1473a706d81492c7fa8a4b72c95` FOREIGN KEY (`solicitante_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_31b471d4d3b57b14c0d546be87e` FOREIGN KEY (`calificacion_id`) REFERENCES `calificacion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_c09dd275e982dfb4b4fc0782215` FOREIGN KEY (`aprobador_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  AUDITORÍA Y ALERTAS
-- =====================================================================

-- auditoria: Bitácora de cambios: solo se inserta, nunca se edita ni se borra.
CREATE TABLE IF NOT EXISTS `auditoria` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `accion` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidad` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidad_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor_anterior` json DEFAULT NULL,
  `valor_nuevo` json DEFAULT NULL,
  `ip` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_fdfb12f33f6d47688004dd13b9` (`entidad`,`entidad_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- alerta: Alertas tempranas; clave única para no repetir la misma alerta.
CREATE TABLE IF NOT EXISTS `alerta` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` enum('INASISTENCIA','NOTA_BAJA','SENSOR','SEGURIDAD') COLLATE utf8mb4_unicode_ci NOT NULL,
  `programa_id` int DEFAULT NULL,
  `estudiante_id` int DEFAULT NULL,
  `carga_id` int DEFAULT NULL,
  `mensaje` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clave` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `atendida` tinyint NOT NULL DEFAULT '0',
  `atendida_por_id` int DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_7269703f31d1c5abd21af1beab` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
--  DATOS INICIALES MÍNIMOS
--  Un administrador para poder entrar por primera vez y un periodo actual.
--  Correo: admin@cul.edu.co   Contraseña: Admin2026*
--  CAMBIA LA CONTRASEÑA al entrar (Mi cuenta → Cambiar contraseña).
-- =====================================================================

INSERT IGNORE INTO `usuario`
  (`id`, `tipo_identificacion`, `identificacion`, `nombres`, `apellidos`, `email`, `celular`, `password_hash`, `rol`, `activo`)
VALUES
  (1, 'CC', '1000000001', 'Alberto', 'Muñoz', 'admin@cul.edu.co', '3001000001', '$2b$10$69v23hG.uetxxmz5rS1nTew4rVQBhaVzs9fljSGON1gG117mpUVeO', 'ADMIN', 1);

INSERT IGNORE INTO `periodo` (`id`, `codigo`, `fecha_inicio`, `fecha_fin`, `limite_creditos`, `actual`)
VALUES (1, '2026-2', '2026-07-27', '2026-12-12', 20, 1);
