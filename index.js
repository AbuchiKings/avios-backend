const express = require('express');
const mongoose = require('mongoose');
const rateLimiter = require('express-rate-limit');
const helmet = require('helmet');
const preventCrossSiteScripting = require('xss-clean');
const preventParameterPollution = require('hpp');
const compression = require('compression');
const cors = require('cors');
const http = require('http');
const Product = require('./productModel');
const responseHandler = require('./utils/responseHandler');
const errorHandler = require('./utils/errorHandler');
require('dotenv').config();


const app = express();

mongoose.connect(process.env.MONGODB_URI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true
}).then(con => console.log(`Connected to ${con.connections[0].name} Database successfully`))
    .catch(error => { return console.log(error); });

app.use(cors());
//app.options('*', cors());

app.use(helmet());
app.use('/', rateLimiter({
    max: 200,
    windowMs: 1000 * 60 * 60,
    message: 'Too many requests from this IP. Try again in an hour.'
}));

app.use(express.json({ limit: '20kb' }));
app.use(preventCrossSiteScripting());
app.use(preventParameterPollution());

app.use(compression());

app.post('/api/v1/products', async (req, res, next) => {
    try {
        const date_uploaded = Date();
        const date_edited = Date();

        const product = await Product.create({
            ...req.body,
            date_edited,
            date_uploaded
        });
        return responseHandler(res, product, next, 201, 'Product was successfully created', 1);
    } catch (error) {
        return next(error);
    }
});

app.get('/api/v1/products', async (req, res, next) => {
    try {
        const products = await Product.find().lean();
        if (products.length < 1) {
            errorHandler(404, 'No products have been uploaded yet')
        }

        return responseHandler(res, products, next, 200, 'Products successfully retrieved', products.length);

    } catch (error) {
        next(error);
    }
});

app.patch('/products/:product_id', async (req, res, next) => {
    try {
        let { date_uploaded, product_varieties, ...updateData } = req.body;
        if (product_varieties) {
            product_varieties = {};
            updateData = { ...updateData, $addToSet: { product_varieties: [...product_varieties] } };
        }
        const date_edited = Date();
        const product = await Product.findOneAndUpdate({ _id: req.params.product_id }, { ...updateData, date_edited }, {
            new: true,
            runValidators: true
        }).lean();
        return responseHandler(res, product, next, 200, 'Product was successfully updated', 1);
    } catch (error) {
        return next(error);
    }
});

app.use((err, req, res, next) => {
    res.status(err.statusCode || 500);
    if (process.env.NODE_ENV === 'production' && err.statusCode === 500) {
        err.message = "Something has gone very wrong"
    }
    res.json({ status: err.status, message: err.message });
    next();
});


const server = http.createServer(app);

server.listen(process.env.PORT || 8080, () => {
    console.log('Server is running on port 8080');
});

process.on('uncaughtException', (error) => {
    console.log(error.name, error.message);
    console.log(error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.log(error.name, error.message);
    server.close(() => {
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Process terminated!');
    });
});
