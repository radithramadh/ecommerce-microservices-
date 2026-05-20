const { sendEvent } = require("../config/queue");
const CustomerModel = require("../models/customerModel");
const ProductModel = require("../models/productModel");
const TransactionModel = require("../models/transactionModel");
const axios = require('axios');


const TransactionController = {
createTransaction: async (req, res) => {
  const { customerId, items } = req.body;

  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ message: "Customer ID and transaction items are required" });
  }

  try {
  // 1. Validasi Customer (Bisa pakai database lokal atau Axios juga)
  const customer = await CustomerModel.findById(customerId);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    try {
      const response = await axios.get(process.env.PRODUCT_SERVICE_URL + `/api/products/${item.productId}`);
      
      // Axios menyimpan data respon utama di properti .data
      const product = response.data; 

      // Validasi stok berdasarkan data asli dari Product Service
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for product ${product.name}. Available: ${product.stock}`,
        });
      }

      totalAmount += product.price * item.quantity;
      processedItems.push({
        productId: product.id,
        quantity: item.quantity,
        pricePerItem: product.price,
      });

      // Kurangi stok produk (bisa tetap lewat RabbitMQ sendEvent, atau axios.put jika ada endpoint-nya)
      sendEvent("UPDATE_PRODUCT_STOCK", {
        id: product.id,
        stock: product.stock - item.quantity,
      });

    } catch (axiosError) {
      // Jika Axios error (misal product service mati atau ID tidak ketemu/404)
      console.error(`Gagal mengambil data produk ${item.productId}:`, axiosError.message);
      return res.status(404).json({ 
        message: `Product with ID ${item.productId} not found or Product Service is down` 
      });
    }
  }

    // 3. Buat Transaksi
    const transactionId = await TransactionModel.createTransaction(
      customerId,
      totalAmount,
      "pending"
    );

    // 4. Tambahkan Item Transaksi
    for (const item of processedItems) {
      await TransactionModel.addTransactionItem(
        transactionId,
        item.productId,
        item.quantity,
        item.pricePerItem
      );
    }

    res
      .status(201)
      .json({ message: "Transaction created successfully", transactionId });
  } catch (error) {
    console.error(
      "Error creating transaction:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({ message: "Error creating transaction", error: error.message });
  }
},

 getTransactionById: async (req, res) => {
   const { id } = req.params;
   try {
     const transactionItems = await TransactionModel.findById(id);
     if (!transactionItems || transactionItems.length === 0) {
       return res.status(404).json({ message: "Transaction not found" });
     }
     
     const itemsWithProductDetails = await Promise.all(
        transactionItems.map(async (item) => {
          try {
            // Membaca langsung dari TABEL BAYANGAN di database Transaction
            const product = await ProductModel.findById(item.product_id);
            
            return {
              item_id: item.item_id,
              product_id: item.product_id,
              // LANGSUNG ambil product.name karena tidak ada wrapper .data
              product_name: product && product.name ? product.name : "Nama Produk Kosong di Database Bayangan", 
              quantity: item.quantity,
              price_per_item: item.price_per_item,
            };
          } catch (productError) {
            console.warn(`Gagal membaca tabel bayangan untuk ID ${item.product_id}:`, productError.message);
            return {
              item_id: item.item_id,
              product_id: item.product_id,
              product_name: "Gagal Membaca Database",
              quantity: item.quantity,
              price_per_item: item.price_per_item,
            };
          }
        })
     );

     return res.status(200).json({
       transaction_id: id,
       items: itemsWithProductDetails
     });

   } catch (error) {
     console.error("Error getting transaction:", error.message);
     return res.status(500).json({ message: "Internal server error", error: error.message });
   }
},


 getTransactionsByCustomerId: async (req, res) => {
   const { customerId } = req.params;
   try {
     const transactionItems = await TransactionModel.findByCustomerId(
       customerId
     );
     if (transactionItems.length === 0) {
       return res
         .status(404)
         .json({ message: "No transactions found for this customer" });
     }


     // Mengelompokkan item ke dalam transaksi yang sesuai dan mengambil detail produk
     const transactionsMap = new Map();
     const productDetailPromises = [];


     transactionItems.forEach((item) => {
       if (!transactionsMap.has(item.id)) {
         transactionsMap.set(item.id, {
           id: item.id,
           customer_id: item.customer_id,
           total_amount: item.total_amount,
           status: item.status,
           transaction_date: item.transaction_date,
           items: [],
         });
       }
       // Simpan promise untuk mengambil detail produk
       productDetailPromises.push(
         (async () => {
           try {
             const product = await ProductModel.findById(
               item.product_id
             );
             return {
               item_id: item.item_id,
               product_id: item.product_id,
               product_name: product && product.name ? product.name : "Unknown Product",
               quantity: item.quantity,
               price_per_item: item.price_per_item,
             };
           } catch (productError) {
             console.warn(
               `Could not fetch product details for ID ${item.product_id} in customer transactions:`,
               productError.message
             );
             return {
               item_id: item.item_id,
               product_id: item.product_id,
               product_name: "Product Not Found / Service Error",
               quantity: item.quantity,
               price_per_item: item.price_per_item,
             };
           }
         })()
       );
     });


     const resolvedProductDetails = await Promise.all(productDetailPromises);


     // Masukkan detail produk yang sudah diambil ke dalam item transaksi yang sesuai
     let detailIndex = 0;
     transactionItems.forEach((item) => {
       const transaction = transactionsMap.get(item.id);
       if (transaction) {
         transaction.items.push(resolvedProductDetails[detailIndex]);
       }
       detailIndex++;
     });


     res.status(200).json(Array.from(transactionsMap.values()));
   } catch (error) {
     console.error(
       "Error getting transactions by customer ID:",
       error.response ? error.response.data : error.message
     );
     res
       .status(500)
       .json({ message: "Error getting transactions", error: error.message });
   }
 },


 updateTransactionStatus: async (req, res) => {
   const { id } = req.params;
   const { status } = req.body;
   if (!status || !["pending", "completed", "cancelled"].includes(status)) {
     return res.status(400).json({ message: "Invalid status provided" });
   }
   try {
     const affectedRows = await TransactionModel.updateStatus(id, status);
     if (affectedRows === 0) {
       return res
         .status(404)
         .json({ message: "Transaction not found or no changes made" });
     }
     res
       .status(200)
       .json({ message: "Transaction status updated successfully" });
   } catch (error) {
     console.error("Error updating transaction status:", error);
     res.status(500).json({ message: "Error updating transaction status" });
   }
 },


 deleteTransaction: async (req, res) => {
   const { id } = req.params;
   try {
     const affectedRows = await TransactionModel.delete(id);
     if (affectedRows === 0) {
       return res.status(404).json({ message: "Transaction not found" });
     }
     res.status(200).json({ message: "Transaction deleted successfully" });
   } catch (error) {
     console.error("Error deleting transaction:", error);
     res.status(500).json({ message: "Error deleting transaction" });
   }
 },


 getAllTransactions: async (req, res) => {
   try {
     const transactionItems = await TransactionModel.getAll();
     if (transactionItems.length === 0) {
       return res.status(200).json([]); // No transactions found
     }


     // Mengelompokkan item ke dalam transaksi yang sesuai dan mengambil detail produk
     const transactionsMap = new Map();
     const productDetailPromises = []; // Untuk menyimpan semua promise pengambilan detail produk


     transactionItems.forEach((item) => {
       if (!transactionsMap.has(item.id)) {
         transactionsMap.set(item.id, {
           id: item.id,
           customer_id: item.customer_id,
           total_amount: item.total_amount,
           status: item.status,
           transaction_date: item.transaction_date,
           items: [],
         });
       }
       // Simpan promise untuk mengambil detail produk
       productDetailPromises.push(
         (async () => {
           try {
             const product = await ProductModel.findById(
               item.product_id
             );
             return {
               item_id: item.item_id,
               product_id: item.product_id,
               product_name: product ? product.name : "Unknown Product",
               quantity: item.quantity,
               price_per_item: item.price_per_item,
             };
           } catch (productError) {
             console.warn(
               `Could not fetch product details for ID ${item.product_id} in all transactions:`,
               productError.message
             );
             return {
               item_id: item.item_id,
               product_id: item.product_id,
               product_name: "Product Not Found / Service Error",
               quantity: item.quantity,
               price_per_item: item.price_per_item,
             };
           }
         })()
       );
     });


     // Jalankan semua promise pengambilan detail produk secara paralel
     const resolvedProductDetails = await Promise.all(productDetailPromises);


     // Masukkan detail produk yang sudah diambil ke dalam item transaksi yang sesuai
     // Kita perlu cara untuk melacak item mana yang sesuai dengan detail produk yang mana
     // Karena Promise.all menjaga urutan, kita bisa menggunakan indeks
     let detailIndex = 0;
     transactionItems.forEach((item) => {
       const transaction = transactionsMap.get(item.id);
       if (transaction) {
         transaction.items.push(resolvedProductDetails[detailIndex]);
       }
       detailIndex++;
     });


     res.status(200).json(Array.from(transactionsMap.values()));
   } catch (error) {
     console.error(
       "Error getting all transactions:",
       error.response ? error.response.data : error.message
     );
     res.status(500).json({
       message: "Error getting all transactions",
       error: error.message,
     });
   }
 },
};


module.exports = TransactionController;