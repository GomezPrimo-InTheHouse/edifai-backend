import jwt from 'jsonwebtoken'
import 'dotenv/config'

export const verifyToken = (req, res, next)=>{
    let token = req.headers.authorization
    console.log(token)
    if(!token){
        return res.status(401).json({
            success:false,
            message: 'No token provided'
        })
    }
    //esto divide el array en el unico espacio que tiene,
    // y guardo en la variable token solo la parte que necesito
    // que es el token
    token = token.split(" ")[1] //famosa limpieza de token
    console.log({token})
    try {
        const { email } = jwt.verify(token, process.env.JWT_SECRET_KEY)
        console.log(email)
        req.email = email // envio por la req el email, para que buesque el usuario en la db
        next()

    } catch (error) {
        return res.status(400).json({
            success:false,
            message: 'No token provided o error de server'
        })
    }

}