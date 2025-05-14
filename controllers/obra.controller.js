import { ObraModel } from "../models/obra.model.js";

const create = async (req, res) => {
  try {
    const nuevaObra = await ObraModel.createObra(req.body);
    res.status(201).json(nuevaObra);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la obra", error: error.message });
  }
};

const getAll = async (req, res) => {
  try {
    const obras = await ObraModel.getAllObras();
    res.status(200).json(obras);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener obras", error: error.message });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  try {
    const actualizada = await ObraModel.updateObra(id, req.body);
    res.status(200).json(actualizada);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar obra", error: error.message });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    await ObraModel.deleteObra(id);
    res.status(200).json({ message: "Obra eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar obra", error: error.message });
  }
};

const getByUbicacion = async (req, res) => {
  const { ubicacion } = req.params;
  try {
    const obras = await ObraModel.getByUbicacion(ubicacion);
    res.status(200).json(obras);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener obras por ubicación", error: error.message });
  }
};

const getByEstado = async (req, res) => {
  const { estado } = req.params;
  try {
    const obras = await ObraModel.getByEstado(estado);
    res.status(200).json(obras);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener obras por estado", error: error.message });
  }
};

const getFinalizadas = async (_req, res) => {
  try {
    const obras = await ObraModel.getObrasFinalizadas();
    res.status(200).json(obras);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener obras finalizadas", error: error.message });
  }
};

const getPorRetraso = async (_req, res) => {
  try {
    const obras = await ObraModel.getObrasPorRetraso();
    res.status(200).json(obras);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener obras ordenadas por retraso", error: error.message });
  }
};

export const ObraController = {
  create,
  getAll,
  update,
  remove,
  getByUbicacion,
  getByEstado,
  getFinalizadas,
  getPorRetraso
};
