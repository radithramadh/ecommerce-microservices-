const amqp = require("amqplib");


async function sendEvent(queueName, message) {
 try {
   const connection = await amqp.connect(process.env.QUEUE_SERVICE_URL);
   const channel = await connection.createChannel();
   await channel.assertQueue(queueName, { durable: true });
   channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
   await channel.close();
   await connection.close();
 } catch (error) {
   console.error("Error sending message:", error);
 }
}


async function listenEvent(queueName, onProcess) {
 try {
   const connection = await amqp.connect(process.env.QUEUE_SERVICE_URL);
   const channel = await connection.createChannel();
   await channel.consume(queueName, async (data) => {
     onProcess(JSON.parse(data.content));
     channel.ack(data);
   });
 } catch (error) {
   console.error("Error listening message:", error);
 }
}


module.exports = { sendEvent, listenEvent };