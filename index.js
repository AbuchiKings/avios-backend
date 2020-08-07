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


app.get('/', (req, res, next) => {
    return res.status(200).json('Welcome to Avios');
});

//creates a new product
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

//retrieves all products
app.get('/api/v1/products', async (req, res, next) => {
    try {
        const products = await Product.find().lean();
        if (products.length < 1) {
            errorHandler(404, 'No products has been uploaded yet')
        }

        return responseHandler(res, products, next, 200, 'Products successfully retrieved', products.length);

    } catch (error) {
        next(error);
    }
});

// Updates a specific product
app.patch('/api/v1/products/:product_id', async (req, res, next) => {
    try {
        let { date_uploaded, product_varieties, ...updateData } = req.body;
        if (product_varieties) {
            updateData = { ...updateData, $addToSet: { product_varieties: [...product_varieties] } };
        }
        const date_edited = Date();
        const product = await Product.findOneAndUpdate({ _id: req.params.product_id }, { ...updateData, date_edited }, {
            new: true,
            runValidators: true
        }).lean();
        if (!product) {
            return errorHandler(404, 'Product not found');
        }
        return responseHandler(res, product, next, 200, 'Product was successfully updated', 1);
    } catch (error) {
        return next(error);
    }
});

// Deletes a specific variety from a specific product
app.delete('/api/v1/products/:product_id/variety/:variety_id', async (req, res, next) => {
    try {
        const product = await Product.findOne({ _id: req.params.product_id }).select({ product_varieties: 1 });
        if (!product) return errorHandler(404, 'Product not found');

        let x = 0;
        const len = product['product_varieties'].length;
        console.log(req.params.variety_id);
        for (let i = 0; i < len; i++) {
            if (req.params.variety_id == `${product['product_varieties'][i]._id}`) {
                console.log(product['product_varieties'][i]._id);
                product['product_varieties'].splice(i, 1);
                x++;
                break;
            }
        }
        if (x < 1) {
            return errorHandler(404, 'Product variety was not found in the product specified');
        }
        await product.save();

        return responseHandler(res, null, next, 204, 'Deleted successfuly', 1);
    } catch (error) {
        return next(error)
    }
});

//Deletes a product
app.delete('/api/v1/products/:product_id', async (req, res, next) => {
    try {
        const product = await Product.findOneAndDelete({ _id: req.params.product_id }).lean();
        if (!product) {
            return errorHandler(404, 'Product not found');
        }
        return responseHandler(res, null, next, 204, 'Deleted successfuly', 1);
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

server.listen(process.env.PORT || 5000, () => {
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
