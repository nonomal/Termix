// start.js
const { spawn } = require('child_process');

const child = spawn('node', ["\"D:/Programming Projects/SSH-Project-JB/backend/server.js\""], {
    stdio: 'inherit', // this is key for interactivity
    shell: true, // use system shell
});

child.on('exit', function (code, signal) {
    console.log('child process exited with ' +
        `code ${code} and signal ${signal}`);
});