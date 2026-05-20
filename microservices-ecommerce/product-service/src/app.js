require('dotenv').config();

const express = require('express');
const app = express();

const productRoutes = require('./routes/productRoutes');
const ProductModel = require('./models/productModel');

const { listenEvent } = require('./config/queue');

app.use(express.json());

app.use('/api/products', productRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Product Service running on port ${process.env.PORT}`);
});

// LISTENER RABBITMQ
listenEvent("UPDATE_PRODUCT_STOCK", updateStock);

async function updateStock(data) {

    try {

        const product = await ProductModel.findById(data.id);

        if (!product) {
            console.log("Product not found");
            return;
        }

        await ProductModel.update(
            data.id,
            product.name,
            product.description,
            product.price,
            data.stock,
            product.image_url
        );

        console.log("Stock updated successfully");

    } catch (error) {

        console.log("Error update stock:", error.message);
    }
}