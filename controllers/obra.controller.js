import { obraModel } from "../models/obra.model";

const createObra = async (req, res) => {

    try {

        const {
            nombre,
            user_id,
            descripcion,
            ubicacion,
            fecha_inicio,
            fecha_fin,
            estado,
            tipo,
    
        } = req.body;
    
        if(!nombre || !descripcion || !ubicacion || !fecha_inicio || !fecha_fin || !estado || !tipo){
    
            return res.status(400).json({ message: "Error al crear obra" });
        }
    
        const obra = await obraModel.createObra({ 
            nombre,
            user_id,  //-> obtener el user logeado,
            descripcion,
            ubicacion,
            fecha_inicio,
            fecha_fin,
            estado,
            tipo
        })


        return res.status(200).json({
            success:true,
            message: "Obra creada correctamente",
            obra
        })


    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:error.message,
            error:' Error al registrar la nueva obra'
        })
    }
    
}

const updateObra = (req, res) => {

}

const darDeBajaObra = (req, res)=> {

}

export const obraModel = {
    createObra, 
    updateObra,
    darDeBajaObra
}