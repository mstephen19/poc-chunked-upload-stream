import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { randomUUID as v4 } from 'crypto';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';

// ! rough around the edges POC

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: /^.*$/,
        methods: ['GET', 'POST'],
    },
});

app.get('*', (_, res) => res.send('<h1>hello</h1>'));

io.on('connection', (socket) => {
    console.log(socket.id, 'connected');

    // The event to be emitted when starting a file upload.
    socket.on('upload_file', async ({ totalSize }: { totalSize: number }) => {
        // Create a randomly generated ID for the connection
        const connectionId = v4();
        await socket.join(connectionId);

        // const handledIndexes: number[] = [];

        // Prepare the streams and listeners for the data before giving the client
        // the green-light to start sending data
        const readable = new Readable({
            read() {},
        });

        const handler = ({ data, last, index }: { data: Buffer; last: boolean; index: number }) => {
            console.log(index);
            // Add the buffer to the stream
            // console.log(data);
            readable.push(data);
            // Let the client know the chunk upload was a success and server
            // is ready for the next chunk
            io.to(connectionId).emit('upload_chunk_success');

            if (last) {
                readable.destroy();
                socket.off(`upload_chunk_${connectionId}`, handler);
            }
        };

        socket.on(`upload_chunk_${connectionId}`, handler);

        // ! temp
        const writable = createWriteStream('./data/audio/sample.mp3');
        readable.pipe(writable);

        // Send the ID back to the client so it can be used for emitting
        // events specific to this connectionId. Let the client know the
        // server is ready for the file to start uploading.
        io.to(connectionId).emit('ready_for_upload', connectionId);
    });

    socket.on('disconnect', (reason) => {
        console.log(reason);
    });
});

server.listen(4000, () => {
    console.log(`Server running.`);
});
