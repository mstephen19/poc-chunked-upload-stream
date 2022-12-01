import { useState, useCallback, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

import type { ChangeEventHandler, FormEventHandler } from 'react';
import type { Socket } from 'socket.io-client';

// ! rough around the edges POC

const CHUNK_SIZE = 1024 * 20;

const chunkFile = (file: File, chunkSize: number) => {
    const futureLength = Math.ceil(file.size / chunkSize);
    let start = 0;
    const result: Blob[] = [];

    for (let i = 1; i <= futureLength; i++) {
        result.push(file.slice(start, start + chunkSize));
        start += chunkSize;
    }

    return result;
};

function App() {
    const [file, setFile] = useState<File | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        setSocket(io('http://localhost:4000'));
    }, []);

    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
        if (!e.target.files?.[0]) return;
        setFile(e.target.files[0]);
    }, []);

    const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
        async (e) => {
            e.preventDefault();
            if (!socket || !file) return;

            const promise = new Promise((resolve) => {
                socket.once('ready_for_upload', (id: string) => {
                    resolve(id);
                });
            }) as Promise<string>;

            // Tell the server what the total byteSize of the file is before
            // even sending the first chunk
            socket.emit('upload_file', { totalSize: file.size });

            // Wait for the server to respond back with the room ID
            const connectionId = await promise;

            // socket.emit(`upload_chunk_${connectionId}`, { data: file.slice(0), last: true });

            // const reader = new FileReader();
            const chunks = chunkFile(file, CHUNK_SIZE);

            for (let i = 0; i < chunks.length; i++) {
                console.log(i);
                const blob = chunks[i];

                socket.emit(`upload_chunk_${connectionId}`, { data: blob, last: i === chunks.length - 1, index: i });

                // Wait for the server to respond back stating that the upload was a success and it's
                // ready for the next chunk
                await new Promise((resolve) => {
                    socket.once('upload_chunk_success', resolve);
                });
            }
        },
        [socket, file]
    );

    return (
        <form onSubmit={handleSubmit}>
            <input type='file' onChange={handleChange} />
            <button type='submit'>Upload</button>
        </form>
    );
}

export default App;
