import { workerModel } from "../models/worker.model";

import jwt from 'jsonwebtoken'


const registerWorker = (req, res) => {
    const {
        nombre,
        apellido,
        dni,
        //seleccionar la obra,
        fecha_ingreso,
        usuario,
        // seleccionar especialidad,
        // seleccionar jefe ( si es que tiene uno)
    } = req.body

}

const updateWorker = (req, res) => { 

}

const darDeBajarWorker = (req, res) => {

}

export const workerController = {
    registerWorker,
    updateWorker,
    darDeBajarWorker

}