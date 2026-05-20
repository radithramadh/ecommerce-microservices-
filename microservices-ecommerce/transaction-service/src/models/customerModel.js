const pool = require("../config/db");


const CustomerModel = {
 create: async (id, name, email) => {
   const [result] = await pool.execute(
     "INSERT INTO customers (id, name, email) VALUES (?, ?, ?)",
     [id, name, email]
   );
   return result.insertId;
 },


 findById: async (id) => {
   const [rows] = await pool.execute("SELECT * FROM customers WHERE id = ?", [
     id,
   ]);
   return rows[0];
 },


 update: async (id, name, email) => {
   const [result] = await pool.execute(
     "UPDATE customers SET name = ?, email = ? WHERE id = ?",
     [name, email, id]
   );
   return result.affectedRows;
 },


 delete: async (id) => {
   const [result] = await pool.execute("DELETE FROM customers WHERE id = ?", [
     id,
   ]);
   return result.affectedRows;
 },


 getAll: async () => {
   const [rows] = await pool.execute("SELECT * FROM customers");
   return rows;
 },
};


module.exports = CustomerModel;

