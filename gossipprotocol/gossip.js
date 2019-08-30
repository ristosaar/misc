const WebSocket = require('ws');
wss = new WebSocket.Server({ port: process.argv[2] });
var os = require('os');
var fs = require('fs');
var movies = [];
var port = process.argv[2];
var peerPort = process.argv[3];
var state = new Map();
var favMovie;
var versionNum;
var activeConnectionMap = new Map();


wss.on('listening', ws => {
    loadMovies();
    console.log("listening on port " + process.argv[2]);
    if (peerPort) {
        state.set(peerPort, ["Nothing", 0]);
    }
    setInterval(getGossip, 3000);
    setInterval(newFavorite, 8000);
});

wss.on('connection', ws => {
    ws.on('message', message => {
        var obj = JSON.parse(message);
        updateState(obj);
    });
});

function loadMovies() {
    fs.readFile('./movies.txt', "utf8", function (err, data) {
        if (err) {
            throw err;
        }
        var moviesData = data.toString().split(os.EOL);
        for (var i = 0; i < moviesData.length - 1; i++) {
            movies.push(moviesData[i]);
        }
        console.log(movies.length + ' movies loaded succesfully!');
        favMovie = getSampleMovie();
        versionNum = 0;
        console.log('My favorite Movie is ' + favMovie);
        state.set(port, [favMovie, versionNum]);
        console.log(state);
    });
}

function updateState(obj) {
    var keys = Object.keys(obj);
    keys.forEach(function (key) {
        if (key == port) {
            return;
        }
        let currentState = state.get(key);
        if (!currentState) {
            process.stdout.write("\x1b[31m new peer " + key + " discovered \x1b[0m");
            console.log('saving ' + obj[key]);
            state.set(key, obj[key]);
        }
        else if (obj[key][1] > currentState[1]) {
            console.log(obj[key] + ' is a newer version than ' + currentState);
            state.set(key, obj[key]);
        }
    });

}

function getSampleMovie() {
    return movies[parseInt(Math.random() * movies.length)];
}

function newFavorite() {
    console.log('Screw ' + favMovie + ". it's stupid anyway!");
    versionNum++;
    favMovie = getSampleMovie();
    state.set(port, [favMovie, versionNum]);
    console.log('My new favorite Movie is ' + favMovie);
    console.log(state.get(port));
}

function getGossip() {
    for (var [key, value] of state) {
        if (key == port) {
            continue;
        }
        
        let peerSocket = activeConnectionMap.get(key);

        if (!peerSocket) {
            var peerUrl = 'ws://localhost:' + key;
            peerSocket = new WebSocket(peerUrl);
            activeConnectionMap.set(key, peerSocket);
            peerSocket.onopen = () => {
                console.log("Gossiping with " + key);
                peerSocket.send(JSON.stringify(mapToObj(state)));
            }
            peerSocket.onerror = (error) => {
                console.log(`WebSocket error: ${error}`);
            }

        } else {
            if (peerSocket.readyState == WebSocket.OPEN) {
                console.log("Gossiping with " + key);
                peerSocket.send(JSON.stringify(mapToObj(state)));
            }else if(state.get(key)[1] > 0){
                process.stdout.write("\x1b[41m PEER " + key + " DISCONNECTED! \x1b[0m \n");
                state.set(key, ["Nothing",0]);
            }
        }
    }
    renderState();
}

function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function (value, key) {
        obj[key] = value
    });

    return obj;
}

function renderState() {
    var keyArray = [];
    for (var [key, value] of state) {
        keyArray.push(key);
    }
    keyArray.sort();
    keyArray.forEach(function (key) {
        let peerSocket = activeConnectionMap.get(key);
        if (key == port || peerSocket.readyState == WebSocket.OPEN) {
        process.stdout.write("\x1b[32m" + key + "\x1b[0m");
        process.stdout.write("\x1b[37m" + ' currently likes ' + "\x1b[0m");
        process.stdout.write("\x1b[33m" + state.get(key)[0] + "\x1b[0m");
        process.stdout.write('\n');
        }
    });

}
