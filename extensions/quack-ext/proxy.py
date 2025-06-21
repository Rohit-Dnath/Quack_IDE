from mitmproxy import http, ctx
import pytesseract
from PIL import Image
import io
import json

# test

WHITELIST = [
    "github.com",
    "chatgpt.com",
    "notion.so",
    # GitHub Copilot domains
    "api.github.com",
    "copilot-proxy.githubusercontent.com",
    "default.exp-tas.com",
    "vscode.dev",
    "github.dev",
    "api.githubcopilot.com",
    "copilot.github.com",
    # VS Code related domains
    "vscode.blob.core.windows.net",
    "update.code.visualstudio.com",
    "marketplace.visualstudio.com",
    "gallery.vsassets.io",
    "az764295.vo.msecnd.net",
    # Microsoft authentication for Copilot
    "login.microsoftonline.com",
    "login.live.com",
    "account.live.com"
]
current_whitelist = WHITELIST.copy()
protected_snippets = []

def normalize(text):
    return ''.join(c.lower() for c in text if c.isalnum())

def extract_text_from_image(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image)
        ctx.log.info(f"OCR detected text in image: {repr(text)}")
        return text
    except Exception as e:
        ctx.log.warn(f"OCR Error: {e}")
        return ""

def is_code_match(ocr_text, snippets):
    norm_ocr = normalize(ocr_text)
    if len(norm_ocr) < 20:
        ctx.log.info("OCR too short or empty, skipping.")
        return False
    ocr_lines = [normalize(line) for line in ocr_text.split('\n') if len(line.strip()) > 10]
    snippet_lines = [normalize(snippet) for snippet in snippets if len(normalize(snippet)) > 10]
    matched_lines = set()
    for nsnip in snippet_lines:
        if nsnip in ocr_lines:
            matched_lines.add(nsnip)
    if len(matched_lines) >= 2:
        ctx.log.warn(f"Blocking upload: Matched code lines: {matched_lines}")
        return True
    elif matched_lines:
        ctx.log.info(f"Only one line matched, allowing upload. Matched lines: {matched_lines}")
    else:
        ctx.log.info("No code lines matched.")
    return False

class GooseQMITM:
    def __init__(self):
        self.snippets = []

    def request(self, flow: http.HTTPFlow):
        global current_whitelist, protected_snippets
        host = flow.request.host

        # --- Dynamic whitelist update endpoint ---
        if flow.request.pretty_url.endswith("/whitelist") and flow.request.method == "POST":
            try:
                data = json.loads(flow.request.get_text())
                wl = data.get('whitelist')
                if isinstance(wl, list):
                    current_whitelist = wl
                    ctx.log.info(f"Updated whitelist: {current_whitelist}")
                    flow.response = http.Response.make(
                        200, b"Whitelist updated", {"Content-Type": "text/plain"}
                    )
                else:
                    flow.response = http.Response.make(
                        400, b"Bad whitelist format", {"Content-Type": "text/plain"}
                    )
                return
            except Exception as e:
                ctx.log.error(f"Failed to update whitelist: {e}")
                flow.response = http.Response.make(
                    400, b"Bad request", {"Content-Type": "text/plain"}
                )
                return

        # --- Keepalive endpoint ---
        if flow.request.pretty_url.endswith("/keepalive"):
            flow.response = http.Response.make(200, b"OK", {"Content-Type": "text/plain"})
            return

        # --- Snippet init endpoint ---
        if flow.request.pretty_url.endswith("/init") and flow.request.method == "POST":
            try:
                data = json.loads(flow.request.get_text())
                self.snippets = data.get('codeSnippets', [])
                protected_snippets = self.snippets
                ctx.log.info(f"Snippets loaded (first 3): {[s[:40] for s in self.snippets[:3]]}")
                flow.response = http.Response.make(
                    200, b"Snippets loaded", {"Content-Type": "text/plain"}
                )
                return
            except Exception as e:
                ctx.log.error(f"Failed to load snippets: {e}")
                flow.response = http.Response.make(
                    400, b"Bad request", {"Content-Type": "text/plain"}
                )
                return

        # --- Whitelist enforcement ---
        # Always allow Copilot and VS Code related requests
        copilot_patterns = [
            "copilot", "github", "vscode", "microsoft", "visualstudio",
            "githubcopilot", "exp-tas.com", "msecnd.net"
        ]
        is_copilot_related = any(pattern in host.lower() for pattern in copilot_patterns)

        if not any(domain in host for domain in current_whitelist) and not is_copilot_related:
            if flow.request.method in ["POST", "PUT"]:
                flow.response = http.Response.make(
                    403, b"Blocked by GooseQ: Destination not whitelisted!",
                    {"Content-Type": "text/plain"}
                )
                ctx.log.warn(f"Blocked outbound request to non-whitelisted host: {host}")
                return

        # --- Screenshot OCR blocking ---
        content_type = flow.request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            boundary = content_type.split("boundary=")[-1].strip()
            if boundary:
                boundary_bytes = boundary.encode()
                parts = flow.request.raw_content.split(b"--" + boundary_bytes)
                for part in parts:
                    if b"Content-Type: image/" in part:
                        img_match = b"\r\n\r\n"
                        img_start = part.find(img_match)
                        if img_start != -1:
                            img_start += len(img_match)
                            img_end = part.find(b"\r\n--", img_start)
                            if img_end == -1:
                                img_end = len(part)
                            img_bytes = part[img_start:img_end]
                            text_in_image = extract_text_from_image(img_bytes)
                            if is_code_match(text_in_image, protected_snippets):
                                flow.response = http.Response.make(
                                    403, b"Blocked by GooseQ: Company code detected in screenshot!",
                                    {"Content-Type": "text/plain"}
                                )
                                ctx.log.warn("Blocked image upload: Company code detected!")
                                return

        # --- Block company code in body to non-whitelisted hosts ---
        # Skip code leak detection for Copilot and VS Code related requests
        if not is_copilot_related:
            try:
                text = flow.request.get_text(errors="replace")
            except Exception:
                text = ""
            norm_body = normalize(text)
            for snippet in protected_snippets:
                norm_snip = normalize(snippet)
                if norm_snip and norm_snip in norm_body:
                    flow.response = http.Response.make(
                        403, b"Blocked by GooseQ: Company code leak detected!",
                        {"Content-Type": "text/plain"}
                    )
                    ctx.log.warn(f"Blocked outbound request containing code snippet: {snippet[:40]}...")
                    return

addons = [
    GooseQMITM()
]
