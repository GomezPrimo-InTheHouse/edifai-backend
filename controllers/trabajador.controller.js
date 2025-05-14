import { TrabajadorModel } from "../models/trabajador.model.js";

const create = async (req, res) => {
    const {
        nombre,
        apellido,
        dni,
        obra_id,
        fecha_ingreso,
        usuario_id,
        especialidad_id,
        jefe_id
    } = req.body;

    if (!nombre || !apellido || !dni || !obra_id) {
        return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    try {
        const existe = await TrabajadorModel.findTrabajadorByDNI(dni);
        if (existe) {
            return res.status(400).json({ message: "Ya existe un trabajador con ese DNI" });
        }

        const nuevoTrabajador = await TrabajadorModel.createTrabajador({
            nombre,
            apellido,
            dni,
            obra_id,
            fecha_ingreso,
            usuario_id,
            especialidad_id,
            jefe_id
        });

        return res.status(201).json({
            success: true,
            message: "Trabajador creado correctamente",
            data: nuevoTrabajador
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al crear trabajador",
            error: error.message
        });
    }
};

const getAll = async (req, res) => {
    try {
        const trabajadores = await TrabajadorModel.getAllTrabajadores();
        return res.status(200).json(trabajadores);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al obtener trabajadores",
            error: error.message
        });
    }
};
const update = async (req, res) => {
    const { id } = req.params;
    const updatedFields = req.body;

    try {
        const updated = await TrabajadorModel.updateTrabajador(id, updatedFields);
        if (!updated) {
            return res.status(404).json({ message: "Trabajador no encontrado" });
        }

        return res.status(200).json({
            success: true,
            message: "Trabajador actualizado correctamente",
            data: updated
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al actualizar trabajador",
            error: error.message
        });
    }
};

const getByObraId = async (req, res) => {
    const { obra_id } = req.params;

    try {
        const trabajadores = await TrabajadorModel.getTrabajadoresByObraId(obra_id);
        return res.status(200).json(trabajadores);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al obtener trabajadores por obra_id",
            error: error.message
        });
    }
};
const getByDNI = async (req, res) => {
    const { dni } = req.params;

    try {
        const trabajador = await TrabajadorModel.getTrabajadorByDNI(dni);
        if (!trabajador) {
            return res.status(404).json({ message: "Trabajador no encontrado con ese DNI" });
        }
        return res.status(200).json(trabajador);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getByNombreApellido = async (req, res) => {
    const { nombre, apellido } = req.query;

    if (!nombre || !apellido) {
        return res.status(400).json({ message: "Faltan nombre o apellido en la consulta" });
    }

    try {
        const trabajadores = await TrabajadorModel.getTrabajadoresByNombreApellido(nombre, apellido);
        return res.status(200).json(trabajadores);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getByJefeId = async (req, res) => {
    const { jefe_id } = req.params;

    try {
        const trabajadores = await TrabajadorModel.getTrabajadoresByJefeId(jefe_id);
        return res.status(200).json(trabajadores);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const TrabajadorController = {
    create,
    getAll,
    update,
    getByObraId,
    getByDNI,
    getByNombreApellido,
    getByJefeId
};
