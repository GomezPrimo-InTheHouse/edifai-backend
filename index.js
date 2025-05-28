import express from 'express';
import router from "./routes/index.routes.js";
import cors from 'cors';
import 'dotenv/config';
import morgan from 'morgan';


const app = express();

app.use(express.json())

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(express.static('public'));


app.use('/api', router)


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}
);


app.get('/ping', (req, res) => {
    res.send('PONG');
}
);  