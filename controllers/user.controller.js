import { UserModel } from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const register = async (req, res) => {

    console.log(req.body)
    const { username, email, password, active } = req.body

    //validamos que existan los datos, que la password tenga al menos 3 caracteres y que ya no existe un usuario con ese email
    if(!email || !password || !username ){
        return res.status(400).json({message: "Faltan datos"})
    }
    if(password.length < 3){
        return res.status(400).json({message: "La contraseña debe tener al menos 3 caracteres"})
    }

    const user = await UserModel.findOneByEmailModel({email})

    if(user){
       throw new Error('El email ya tiene vinculada una cuenta de usuario')
    }

     
    
    try {
        //validamos que el email tenga un formato correcto
        // const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        //hashear password con bcrypt
        const salt = await bcryptjs.genSalt(10) //generamos un salt: palabra aleatoria que se crea para que el hash sea indecifrable
        const hashedPassword = await bcryptjs.hash(password, salt)

        const newUser = await UserModel.createUser({ username, email, password:hashedPassword, active } );
        
        const token = jwt.sign({
            email: newUser.email
        },
        //palabra secreta que se le asigna a la firma del jwt para que sea inidentificable y se pueda verificar luego
        process.env.JWT_SECRET_KEY,
        {
            expiresIn: '1h'
        }
        // faltaria ejecutar el metodo de confirmacion de email y ademas un
        // refresh token que se ejecute cada 1 hr y ademas asignarle un tipo de ROL
    )

    //jsonwebtoken.io puedo verificar el token y la firma secreta.

        return res.status(200).json({
            success:true,
            message: "Usuario creado correctamente",
            newUser,
            token: token
        })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:error.message,
            error:' Error al registrar un nuevo usuariooo'
        })
    }
}

const login = async (req, res)=>{

    
    const { email, password } = req.body 
    console.log('ejecutando el login :',email,password)
    try {
        if(!email || !password){
            return res.status(400).json({
                success:false,
                message:error.message,
                error:' Error al louear un nuevo usuario, faltan datos'
            })
        }

        const user = await UserModel.findOneByEmailModel(email)

        console.log(user)
        if(!user){
            return res.status(400).json({
                success:false,
                message:error.message,
                error:' Error al louear un nuevo usuario, usuario no encontrado'
            })
        }

        const isMatch = await bcryptjs.compare(password, user.password)
        if(!isMatch){
            return res.status(401).json({
                success:false,
                
                error:' Password incorrecta'
            })
        }

        const token = jwt.sign({
            email: email
        },
        //palabra secreta que se le asigna a la firma del jwt para que sea inidentificable y se pueda verificar luego
        process.env.JWT_SECRET_KEY,
        {
            expiresIn: '1h'
        })

        res.status(200).json({
            success:true,
            message:`Usuario, ${user.nombre} logueado correctamente`,
            token,
        })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:error.message,
            error:' Error de servidor al loguear un nuevo usuario'
        })
    }
}

const getAllUsers = async (req, res)=>{
    

    try {
        const allUsers = await UserModel.getAllUsers();
        return res.status(200).json({
            success:true,
            allUsers

        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:error.message,
            error:' Error al registrar un nuevo usuario'
        })
    }
}

const deleteUser = async (req, res)=>{
    const {email} = req.query
    try {
        const result = await UserModel.deleteUser(email);
        return res.status(200).json({
            success:true,
            message:'Usuario eliminado con exito',
            result
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:error.message,
        })
    }
}

const findOneByEmail = async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Falta el parámetro email en la query',
        });
    }

    try {
        const user = await UserModel.findOneByEmailModel(email)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró un usuario con el email: ' + email,
            });
        }

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const profile = async (req, res) => {

    try {
        
        const user = await UserModel.findOneByEmailModel(req.email)
        res.status(200).json({
            success:true,
            user
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message:error.message,
            error:' Error de servidor'
        })
    }
}

export const UserController = {
    register,
    login,
    getAllUsers,
    deleteUser,
    findOneByEmail,
    profile

}