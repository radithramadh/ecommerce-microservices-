require('dotenv').config();

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy routes to respective microservices
app.use(
  '/api/users',
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
     pathRewrite: {
      "^/(.*)": "/api/users/$1", // Keep the same path for users,
      "^/": "/api/users"
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request to User Service: ${req.method} ${req.originalUrl}`);},

      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response from User Service: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },

      onError: (err, req, res) => {
        console.error(`Error proxying request to User Service: ${err.message} for ${req.method} ${req.originalUrl}`);},
  })
);

app.use(
  '/api/customers',
  createProxyMiddleware({
    target: process.env.CUSTOMER_SERVICE_URL,
    changeOrigin: true,
     pathRewrite: {
      "^/(.*)": "/api/customers/$1", // Keep the same path for customers,
      "^/": "/api/customers"
    },
    
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request to Customer Service: ${req.method} ${req.originalUrl}`);},

      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response from Customer Service: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },

      onError: (err, req, res) => {
        console.error(`Error proxying request to Customer Service: ${err.message} for ${req.method} ${req.originalUrl}`);}
  })
);

app.use(
  '/api/products',
  createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/(.*)": "/api/products/$1", // Keep the same path for products,
      "^/": "/api/products"
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request to Product Service: ${req.method} ${req.originalUrl}`);},

      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response from Product Service: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },

      onError: (err, req, res) => {
        console.error(`Error proxying request to Product Service: ${err.message} for ${req.method} ${req.originalUrl}`);},

  })
);



app.use(
  '/api/transactions',
  createProxyMiddleware({
    target: process.env.TRANSACTION_SERVICE_URL,
    changeOrigin: true,
     pathRewrite: {
      "^/(.*)": "/api/transactions/$1", // Keep the same path for transactions,
      "^/": "/api/transactions"
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying request to Transaction Service: ${req.method} ${req.originalUrl}`);},

      onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response from Transaction Service: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },

      onError: (err, req, res) => {
        console.error(`Error proxying request to Transaction Service: ${err.message} for ${req.method} ${req.originalUrl}`);}
  })
);

// Basic route for the gateway
app.get('/', (req, res) => {
  res.send('API Gateway for E-commerce Microservices');
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(
    `Frontend can access all services via http://localhost:${PORT}/api/...`
  );
});