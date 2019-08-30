const crypto = require('crypto');

var os = require('os');

var NUM_ZEROS = 5;

class Block {
    constructor(prevBlock, txn, jsonObject) {
        if (jsonObject) {
            this.txn = new Transaction(null, null, null, null, jsonObject.txn);
            this.prevBlockHash = jsonObject.prevBlockHash;
            this.nonce = jsonObject.nonce;
            this.ownHash = jsonObject.ownHash;
        } else {
            this.txn = txn;
            this.prevBlockHash = prevBlock ? prevBlock.ownHash : null;
            this.mineBlock();
        }
    }

    static createGenesisBlock(pubKey, privKey) {
        var genesisTxn = new Transaction(null, pubKey, 500000, privKey);
        return new Block(null, genesisTxn);
    }

    mineBlock() {
        console.log('mining block...');
        this.nonce = this.calcNonce();
        this.ownHash = this.hash(this.fullBlock(this.nonce));
        console.log('ownHash is ' + this.ownHash);
    }

    hash(contents) {
        return crypto.createHash('sha256').update(contents).digest('hex');
    }

    blockContents() {
        return this.prevBlockHash + this.msg;
    }

    isValidNonce(nonce) {
        const hash = crypto.createHash('sha256').update(this.fullBlock(nonce)).digest('hex');
        return (hash.startsWith("0".repeat(NUM_ZEROS)));
    }

    fullBlock(nonce) {
        return this.txn.toString() + this.prevBlockHash + nonce;
    }

    calcNonce() {
        var nonce = "THIS IS A VERY FUNNY NONCE";
        var count = 0;
        while (!this.isValidNonce(nonce)) {
            nonce = Math.random().toString(36).substring(7);
            if (count % 100000 == 0) {
                console.log('. ');
            }
            count++;
        }
        return nonce;
    }

    isValid() {
        return this.isValidNonce(this.nonce) && this.txn.isValidSignature();
    }

    toString() {
        return "Previous hash:                " + this.prevBlockHash + os.EOL +
            "Message:                " + this.txn + os.EOL +
            "Nonce:                " + this.nonce + os.EOL +
            "Own hash:                " + this.ownHash + os.EOL +
            "↓                                                            ";
    }


}

class Transaction {
    constructor(from, to, amount, privKey, jsonObject) {
        if (jsonObject) {
            this.from = jsonObject.from;
            this.to = jsonObject.to;
            this.amount = jsonObject.amount;
            this.signature = jsonObject.signature;
        } else {
            this.from = from;
            this.to = to;
            this.amount = amount;
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(this.message());
            this.signature = sign.sign(privKey, 'hex');
        }

    }

    isValidSignature() {
        if (this.isGenesisTxn()) {
            return true;
        }
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(this.message());
        return verify.verify(this.from, this.signature, 'hex');
    }

    message() {
        return this.from + this.to + this.amount;
    }

    toString() {
        return this.message();
    }

    isGenesisTxn() {
        return this.from == null;
    }
}

class BlockChain {

    constructor(originPubKey, originPrivKey, jsonObject) {
        if (jsonObject) {
            let newBlocks = [];
            jsonObject.blocks.forEach(function (jsonBlock) {
                newBlocks.push(new Block(null, null, jsonBlock));
            });
            this.blocks = newBlocks;
        } else {
            this.blocks = [Block.createGenesisBlock(originPubKey, originPrivKey)];
        }
    }

    addToChain(txn) {
        this.blocks.push(new Block(this.blocks[this.blocks.length - 1], txn));
    }

    isValid() {
        for (var i = 0; i < this.blocks.length; i++) {
            if (!(this.blocks[i] instanceof Block)) {
                console.log('not instanceof');

                return false;
            }
            if (!this.blocks[i].isValid()) {
                console.log('block is not valid ');
                return false;
            }
            if (i > 0 && this.blocks[i - 1].ownHash != this.blocks[i].prevBlockHash) {
                console.log('wrong sequence ');
                return false;
            }
        }
        if (!this.areAllSpendsValid()) {
            console.log('spends not valid ');
            return false;
        }
        return true;
    }

    areAllSpendsValid() {
        return this.computeBalances() != null;
    }

    computeBalances() {
        let genesisTxn = this.blocks[0].txn;
        let balances = new Map();
        var i;
        balances.set(genesisTxn.to, genesisTxn.amount);
        for (i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].prevBlockHash == null) {
                continue;
            }
            let from = this.blocks[i].txn.from;
            let to = this.blocks[i].txn.to;
            let amount = this.blocks[i].txn.amount;
            let balancesFrom = balances.get(from) ? balances.get(from) : 0;
            if (balancesFrom - amount < 0) {
                return null;
            }
            balances.set(from, balancesFrom - amount);

            let balancesTo = balances.get(to) ? balances.get(to) : 0;
            balances.set(to, balancesTo + amount);
        }
        return balances;
    }

    toString() {
        this.blocks.forEach(function (block) {
            console.log(block.toString());
        });
    }


}

module.exports = {
    Block: Block,
    Transaction: Transaction,
    BlockChain: BlockChain
}
