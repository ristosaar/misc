const WebSocket = require('ws');
const NodeRSA = require('node-rsa');
const Blocks = require('./block.js');
const crypto = require('crypto');
var shuffle = require('shuffle-array');

wss = new WebSocket.Server({ port: process.argv[2] });
var os = require('os');
var fs = require('fs');
var port = process.argv[2];
var peerPort = process.argv[3];
var state = new Map();
var versionNum;
var activeConnectionMap = new Map();

var keypair = new NodeRSA({ b: 2048 });
var publicKeyPem = keypair.exportKey('pkcs8-public-pem');
var privateKeyPem = keypair.exportKey('pkcs8-private-pem');

var blockChain;
var peers = new Array(port);
var addresses = new Array(publicKeyPem);
var humanNames = [];

wss.on('listening', ws => {
    console.log("listening on port " + process.argv[2]);
    fs.readFile('./names.txt', "utf8", function (err, data) {
        if (err) {
            throw err;
        }
        humanNames = data.toString().split(os.EOL);
    });
    if (peerPort) {
        peers.push(peerPort);
    } else {
        /* You are the progenitor! */
        blockChain = new Blocks.BlockChain(publicKeyPem, privateKeyPem);

    }
    setInterval(gossip, 3000);
    setInterval(sendMoney, 5000);
});



wss.on('connection', ws => {
    ws.on('message', message => {
        if (message.startsWith('doGossip')) {
            let theirBlockchain = message.split(';;;;')[1];
            let theirPeers = message.split(';;;;')[2];
            let theirAddresses = message.split(';;;;')[3];

            if (theirBlockchain && theirBlockchain != 'undefined') {
                let theirChain = new Blocks.BlockChain(null, null, JSON.parse(theirBlockchain));
                updateBlockchain(theirChain);
            }
            if (theirPeers && theirPeers != 'undefined') {
                updatePeers(JSON.parse(theirPeers));
            }

            if (theirAddresses && theirAddresses != 'undefined') {
                updateAddresses(JSON.parse(theirAddresses));
            }
            /* /gossip */
            //var obj = JSON.parse(message);

        }
    });
});

function humanReadableName(pubKey) {
    var pkHash = crypto.createHash('sha256').update(pubKey).digest('hex');
    return humanNames[parseInt(pkHash, 16) % humanNames.length];
}

function renderState() {
    console.log('blockchain length ' + (blockChain ? blockChain.blocks.length : 0));
    /* console.log('My name is ' + humanReadableName(publicKeyPem)); */
}

function updateBlockchain(theirBlockchain) {
    if (!theirBlockchain) {
        console.log('empty theirBlockchain');

        return;
    }
    if (blockChain && theirBlockchain.blocks.length <= blockChain.blocks.length) {
        /* console.log('wrong length'); */
        return;
    }
    if (!theirBlockchain.isValid()) {
        console.log('not valid');
        return;
    }
    blockChain = theirBlockchain;
}

function updatePeers(theirPeers) {
    theirPeers.forEach(function (theirPeer) {
        if (!peers.includes(theirPeer)) {
            peers.push(theirPeer);
        }
    });
}

function updateAddresses(theirAddresses) {
    theirAddresses.forEach(function (address) {
        if (!addresses.includes(address)) {
            addresses.push(address);
        }
    });
}

function sendMoney() {
    const coolWallets = [...addresses];
    shuffle(coolWallets);
    shuffle(coolWallets);
    shuffle(coolWallets);
    addresses.forEach(function (add) {
        if (blockChain) {
            process.stdout.write("\x1b[33m" + humanReadableName(add) + ' amount is ' + blockChain.computeBalances().get(add) + "\x1b[0m");
            console.log();
        }
    });
    var coolWallet = coolWallets[0];
    if (blockChain && coolWallet !== publicKeyPem) {
        var currAmt = blockChain.computeBalances().get(publicKeyPem);
        if (parseInt(currAmt) > 1000) {
            process.stdout.write("\x1b[32m" + 'sending 1000 to \x1b[0m' + "\x1b[35m" +humanReadableName(coolWallet) + "\x1b[0m");
            console.log();
            blockChain.addToChain(new Blocks.Transaction(publicKeyPem, coolWallet, 1000, privateKeyPem));
            /* var trans = new Blocks.Transaction(publicKeyPem, coolWallet, 1000, privateKeyPem);
            console.log(trans.isValidSignature()); */
            
           /*  var signature = PKI.sign(crypto.createHash('sha256').update('testing').digest('hex'), privateKeyPem);
            var isValid = PKI.isValidSignature('testing', signature, publicKeyPem);
            console.log(privateKeyPem + ' ' + signature); */
            
        }

    }



}

function gossip() {
    peers.forEach(function (peer) {
        if (peer == port) {
            return;
        }

        let peerSocket = activeConnectionMap.get(peer);
        process.stdout.write("\x1b[31m" + humanReadableName(publicKeyPem) + "\x1b[0m ");
        if (!peerSocket) {
            var peerUrl = 'ws://localhost:' + peer;
            peerSocket = new WebSocket(peerUrl);
            activeConnectionMap.set(peer, peerSocket);
            peerSocket.onopen = () => {
                console.log("Gossiping with " + peer);

                var sendMsg = 'doGossip;;;;' + JSON.stringify(blockChain) + ';;;;' + JSON.stringify(peers) + ';;;;' + JSON.stringify(addresses);
                peerSocket.send(sendMsg);
                /* peerSocket.send(JSON.stringify(mapToObj(state))); */
            }

            peerSocket.onerror = (error) => {
                console.log(`WebSocket error: ${error}`);
            }

        } else {
            if (peerSocket.readyState == WebSocket.OPEN) {
                console.log("Gossiping with " + peer);
                var sendMsg = 'doGossip;;;;' + JSON.stringify(blockChain) + ';;;;' + JSON.stringify(peers) + ';;;;' + JSON.stringify(addresses);
                peerSocket.send(sendMsg);
                /*  peerSocket.send(JSON.stringify(mapToObj(state))); */

            }
        }

    });
    renderState();
}
