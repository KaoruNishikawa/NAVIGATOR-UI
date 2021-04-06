"use strict"

/* Create server */
const server = require("fastify")({
    // logger: true
})

/* Register directories which contain source files */
/* The files in those directories can be accessed without specifying the
directory name in server-side programs. */
const fastifyStatic = require("fastify-static");
const path = require("path");
server.register(fastifyStatic, {
    root: path.join(__dirname, "public")
})
server.register(fastifyStatic, {
    /* To load node modules from client-side */
    root: path.join(__dirname, "node_modules"),
    prefix: "/node_modules/",
    /* To avoid 
     FastifyError (FST_ERR_DEC_ALREADY_PRESENT):
     The decorator 'sendFile' has already been added! */
    decorateReply: false
})

/* Configure URL to response mapping */
server.register(require("fastify-websocket"))
const commandHandler = require("./src/serverHandler")
server.get("/", (req, reply) => {
    reply.sendFile("index.html")
})
server.get("/ws", { websocket: true }, (conn, req) => {
    conn.socket.onmessage = (message) => {
        new commandHandler(conn, message)
    };
})

/* Specify IP address of the server and run it */
// const serverIP = process.env.NASCO_SERVER_IP || "192.168.11.6";
const serverIP = process.env.NASCO_SERVER_IP || "192.168.101.67";
const serverPort = process.env.NASCO_SERVER_PORT || 4864;
server.listen(serverPort, serverIP, (err, address) => {
    if (err) {
        server.log.error(err)
        process.exit(1)
    }
    server.log.info(`server listening at ${address}`)
    console.log(`server listening at ${address}`)
})
