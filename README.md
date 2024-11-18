# Junkscriptv2

A minter and protocol for inscriptions on Junkcoin with improved wallet management.

## Setup

**Install dependencies:**
```bash
npm install
```

**Create a `.env` file with your node information:**
```env
NODE_RPC_URL=http://<ip>:<port>
NODE_RPC_USER=<username>
NODE_RPC_PASS=<password>
TESTNET=false
FEE_PER_KB=100000000
```

## Wallet Management

### Create a New Wallet
```bash
node junkscriptv2.js wallet new
```
This will:
1. Generate a new private key and address
2. Create a local wallet file (.wallet.json)
3. Automatically import the private key to your core wallet
4. Display the address to fund

### Import Existing Wallet
```bash
node junkscriptv2.js wallet import <private_key>
```
This will:
1. Import your existing private key
2. Create a local wallet file (.wallet.json)
3. Automatically import the private key to your core wallet
4. Display the corresponding address

### Sync Wallet
After funding your wallet, sync it to see your balance:
```bash
node junkscriptv2.js wallet sync
```

### Check Balance
```bash
node junkscriptv2.js wallet balance
```

### Split UTXOs
If you plan to mint multiple tokens, split your UTXOs first:
```bash
node junkscriptv2.js wallet split <number_of_splits>
```
Example: `node junkscriptv2.js wallet split 10`

### Send Funds
```bash
node junkscriptv2.js wallet send <address> <amount>
```

## Minting

### From File
```bash
node junkscriptv2.js mint <address> <path>
```

### Repeating
```bash
node junkscriptv2.js mint <address> <path> <repeat>
```

### Examples
```bash
# Mint an image
node junkscriptv2.js mint JKmyaddress image.png

# Mint a JSON file 100 times
node junkscriptv2.js mint JKmyaddress data.json 100
```

## JNK-20 Operations

### Deploy Token
```bash
node junkscriptv2.js jnk-20 deploy <address> <ticker> <max_supply> <limit_per_mint>
```
Example:
```bash
node junkscriptv2.js jnk-20 deploy JKmyaddress PUNK 21000000 1000
```

### Mint Tokens
```bash
node junkscriptv2.js jnk-20 mint <address> <ticker> <amount> [repeat_count]
```
Example:
```bash
# Mint 100 PUNK tokens
node junkscriptv2.js jnk-20 mint JKmyaddress PUNK 100

# Mint 100 PUNK tokens 5 times
node junkscriptv2.js jnk-20 mint JKmyaddress PUNK 100 5
```

### Transfer Tokens
```bash
node junkscriptv2.js jnk-20 transfer <recipient_address> <ticker> <amount>
```

## Important Notes

1. **Fees**: The default fee rate is 1 JNK/KB. You can adjust this in the `.env` file using `FEE_PER_KB`.

2. **Output Amounts**: 
   - Minimum dust amount: 0.001 JNK (100000 satoshis)
   - Inscription amount: 0.005 JNK (500000 satoshis)

3. **Best Practices**:
   - Always sync your wallet before minting
   - Split UTXOs before bulk minting
   - Ensure sufficient funds for fees
   - Wait for transactions to confirm before making new ones
   - Keep your private keys secure

4. **File Support**:
   - Images: JPG, JPEG, PNG, GIF, WEBP
   - JSON files
   - Other file types supported with automatic content type detection

## Troubleshooting

### Common Issues

1. **"not enough funds"**
   - Solution: Fund your wallet and run `wallet sync`

2. **"too-long-mempool-chain"**
   - Solution: Wait for previous transactions to confirm

3. **"bad-txns-inputs-spent"**
   - Solution: Transaction already sent, no action needed

4. **"file too large"**
   - Solution: Ensure file is under 24KB

5. **Connection Issues**
   - Verify RPC credentials in `.env`
   - Check if Junkcoin node is running
   - Ensure correct RPC port configuration

### Recovery

If minting is interrupted, the script creates `pending-txs.json`. Simply run the same command again to continue from where it left off.

## Server Mode

Start a local server to view inscriptions:
```bash
node junkscriptv2.js server
```
Access inscriptions at: `http://localhost:3000/tx/<txid>`
