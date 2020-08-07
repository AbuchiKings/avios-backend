const mongoose = require('mongoose');
const productSchema = mongoose.Schema({
    product_name: {
        type: String,
        required: [true, 'Please provide product name'],
        trim: true
    },
    product_description: {
        type: String,
        required: [true, 'Please enter product description'],
        minlength: [8, 'Product description must consist of at least 8 characters'],
        select: false
    },
    product_varieties: [{

        size: {
            type: Number
        },
        color: {
            type: String
        },
        quantity: {
            type: Number
        },
        images: [String],
        price: {
            type: Number
        }

    }],
    date_uploaded: {
        type: Date
    },
    date_edited: {
        type: Date
    }
});

module.exports = mongoose.model('Product', productSchema);