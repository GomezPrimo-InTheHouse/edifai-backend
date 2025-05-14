import express from 'express';
import userRouter from './routes/user.route.js'
import 'dotenv/config';
import morgan from 'morgan';


const app = express();

app.use(express.json())

// app.use(cors());

app.use(express.urlencoded({ extended: true }));
// app.use(morgan('dev'));

app.use(express.static('public'));


app.use('/api/users', userRouter)


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}
);