# Quack-Ext - VS Code Security Extension

Quack-Ext is a next-level IDE security extension that prevents code leaks to external sites using MITM proxy technology.

## Features

- **Automatic Security**: Starts automatically when VS Code launches
- **MITM Proxy Protection**: Monitors and controls outbound network traffic
- **Smart Copy/Paste**: Encrypts sensitive code when copying, prevents accidental leaks
- **Whitelist Management**: Control which sites can receive your code
- **Extension Security Scanning**: Detect suspicious extensions
- **Environment File Protection**: Blocks copying from .env files

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)

## Installation & Setup

### Automatic Setup (Recommended)

1. **Install Dependencies**:
   - On Windows: Run `setup_dependencies.bat`
   - On other platforms: Run `python setup_dependencies.py`

2. **Alternative Manual Installation**:
   ```bash
   pip install mitmproxy pytesseract
   ```

### Extension Commands

- `Quack-Ext: Install Dependencies` - Install required Python packages
- `Quack-Ext: Enable Security` - Manually enable security features
- `Quack-Ext: Manage Whitelist` - Add/remove whitelisted domains
- `Quack-Ext: Show Whitelist` - View current whitelist
- `Quack-Ext: Scan Extension Security` - Check for suspicious extensions

## How It Works

1. **Auto-Start**: Extension activates automatically when VS Code starts
2. **Proxy Server**: Launches mitmproxy server on port 8000
3. **Traffic Monitoring**: Intercepts and analyzes outbound requests
4. **Code Protection**: Encrypts sensitive code snippets in clipboard
5. **Whitelist Enforcement**: Only allows data to whitelisted domains

## Default Whitelisted Domains

- github.com
- chatgpt.com
- notion.so
- VS Code and GitHub Copilot domains

## Security Features

### Smart Copy/Paste
- Protected code is encrypted when copied
- Clipboard is automatically wiped when switching windows
- Paste only works within the same workspace for encrypted content

### Environment Protection
- Blocks copying from .env files
- Prevents accidental exposure of secrets

### Extension Monitoring
- Scans installed extensions for suspicious behavior
- Warns about untrusted publishers
- Monitors for excessive permissions

## Configuration

### Proxy Settings

The extension uses the following mitmproxy command:
```
C:\Users\rohit\AppData\Roaming\Python\Python313\Scripts\mitmproxy.exe -s proxy.py --listen-port 8000
```

### Customization

You can modify the proxy path in the extension source if your Python installation is different.

## Troubleshooting

### Proxy Not Starting
1. Ensure Python and mitmproxy are installed
2. Check that the mitmproxy path is correct
3. Verify port 8000 is not in use

### Dependencies Missing
1. Run the setup script again
2. Manually install: `pip install mitmproxy pytesseract`
3. Ensure Python is in your PATH

### Extension Not Activating
1. Check VS Code output console for errors
2. Restart VS Code
3. Use "Quack-Ext: Enable Security" command manually

## Development

### Building the Extension

The extension is built as part of the VS Code build process:

1. TypeScript files are compiled automatically
2. Extension is included in the extensions build
3. No separate compilation needed

### File Structure

```
quack-ext/
├── src/
│   └── extension.ts          # Main extension code
├── proxy.py                  # MITM proxy script
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── setup_dependencies.py     # Python setup script
├── setup_dependencies.bat    # Windows setup script
└── README.md                 # This file
```

## License

MIT License - See LICENSE.txt in the VS Code root directory.

## Support

For issues and questions, please create an issue in the VS Code repository.
