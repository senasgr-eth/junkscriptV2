# Junkscriptv2

An enhanced tool for creating inscriptions on the Junkcoin blockchain with core wallet integration, P2SH support, and advanced file handling capabilities.

## Author
senasgr-eth

## Features

- Automatic core wallet integration
- Create inscriptions from various file types (JSON, images, etc.)
- P2SH (Pay to Script Hash) support for enhanced security
- JNK-20 token standard support
- Automatic content-type detection
- Built-in wallet management
- RPC node integration
- Enhanced error handling

## Prerequisites

1. Node.js installed
2. Running Junkcoin node with RPC enabled
3. Basic understanding of blockchain transactions

## Installation

1. Clone the repository:
```bash
git clone https://github.com/senasgr-eth/junkscriptv2.git
cd junkscriptv2
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file:
```env
NODE_RPC_URL=http://127.0.0.1:9771
NODE_RPC_USER=your_rpc_user
NODE_RPC_PASS=your_rpc_password
TESTNET=false
FEE_PER_KB=100000000
```

## Setup

1. Create a new wallet:
```bash
node junkscriptv2.js wallet new
```
This will:
- Create a .wallet.json file with your address
- Automatically import the private key to your core wallet
- Label the address as "junkscriptions" in your core wallet

2. Fund your wallet:
- Send JNK to the displayed address
- Wait for transaction confirmation

3. Sync your wallet:
```bash
node junkscriptv2.js wallet sync
```

## Usage

### Basic Wallet Operations

```bash
# Check wallet balance
node junkscriptv2.js wallet balance

# Send JNK to address
node junkscriptv2.js wallet send <address> <amount>

# Split UTXOs
node junkscriptv2.js wallet split <number_of_splits>
```

### Creating Inscriptions

1. From JSON file:
```bash
# Create a JSON file (e.g., inscription.json)
{
  "p": "jnk-20",
  "op": "mint",
  "tick": "TEST",
  "amt": "1000"
}

# Mint the inscription
node junkscriptv2.js mint <address> inscription.json
```

2. From image file:
```bash
# Supported formats: JPG, JPEG, PNG, GIF, WEBP
node junkscriptv2.js mint <address> image.jpg
```

3. From hex data:
```bash
# Direct text/plain inscription
node junkscriptv2.js mint <address> text/plain 48656C6C6F20576F726C64
```

### JNK-20 Token Operations

1. Deploy new token:
```bash
node junkscriptv2.js jnk-20 deploy <address> <ticker> <max_supply> <mint_limit>

# Example:
node junkscriptv2.js jnk-20 deploy jnk1address TEST 1000000 1000
```

2. Transfer tokens:
```bash
node junkscriptv2.js jnk-20 transfer <address> <ticker> <amount>

# Example:
node junkscriptv2.js jnk-20 transfer jnk1address TEST 100
```

## File Support

### Supported File Types

1. JSON Files (.json)
- Automatically validated
- Content-type: application/json
- Used for structured data like JNK-20 tokens

2. Image Files
- JPG/JPEG: image/jpeg
- PNG: image/png
- GIF: image/gif
- WEBP: image/webp
- Size limit: 24KB

3. Other Files
- Automatic content-type detection
- Fallback to application/octet-stream

### Size Limits

- Maximum file size: 24KB (MAX_CHUNK_LEN * 100)
- Maximum script element size: 520 bytes
- Maximum payload length: 1500 bytes

## Security Features

1. P2SH Implementation
- Enhanced security for inscriptions
- Script validation
- Proper signature verification

2. Error Handling
- JSON validation
- File size validation
- RPC connection validation
- Transaction validation
- Core wallet integration validation

## Core Wallet Integration

The tool automatically integrates with your Junkcoin core wallet:

1. When creating a new wallet:
- Private key is automatically imported to core wallet
- Address is labeled as "junkscriptions"
- Maintains synchronization between local and core wallet

2. Configuration:
- Ensure core wallet is running
- RPC must be enabled in junkcoin.conf:
  ```
  server=1
  rpcuser=your_rpc_user
  rpcpassword=your_rpc_password
  ```
- Update .env with matching RPC credentials

## Server Mode

Run an inscription server to view inscriptions:
```bash
node junkscriptv2.js server

# Access inscriptions at:
http://localhost:3000/tx/<inscription_txid>
```

## Error Messages and Troubleshooting

1. "Not enough funds"
- Fund your wallet address
- Run wallet sync
- Check balance

2. "Invalid JSON file"
- Verify JSON syntax
- Check file encoding (UTF-8)

3. "File too large"
- Reduce file size to under 24KB
- Consider compression

4. RPC Connection Issues
- Verify Junkcoin node is running
- Check RPC credentials in .env
- Ensure RPC is enabled in junkcoin.conf

5. Core Wallet Import Issues
- Ensure core wallet is running
- Verify RPC credentials
- Check core wallet error logs

## Best Practices

1. Before Minting
- Always sync wallet first
- Ensure sufficient funds
- Verify file contents and size

2. Transaction Management
- Monitor pending transactions
- Keep track of inscription TXIDs
- Regular wallet syncs

3. Security
- Backup .wallet.json file
- Keep RPC credentials secure
- Use testnet for testing
- Backup core wallet regularly

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
