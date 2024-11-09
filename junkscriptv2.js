#!/usr/bin/env node

/**
 * @author senasgr-eth
 * Modified version of junkscriptions with core wallet integration
 * Adds automatic private key import to core wallet and improved error handling
 */

const dogecore = require('./bitcore-lib-junkcoin');
const axios = require('axios')
const fs = require('fs')
const dotenv = require('dotenv')
const mime = require('mime-types')
const express = require('express')
const { PrivateKey, Address, Transaction, Script, Opcode } = dogecore
const { Hash, Signature } = dogecore.crypto

dotenv.config()

if (process.env.TESTNET == 'true') {
    dogecore.Networks.defaultNetwork = dogecore.Networks.testnet
}

if (process.env.FEE_PER_KB) {
    Transaction.FEE_PER_KB = parseInt(process.env.FEE_PER_KB)
} else {
    Transaction.FEE_PER_KB = 100000000
}

const WALLET_PATH = process.env.WALLET || '.wallet.json'
const MAX_SCRIPT_ELEMENT_SIZE = 520
const MAX_CHUNK_LEN = 240
const MAX_PAYLOAD_LEN = 1500

async function main() {
    let cmd = process.argv[2]

    if (fs.existsSync('pending-txs.json')) {
        console.log('found pending-txs.json. rebroadcasting...')
        const txs = JSON.parse(fs.readFileSync('pending-txs.json'))
        await broadcastAll(txs.map(tx => new Transaction(tx)), false)
        return
    }

    if (cmd == 'mint') {
        await mint()
    } else if (cmd == 'wallet') {
        await wallet()
    } else if (cmd == 'server') {
        await server()
    } else if (cmd == 'jnk-20') {
        await doge20()
    } else {
        throw new Error(`unknown command: ${cmd}`)
    }
}

async function doge20() {
    let subcmd = process.argv[3]

    if (subcmd === 'mint') {
        await doge20Transfer("mint")
    } else if (subcmd === 'transfer') {
        await doge20Transfer()
    } else if (subcmd === 'deploy') {
        await doge20Deploy()
    } else {
        throw new Error(`unknown subcommand: ${subcmd}`)
    }
}

async function doge20Deploy() {
    const argAddress = process.argv[4]
    const argTicker = process.argv[5]
    const argMax = process.argv[6]
    const argLimit = process.argv[7]

    const doge20Tx = {
        p: "jnk-20",
        op: "deploy",
        tick: `${argTicker.toLowerCase()}`,
        max: `${argMax}`,
        lim: `${argLimit}`
    };

    const parsedDoge20Tx = JSON.stringify(doge20Tx);
    const encodedDoge20Tx = Buffer.from(parsedDoge20Tx, 'utf8').toString('hex');

    console.log("Deploying jnk-20 token...");
    await mint(argAddress, "text/plain;charset=utf-8", encodedDoge20Tx);
}

async function doge20Transfer() {
    const argAddress = process.argv[4]
    const argTicker = process.argv[5]
    const argAmount = process.argv[6]
    const argRepeat = Number(process.argv[7]) || 1;

    const doge20Tx = {
        p: "jnk-20",
        op: "transfer",
        tick: `${argTicker.toLowerCase()}`,
        amt: `${argAmount}`
    };

    const parsedDoge20Tx = JSON.stringify(doge20Tx);
    const encodedDoge20Tx = Buffer.from(parsedDoge20Tx, 'utf8').toString('hex');

    for (let i = 0; i < argRepeat; i++) {
        console.log("Minting jnk-20 token...", i + 1, "of", argRepeat, "times");
        await mint(argAddress, "text/plain;charset=utf-8", encodedDoge20Tx);
    }
}

async function wallet() {
    let subcmd = process.argv[3]

    if (subcmd == 'new') {
        await walletNew()
    } else if (subcmd == 'sync') {
        await walletSync()
    } else if (subcmd == 'balance') {
        walletBalance()
    } else if (subcmd == 'send') {
        await walletSend()
    } else if (subcmd == 'split') {
        await walletSplit()
    } else {
        throw new Error(`unknown subcommand: ${subcmd}`)
    }
}

async function walletNew() {
    if (!fs.existsSync(WALLET_PATH)) {
        const privateKey = new PrivateKey()
        const privkey = privateKey.toWIF()
        const address = privateKey.toAddress().toString()
        const json = { privkey, address, utxos: [] }
        fs.writeFileSync(WALLET_PATH, JSON.stringify(json, 0, 2))
        
        // Import private key to core wallet
        try {
            const body = {
                jsonrpc: "1.0",
                id: "importprivkey",
                method: "importprivkey",
                params: [privkey, "junkscriptions", false]
            }

            const options = {
                auth: {
                    username: process.env.NODE_RPC_USER,
                    password: process.env.NODE_RPC_PASS
                }
            }

            await axios.post(process.env.NODE_RPC_URL, body, options)
            console.log('Created new wallet and imported to core wallet')
            console.log('Address:', address)
            console.log('\nIMPORTANT: Before minting, you need to:')
            console.log('1. Fund this address with JKC')
            console.log('2. Run: node junkscriptions.js wallet sync')
        } catch (error) {
            console.error('Error importing to core wallet:', error.message)
            if (error.response && error.response.data) {
                console.error('RPC Error:', error.response.data.error)
            }
            // Still create local wallet even if core wallet import fails
            console.log('\nLocal wallet created but core wallet import failed')
            console.log('Address:', address)
            console.log('\nIMPORTANT: Before minting, you need to:')
            console.log('1. Fund this address with JKC')
            console.log('2. Run: node junkscriptions.js wallet sync')
        }
    } else {
        throw new Error('wallet already exists')
    }
}

async function walletSync() {
    let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))

    console.log('Syncing UTXOs with local Junkcoin node via RPC...')

    try {
        const body = {
            jsonrpc: "1.0",
            id: "walletsync",
            method: "listunspent",
            params: [0, 9999999, [wallet.address]]
        }

        const options = {
            auth: {
                username: process.env.NODE_RPC_USER,
                password: process.env.NODE_RPC_PASS
            }
        }

        let response = await axios.post(process.env.NODE_RPC_URL, body, options)
        let utxos = response.data.result

        wallet.utxos = utxos.map(utxo => {
            return {
                txid: utxo.txid,
                vout: utxo.vout,
                script: utxo.scriptPubKey,
                satoshis: utxo.amount * 1e8
            }
        })

        fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, 0, 2))
        let balance = wallet.utxos.reduce((acc, curr) => acc + curr.satoshis, 0)
        console.log('Balance:', balance/1e8, 'JNK')
        
        if (balance === 0) {
            console.log('\nNo funds found. Before minting, you need to:')
            console.log('1. Fund this address:', wallet.address)
            console.log('2. Run this sync command again')
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('Error: Could not connect to Junkcoin node')
            console.log('\nMake sure:')
            console.log('1. Junkcoin node is running')
            console.log('2. RPC is enabled in junkcoin.conf')
            console.log('3. RPC credentials in .env are correct')
        } else {
            console.error('Error syncing wallet:', error.message)
        }
        process.exit(1)
    }
}

function walletBalance() {
    try {
        let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))
        let balance = wallet.utxos.reduce((acc, curr) => acc + curr.satoshis, 0)
        console.log('Address:', wallet.address)
        console.log('Balance:', balance/1e8, 'JNK')
        
        if (balance === 0) {
            console.log('\nNo funds found. Before minting, you need to:')
            console.log('1. Fund this address:', wallet.address)
            console.log('2. Run: node junkscriptions.js wallet sync')
        }
    } catch (error) {
        console.error('Error checking balance:', error.message)
        process.exit(1)
    }
}

async function walletSend() {
    const argAddress = process.argv[4]
    const argAmount = process.argv[5]

    try {
        let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))
        let balance = wallet.utxos.reduce((acc, curr) => acc + curr.satoshis, 0)
        
        if (balance === 0) {
            console.log('Error: No funds available')
            console.log('\nBefore sending, you need to:')
            console.log('1. Fund this address:', wallet.address)
            console.log('2. Run: node junkscriptions.js wallet sync')
            process.exit(1)
        }

        let receiver = new Address(argAddress)
        let amount = parseInt(argAmount)

        let tx = new Transaction()
        if (amount) {
            tx.to(receiver, amount)
            fund(wallet, tx)
        } else {
            tx.from(wallet.utxos)
            tx.change(receiver)
            tx.sign(wallet.privkey)
        }

        await broadcast(tx, true)
        console.log('Transaction sent:', tx.hash)
    } catch (error) {
        console.error('Error sending transaction:', error.message)
        process.exit(1)
    }
}

async function walletSplit() {
    let splits = parseInt(process.argv[4])
    
    try {
        let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))
        let balance = wallet.utxos.reduce((acc, curr) => acc + curr.satoshis, 0)
        
        if (balance === 0) {
            console.log('Error: No funds available')
            console.log('\nBefore splitting, you need to:')
            console.log('1. Fund this address:', wallet.address)
            console.log('2. Run: node junkscriptions.js wallet sync')
            process.exit(1)
        }

        let tx = new Transaction()
        tx.from(wallet.utxos)
        for (let i = 0; i < splits - 1; i++) {
            tx.to(wallet.address, Math.floor(balance / splits))
        }
        tx.change(wallet.address)
        tx.sign(wallet.privkey)

        await broadcast(tx, true)
        console.log('Split transaction sent:', tx.hash)
    } catch (error) {
        console.error('Error splitting UTXOs:', error.message)
        process.exit(1)
    }
}

async function mint(paramAddress, paramContentTypeOrFilename, paramHexData) {
    const argAddress = paramAddress || process.argv[3]
    const argContentTypeOrFilename = paramContentTypeOrFilename || process.argv[4]
    const argHexData = paramHexData || process.argv[5]

    try {
        let address = new Address(argAddress)
        let contentType
        let data

        // Handle file input
        if (fs.existsSync(argContentTypeOrFilename)) {
            const fileExt = argContentTypeOrFilename.split('.').pop().toLowerCase()
            
            // Read file content
            if (fileExt === 'json') {
                // For JSON files, read as UTF-8 and convert to hex
                contentType = 'application/json'
                const jsonContent = fs.readFileSync(argContentTypeOrFilename, 'utf8')
                // Validate JSON
                JSON.parse(jsonContent) // Will throw if invalid JSON
                data = Buffer.from(jsonContent, 'utf8')
            } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
                // For images, read as binary
                contentType = mime.lookup(argContentTypeOrFilename)
                data = fs.readFileSync(argContentTypeOrFilename)
                console.log(`Inscribing ${fileExt.toUpperCase()} image, size: ${data.length} bytes`)
            } else {
                // For other files, try to detect content type
                contentType = mime.lookup(argContentTypeOrFilename) || 'application/octet-stream'
                data = fs.readFileSync(argContentTypeOrFilename)
            }
        } else {
            // Handle direct content type and hex data input
            contentType = argContentTypeOrFilename
            if (!argHexData) {
                throw new Error('When not using a file, you must provide hex data as the third argument')
            }
            if (!/^[a-fA-F0-9]*$/.test(argHexData)) {
                throw new Error('Data must be hex encoded')
            }
            data = Buffer.from(argHexData, 'hex')
        }

        if (data.length === 0) {
            throw new Error('No data to mint')
        }

        if (data.length > MAX_CHUNK_LEN * 100) {
            throw new Error(`File too large. Maximum size is ${MAX_CHUNK_LEN * 100} bytes`)
        }

        if (contentType.length > MAX_SCRIPT_ELEMENT_SIZE) {
            throw new Error('Content type too long')
        }

        let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))
        let balance = wallet.utxos.reduce((acc, curr) => acc + curr.satoshis, 0)
        
        if (balance === 0) {
            console.log('Error: No funds available')
            console.log('\nBefore minting, you need to:')
            console.log('1. Fund this address:', wallet.address)
            console.log('2. Run: node junkscriptions.js wallet sync')
            process.exit(1)
        }

        console.log('Minting inscription:')
        console.log('Content type:', contentType)
        console.log('Data size:', data.length, 'bytes')
        
        let txs = inscribe(wallet, address, contentType, data)
        await broadcastAll(txs, false)
    } catch (error) {
        if (error.message.includes('JSON')) {
            console.error('Error: Invalid JSON file')
        } else {
            console.error('Error minting inscription:', error.message)
        }
        process.exit(1)
    }
}

function bufferToChunk(b, type) {
    b = Buffer.from(b, type)
    return {
        buf: b.length ? b : undefined,
        len: b.length,
        opcodenum: b.length <= 75 ? b.length : b.length <= 255 ? 76 : 77
    }
}

function numberToChunk(n) {
    if (n <= 16) {
        return {
            buf: undefined,
            len: 0,
            opcodenum: n === 0 ? 0 : 80 + n
        }
    } else if (n < 128) {
        return {
            buf: Buffer.from([n]),
            len: 1,
            opcodenum: 1
        }
    } else {
        return {
            buf: Buffer.from([n % 256, Math.floor(n / 256)]),
            len: 2,
            opcodenum: 2
        }
    }
}

function opcodeToChunk(op) {
    return { opcodenum: op }
}

function inscribe(wallet, address, contentType, data) {
    let txs = []
    let privateKey = new PrivateKey(wallet.privkey)
    let publicKey = privateKey.toPublicKey()

    let parts = []
    while (data.length) {
        let part = data.slice(0, Math.min(MAX_CHUNK_LEN, data.length))
        data = data.slice(part.length)
        parts.push(part)
    }

    let inscription = new Script()
    inscription.chunks.push(bufferToChunk('ord'))
    inscription.chunks.push(numberToChunk(parts.length))
    inscription.chunks.push(bufferToChunk(contentType))
    parts.forEach((part, n) => {
        inscription.chunks.push(numberToChunk(parts.length - n - 1))
        inscription.chunks.push(bufferToChunk(part))
    })

    let p2shInput
    let lastLock
    let lastPartial

    while (inscription.chunks.length) {
        let partial = new Script()

        if (txs.length == 0) {
            partial.chunks.push(inscription.chunks.shift())
        }

        while (partial.toBuffer().length <= MAX_PAYLOAD_LEN && inscription.chunks.length) {
            partial.chunks.push(inscription.chunks.shift())
            partial.chunks.push(inscription.chunks.shift())
        }

        if (partial.toBuffer().length > MAX_PAYLOAD_LEN) {
            inscription.chunks.unshift(partial.chunks.pop())
            inscription.chunks.unshift(partial.chunks.pop())
        }

        // Build P2SH redeem script
        let redeemScript = new Script()
        redeemScript.chunks.push(bufferToChunk(publicKey.toBuffer()))
        redeemScript.chunks.push(opcodeToChunk(Opcode.OP_CHECKSIGVERIFY))
        partial.chunks.forEach(() => {
            redeemScript.chunks.push(opcodeToChunk(Opcode.OP_DROP))
        })
        redeemScript.chunks.push(opcodeToChunk(Opcode.OP_TRUE))

        // Create P2SH script
        let p2shScript = Script.buildScriptHashOut(redeemScript)
        
        let p2shOutput = new Transaction.Output({
            script: p2shScript,
            satoshis: 1000000
        })

        let tx = new Transaction()
        if (p2shInput) tx.addInput(p2shInput)
        tx.addOutput(p2shOutput)
        fund(wallet, tx)

        if (p2shInput) {
            let signature = Transaction.sighash.sign(tx, privateKey, Signature.SIGHASH_ALL, 0, lastLock)
            let txsignature = Buffer.concat([signature.toBuffer(), Buffer.from([Signature.SIGHASH_ALL])])

            // Create P2SH unlock script
            let unlock = Script.buildP2SHMultisigIn(
                [publicKey], 
                1, 
                [txsignature], 
                {cachedMultisig: lastLock}
            )
            unlock.chunks = unlock.chunks.concat(lastPartial.chunks)
            tx.inputs[0].setScript(unlock)
        }

        updateWallet(wallet, tx)
        txs.push(tx)

        p2shInput = new Transaction.Input({
            prevTxId: tx.hash,
            outputIndex: 0,
            output: tx.outputs[0],
            script: ''
        })

        p2shInput.clearSignatures = () => {}
        p2shInput.getSignatures = () => {}

        lastLock = redeemScript
        lastPartial = partial
    }

    // Final transaction to recipient address
    let tx = new Transaction()
    tx.addInput(p2shInput)
    
    // Check if recipient address is P2SH
    if (address.isPayToScriptHash()) {
        tx.addOutput(Script.buildScriptHashOut(address), 1000000)
    } else {
        tx.to(address, 1000000)
    }
    
    fund(wallet, tx)

    let signature = Transaction.sighash.sign(tx, privateKey, Signature.SIGHASH_ALL, 0, lastLock)
    let txsignature = Buffer.concat([signature.toBuffer(), Buffer.from([Signature.SIGHASH_ALL])])

    // Create final P2SH unlock script
    let unlock = Script.buildP2SHMultisigIn(
        [publicKey],
        1,
        [txsignature],
        {cachedMultisig: lastLock}
    )
    unlock.chunks = unlock.chunks.concat(lastPartial.chunks)
    tx.inputs[0].setScript(unlock)

    updateWallet(wallet, tx)
    txs.push(tx)

    return txs
}

function fund(wallet, tx) {
    tx.change(wallet.address)
    delete tx._fee

    for (const utxo of wallet.utxos) {
        if (tx.inputs.length && tx.outputs.length && tx.inputAmount >= tx.outputAmount + tx.getFee()) {
            break
        }

        delete tx._fee
        tx.from(utxo)
        tx.change(wallet.address)
        tx.sign(wallet.privkey)
    }

    if (tx.inputAmount < tx.outputAmount + tx.getFee()) {
        throw new Error('Not enough funds. Please fund the wallet and run: node junkscriptions.js wallet sync')
    }
}

function updateWallet(wallet, tx) {
    wallet.utxos = wallet.utxos.filter(utxo => {
        for (const input of tx.inputs) {
            if (input.prevTxId.toString('hex') == utxo.txid && input.outputIndex == utxo.vout) {
                return false
            }
        }
        return true
    })

    tx.outputs.forEach((output, vout) => {
        if (output.script.toAddress().toString() == wallet.address) {
            wallet.utxos.push({
                txid: tx.hash,
                vout,
                script: output.script.toHex(),
                satoshis: output.satoshis
            })
        }
    })
}

async function broadcast(tx, retry) {
    const body = {
        jsonrpc: "1.0",
        id: 0,
        method: "sendrawtransaction",
        params: [tx.toString()]
    }

    const options = {
        auth: {
            username: process.env.NODE_RPC_USER,
            password: process.env.NODE_RPC_PASS
        }
    }

    while (true) {
        try {
            await axios.post(process.env.NODE_RPC_URL, body, options)
            break
        } catch (e) {
            if (!retry) throw e
            let msg = e.response && e.response.data && e.response.data.error && e.response.data.error.message
            if (msg && msg.includes('too-long-mempool-chain')) {
                console.warn('retrying, too-long-mempool-chain')
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                throw e
            }
        }
    }

    let wallet = JSON.parse(fs.readFileSync(WALLET_PATH))
    updateWallet(wallet, tx)
    fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, 0, 2))
}

async function broadcastAll(txs, retry) {
    for (let i = 0; i < txs.length; i++) {
        console.log(`Broadcasting tx ${i + 1} of ${txs.length}`)

        try {
            await broadcast(txs[i], retry)
        } catch (e) {
            console.log('Broadcast failed:', e?.response?.data)
            if (e?.response?.data?.error?.message?.includes("bad-txns-inputs-spent") || 
                e?.response?.data?.error?.message?.includes("already in block chain")) {
                console.log('Transaction already sent, skipping')
                continue;
            }
            console.log('Saving pending transactions to pending-txs.json')
            console.log('To reattempt broadcast, re-run the command')
            fs.writeFileSync('pending-txs.json', JSON.stringify(txs.slice(i).map(tx => tx.toString())))
            process.exit(1)
        }
    }

    try {
        fs.unlinkSync('pending-txs.json')
    } catch (err) {
        // ignore
    }

    if (txs.length > 1) {
        console.log('Inscription TXID:', txs[1].hash)
    }
}

async function extract(txid) {
    const body = {
        jsonrpc: "1.0",
        id: "extract",
        method: "getrawtransaction",
        params: [txid, true]
    }

    const options = {
        auth: {
            username: process.env.NODE_RPC_USER,
            password: process.env.NODE_RPC_PASS
        }
    }

    let response = await axios.post(process.env.NODE_RPC_URL, body, options)
    let transaction = response.data.result

    let inputs = transaction.vin
    let scriptHex = inputs[0].scriptSig.hex
    let script = Script.fromHex(scriptHex)
    let chunks = script.chunks

    let prefix = chunks.shift().buf.toString('utf-8')
    if (prefix != 'ord') {
        throw new Error('Not a valid inscription')
    }

    let pieces = chunkToNumber(chunks.shift())
    let contentType = chunks.shift().buf.toString('utf-8')
    let data = Buffer.alloc(0)
    let remaining = pieces

    while (remaining && chunks.length) {
        let n = chunkToNumber(chunks.shift())

        if (n !== remaining - 1) {
            txid = transaction.vout[0].spent.hash
            response = await axios.post(process.env.NODE_RPC_URL, body, options)
            transaction = response.data.result
            inputs = transaction.vin
            scriptHex = inputs[0].scriptSig.hex
            script = Script.fromHex(scriptHex)
            chunks = script.chunks
            continue
        }

        data = Buffer.concat([data, chunks.shift().buf])
        remaining -= 1
    }

    return {
        contentType,
        data
    }
}

function chunkToNumber(chunk) {
    if (chunk.opcodenum == 0) return 0
    if (chunk.opcodenum == 1) return chunk.buf[0]
    if (chunk.opcodenum == 2) return chunk.buf[1] * 255 + chunk.buf[0]
    if (chunk.opcodenum > 80 && chunk.opcodenum <= 96) return chunk.opcodenum - 80
    return undefined
}

function server() {
    const app = express()
    const port = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000

    app.get('/tx/:txid', (req, res) => {
        extract(req.params.txid).then(result => {
            res.setHeader('content-type', result.contentType)
            res.send(result.data)
        }).catch(e => res.send(e.message))
    })

    app.listen(port, () => {
        console.log(`Listening on port ${port}`)
        console.log()
        console.log(`Example:`)
        console.log(`http://localhost:${port}/tx/15f3b73df7e5c072becb1d84191843ba080734805addfccb650929719080f62e`)
    })
}

main().catch(e => {
    let reason = e.response && e.response.data && e.response.data.error && e.response.data.error.message
    console.error('Error:', reason ? e.message + ': ' + reason : e.message)
})
