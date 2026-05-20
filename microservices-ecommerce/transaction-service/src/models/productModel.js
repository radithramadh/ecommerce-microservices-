const pool = require("../config/db");


const ProductModel = {
 create: async (id, name, imageUrl) => {
   const [result] = await pool.execute(
     "INSERT INTO products (id, name, image_url) VALUES (?, ?, ?)",
     [id, name, imageUrl]
   );
   return result.insertId;
 },


 findById: async (id) => {
   const [rows] = await pool.execute("SELECT * FROM products WHERE id = ?", [
     id,
   ]);
   return rows[0];
 },


 update: async (id, name, imageUrl) => {
   const [result] = await pool.execute(
     "UPDATE products SET name = ?, image_url = ? WHERE id = ?",
     [name, imageUrl, id]
   );
   return result.affectedRows;
 },


 delete: async (id) => {
   const [result] = await pool.execute("DELETE FROM products WHERE id = ?", [
     id,
   ]);
   return result.affectedRows;
 },


 getAll: async () => {
   const [rows] = await pool.execute("SELECT * FROM products");
   return rows;
 },
};


module.exports = ProductModel;