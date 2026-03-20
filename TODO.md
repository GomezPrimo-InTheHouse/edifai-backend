# TODO: Endpoint GET /trabajador/getByEspecialidad/:id

## Plan para nuevo endpoint:

**Information Gathered:**
- Base `/trabajador` (ms-trabajadores:7003)
- Controller patrón establecido con getTrabajadorById.js
- Route actualizada con éxito previamente

**Plan detallado:**
1. **Controller** `controllers/trabajador/getTrabajadoresByEspecialidad.js`:
   - Query: `SELECT * FROM trabajadores WHERE especialidad_id = $1`
   - 404 si 0 resultados
   - Respuesta `{ok: true, data: [...]}`

2. **Route** routes/trabajadores/trabajadores.routes.js:
   - `router.get('/getByEspecialidad/:id', getTrabajadoresByEspecialidad)`
   - Import controller

**Dependent files:** Ninguno adicional

**Follow-up:**
- Test: `curl http://localhost:7003/trabajador/getByEspecialidad/1`
- Actualizar TODO.md

**Estado:** ⏳ Esperando confirmación para implementar
`curl http://localhost:7003/trabajador/jefesConEquipo/3`