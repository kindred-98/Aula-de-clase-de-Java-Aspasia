# Carpeta Archivo_Markdown/ — 4 archivos, cada uno con un rol distinto:

## 1. prompt_Claude_PrimerasFases.md 

El contrato de trabajo (briefing) Es el prompt/instrucciones que se dieron a la IA al empezar: rol (ingeniero senior full stack), contexto del producto (aula Java 3×5 con profesora al frente), stack prohibido de cambiar, modelo de datos, matriz de permisos, requisitos de seguridad (PIN+argon2, rate limiting), funcionalidad por pantalla (10 pantallas), UX/a11y, tests obligatorios (criterios de aceptación) y las fases 0–3 con reglas ("no avanzar de fase sin tests verdes", "documentar en español, código en inglés"). Transmite: cómo se debía construir la app y qué condiciones había que cumplir.

## 2. PLAN_Claude.md 

El plan técnico (arquitectura y decisiones) La contraparte ejecutada del prompt: stack verificado con versiones reales, 14 decisiones tomadas ante ambigüedades (D1 Python 3.14 local vs 3.12 CI, D6 el profe no tiene asiento, D8 evaluaciones inmutables…), esquema de datos completo, matriz de permisos con 7 invariantes de seguridad, estructura de carpetas, superficie API por fase, seguridad transversal, calidad/CI y las fases 0–3. Transmite: las decisiones de arquitectura y por qué, para que nadie las reabra sin motivo.

## 3. TRABAJO_REALIZADO_EN_ADMIN.md 
 
El informe de entregas (estado real) Lo que ya está hecho y commiteado: tabla de commits de las 4 fases (A 86d505d → D 26f100a), detalle de cada fase con endpoints, modelos, archivos y tests, verificación (107 backend / 31 frontend), pendientes conocidos y el roadmap de origen preservado. Transmite: qué hay entregado hoy, dónde está y qué falta — el "estado del proyecto" para teammates.

## 4. COMANDOS_DE_LA_APP.md 

La guía operativa (manual de uso) Solo comandos: requisitos, variables de entorno, arranque con Docker (opción A) o local sin Docker (opción B), primer admin y seed, migraciones, tests/lint, Makefile, puertos/URLs, credenciales de los flujos de acceso y solución de problemas. Transmite: cómo instalar, arrancar y mantener la app en el día a día — pensada para quien la ejecuta, no para quien la diseña.

---
###  Resumen: Prompt (qué pedir) → plan (cómo se decidió) → trabajo realizado (qué hay) → comandos (cómo se usa).