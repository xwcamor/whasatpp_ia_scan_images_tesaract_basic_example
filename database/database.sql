-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3307
-- Tiempo de generación: 13-06-2025 a las 17:10:23
-- Versión del servidor: 8.2.0
-- Versión de PHP: 8.3.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `examen`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `facturas`
--

CREATE TABLE `facturas` (
  `id` int NOT NULL,
  `ruc_dni` varchar(32) DEFAULT NULL,
  `nombre_cliente` varchar(128) DEFAULT NULL,
  `fecha_emision` varchar(32) DEFAULT NULL,
  `numero_comprobante` varchar(64) DEFAULT NULL,
  `subtotal` varchar(32) DEFAULT NULL,
  `igv` varchar(32) DEFAULT NULL,
  `total` varchar(32) DEFAULT NULL,
  `moneda` varchar(16) DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `facturas`
--

INSERT INTO `facturas` (`id`, `ruc_dni`, `nombre_cliente`, `fecha_emision`, `numero_comprobante`, `subtotal`, `igv`, `total`, `moneda`, `fecha_registro`) VALUES
(5, '20607623326', 'INDUSTRIAS DEL ESPINO S.A', '02-may-2025', 'FO01-00000183', '40.00', '0.00', '40.00', 'SOLES', '2025-06-13 16:06:18'),
(6, '20163901197', 'INDUSTRIAS DEL ESPINO S.A', '02-may-2025', 'FO01-00000183', 's/40.00', 's/0.00', 's/40.00', 'SOLES', '2025-06-13 16:06:41');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `facturas`
--
ALTER TABLE `facturas`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `facturas`
--
ALTER TABLE `facturas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
