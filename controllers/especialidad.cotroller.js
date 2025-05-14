import { EspecialidadModel } from '../models/especialidad.model.js';

const create = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ message: 'Nombre requerido' });

  try {
    const especialidad = await EspecialidadModel.createEspecialidad({ nombre });
    return res.status(201).json({ success: true, especialidad });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAll = async (_req, res) => {
  try {
    const especialidades = await EspecialidadModel.getAllEspecialidades();
    return res.status(200).json({ success: true, especialidades });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const EspecialidadController = {
  create,
  getAll
};