# EdifAI Backend

## Estructura del proyecto
- **microservices/**: Microservicios independientes (Express)
- **routes/**: Rutas organizadas por módulos
- **controllers/**: Controladores por módulo
- **connection/**: Conexiones a base de datos (PostgreSQL, Firebase)
- **migrations/**: Scripts SQL para migraciones de base de datos

## Nueva migración añadida
Ejecuta la siguiente migración para crear tablas de formas_pago y pagos:

```bash
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/001_create_formas_pago_pagos.sql
```

## Instalación y uso
1. `npm install`
2. Configurar variables de entorno (.env)
3. Ejecutar migraciones pendientes
4. `npm start`

## Microservicios
Cada microservicio corre en su puerto específico (configurable):
- ms-auth: 7001
- ms-usuario: 7002
- ms-obra: 7003
- ms-estado: 7004
- ms-trabajadores: 7005
- ms-labores: 7006
- **ms-materiales: 7007** (nuevo)
